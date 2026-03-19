package schemav2

import (
	"context"
	"encoding/binary"
	"errors"
	"fmt"

	"github.com/tidwall/gjson"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

type SchemaRegistryClient interface {
	GetSchema(ctx context.Context, schemaID int) ([]models.Field, error)
}

type SchemaInterface interface {
	Get(ctx context.Context, versionID, key string, data []byte) (any, error)
	Validate(ctx context.Context, versionID string, data []byte) error
	IsExternal() bool
}

type Schema struct {
	pipelineID     string
	sourceID       string
	external       bool
	dbClient       DBClient
	srClient       SchemaRegistryClient
	store          Store
	validatorCache map[string]*jsonValidator // cached per schema version ID
}

func NewSchema(pipelineID, sourceID string, dbClient DBClient, srClient SchemaRegistryClient) (*Schema, error) {
	if dbClient == nil {
		return nil, fmt.Errorf("dbClient cannot be nil")
	}

	var external bool
	if srClient != nil {
		external = true
	}

	store := NewSchemaStore(dbClient, pipelineID, sourceID)
	return &Schema{
		pipelineID:     pipelineID,
		sourceID:       sourceID,
		external:       external,
		dbClient:       dbClient,
		srClient:       srClient,
		store:          store,
		validatorCache: make(map[string]*jsonValidator),
	}, nil
}

func (s *Schema) Validate(ctx context.Context, data []byte) (string, error) {
	if s.external {
		return s.validateExternalSchema(ctx, data)
	}

	return s.validateInternalSchema(ctx, data)
}

func (s *Schema) validateExternalSchema(ctx context.Context, data []byte) (string, error) {
	version, err := extractSchemaVersion(data)
	if err != nil {
		if errors.Is(err, models.ErrFailedToParseSchemaID) || errors.Is(err, models.ErrMessageIsTooShort) {
			return "", err
		}
		return "", fmt.Errorf("extract schema version: %w", err)
	}

	schemaVersion, err := s.store.GetSchemaVersion(ctx, fmt.Sprintf("%d", version))
	if err != nil {
		if errors.Is(err, models.ErrSchemaVerionNotFound) {
			newVersion, err := s.validateAndSaveNewSchemaVersion(ctx, version)
			if err != nil {
				return fmt.Sprintf("%d", version), err
			}
			return newVersion, nil
		}

		return fmt.Sprintf("%d", version), fmt.Errorf("failed to get schema version %d for source %s: %w", version, s.sourceID, err)
	}

	return schemaVersion.VersionID, nil
}

func (s *Schema) validateAndSaveNewSchemaVersion(ctx context.Context, version int) (zero string, nil error) {
	schemaFields, err := s.srClient.GetSchema(ctx, version)
	if err != nil {
		if errors.Is(err, models.ErrSchemaNotFound) {
			return zero, models.ErrSchemaNotFound
		}
		return zero, fmt.Errorf("failed to get schema fields for schema version %d: %w", version, err)
	}

	if len(schemaFields) == 0 {
		return zero, fmt.Errorf("schema version %d for schema %s has no fields", version, s.sourceID)
	}

	latestSchemaVersion, err := s.store.GetLatestSchemaVersion(ctx)
	if err != nil {
		return zero, fmt.Errorf("failed to get latest schema version for source %s: %w", s.sourceID, err)
	}

	err = validateSchemaToSchema(schemaFields, latestSchemaVersion.Fields)
	if err != nil {
		return zero, models.NewIncompatibleSchemaError(version, err.Error())
	}

	newVersion := fmt.Sprintf("%d", version)

	err = s.store.SaveSchemaVersion(ctx, latestSchemaVersion.VersionID, newVersion)
	if err != nil {
		return zero, fmt.Errorf("failed to save new schema version %d for source %s: %w", version, s.sourceID, err)
	}

	return newVersion, nil
}

func (s *Schema) validateInternalSchema(ctx context.Context, data []byte) (zero string, _ error) {
	currentVersion, err := s.store.GetLatestSchemaVersion(ctx)
	if err != nil {
		return zero, fmt.Errorf("failed to get latest schema version for internal schema %s: %w", s.sourceID, err)
	}

	if currentVersion.DataType != models.SchemaDataFormatJSON {
		return zero, fmt.Errorf("unsupported schema data format: %s", currentVersion.DataType)
	}

	// Use cached validator for this schema version (precomputed field checks,
	// escaped paths, and type mappings — avoids per-message overhead).
	validator, ok := s.validatorCache[currentVersion.VersionID]
	if !ok {
		validator = newJSONValidator(currentVersion.Fields)
		s.validatorCache[currentVersion.VersionID] = validator
	}

	err = validator.validate(data)
	if err != nil {
		return zero, fmt.Errorf("validate json data against fields: %w", err)
	}

	return currentVersion.VersionID, nil
}

func (s *Schema) Get(ctx context.Context, versionID, key string, data []byte) (any, error) {
	schemaVersion, err := s.store.GetSchemaVersion(ctx, versionID)
	if err != nil {
		return nil, fmt.Errorf("get schema version %s: %w", versionID, err)
	}

	// Check if the key exists in the schema
	var fieldExists bool
	for _, field := range schemaVersion.Fields {
		if field.Name == key {
			fieldExists = true
			break
		}
	}

	if !fieldExists {
		return nil, fmt.Errorf("field %s not found in schema version %s", key, versionID)
	}

	// Extract value using gjson, supporting both literal dotted keys and nested paths
	result := getFieldValue(gjson.ParseBytes(data), key)
	if !result.Exists() {
		return nil, fmt.Errorf("key %s not found in data", key)
	}

	return result.Value(), nil
}

func (s *Schema) IsExternal() bool {
	return s.external
}

func extractSchemaVersion(data []byte) (int, error) {
	if len(data) < 5 {
		return 0, models.ErrMessageIsTooShort
	}

	// Check magic byte
	if data[0] != 0 {
		return 0, models.ErrFailedToParseSchemaID
	}
	return int(binary.BigEndian.Uint32(data[1:5])), nil
}
