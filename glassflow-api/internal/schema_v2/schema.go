package schemav2

import (
	"context"
	"encoding/binary"
	"errors"
	"fmt"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/schema_v2/registry"
)

type SchemaInterface interface {
	Get(ctx context.Context, key string) (any, error)
	Validate(ctx context.Context, msg []byte) error
	GetVersionID(ctx context.Context, msg []byte) (string, error)
}

type Schema struct {
	store        Store
	schemaName   string
	sourceSchema *models.SchemaV2
}

func NewSchema(pipelineID, schemaName string, dbClient DBClient) *Schema {
	return &Schema{
		store:      NewSchemaStore(dbClient, pipelineID, schemaName),
		schemaName: schemaName,
	}
}

func (s *Schema) Get(ctx context.Context, key string) (any, error) {
	return nil, nil
}

func (s *Schema) Validate(ctx context.Context, msg []byte) error {
	if s.sourceSchema == nil {
		schema, err := s.store.GetSchema(ctx)
		if err != nil {
			return fmt.Errorf("failed to get schema %s: %w", s.schemaName, err)
		}
		s.sourceSchema = schema
	}

	if s.sourceSchema.ConfigType == models.SchemaConfigTypeExternal {
		return s.validateMsgWithExternalSchema(ctx, msg)
	}

	return s.validateMsgWithInternalSchema(ctx, msg)
}

// validateMsgWithExternalSchema - validate message using external schema registry
func (s *Schema) validateMsgWithExternalSchema(ctx context.Context, msg []byte) error {
	version, err := extractSchemaVersion(msg)
	if err != nil {
		return fmt.Errorf("failed to extract schema ID from message: %w", err)
	}

	schemaVersion, err := s.store.GetSchemaVersion(ctx, fmt.Sprintf("%d", version))
	if err != nil {
		if errors.Is(err, ErrSchemaVerionNotFound) {
			return s.validateAndSaveNewSchemaVersion(ctx, version)
		}

		return fmt.Errorf("failed to get schema version %d for schema %s: %w", version, s.sourceSchema.ID, err)
	}

	if schemaVersion == nil {
		return fmt.Errorf("schema version %d for schema %s not found", version, s.sourceSchema.ID)
	}

	if schemaVersion.Status != internal.SchemaStatusActive {
		return fmt.Errorf("schema version %d for schema %s is not active", version, s.sourceSchema.ID)
	}

	return nil
}

// validateMsgWithInternalSchema - validate message against internal schema
func (s *Schema) validateMsgWithInternalSchema(ctx context.Context, msg []byte) error {
	schemaVersion, err := s.store.GetLatestSchemaVersion(ctx)
	if err != nil {
		return fmt.Errorf("failed to get latest schema version for internal schema %s: %w", s.sourceSchema.ID, err)
	}

	if s.sourceSchema.DataFormat != models.SchemaDataFormatJSON {
		return fmt.Errorf("unsupported schema data format: %s", s.sourceSchema.DataFormat)
	}

	// Validate message against schema fields
	if err := validateJSONToSchema(msg, schemaVersion.SchemaFields); err != nil {
		return fmt.Errorf("message validation against schema %s failed: %w", s.sourceSchema.ID, err)
	}

	return nil
}

func (s *Schema) validateAndSaveNewSchemaVersion(ctx context.Context, version int) error {
	// fetch new schema from schema registry if not found in store
	srClient, err := registry.NewSchemaRegistryClient(s.sourceSchema.ExternalSchemaConfig)
	if err != nil {
		return fmt.Errorf("failed to create Schema Registry client: %w", err)
	}

	// Fetch schema version from Schema Registry
	schemaFields, err := srClient.GetSchema(context.Background(), version)
	if err != nil {
		if errors.Is(err, models.ErrSchemaNotFound) {
			return fmt.Errorf("schema ID %d not found in Schema Registry", version)
		}
		return fmt.Errorf("failed to fetch schema from registry: %w", err)
	}

	if len(schemaFields.Fields) == 0 {
		return fmt.Errorf("schema version %d for schema %s has no fields", version, s.sourceSchema.ID)
	}

	if s.sourceSchema.DataFormat != models.SchemaDataFormatJSON {
		return fmt.Errorf("unsupported schema data format: %s", s.sourceSchema.DataFormat)
	}

	latestSchemaVersion, err := s.store.GetLatestSchemaVersion(ctx)
	if err != nil {
		return fmt.Errorf("failed to get latest schema version for schema %s: %w", s.sourceSchema.ID, err)
	}

	err = validateSchemaToSchema(schemaFields, latestSchemaVersion.SchemaFields)
	if err != nil {
		return fmt.Errorf("new schema version %d validation against latest schema version for schema %s failed: %w",
			version, s.sourceSchema.ID, err)
	}

	// Save new schema version to store
	err = s.store.SaveSchemaVersion(ctx, fmt.Sprintf("%d", version), schemaFields)
	if err != nil {
		return fmt.Errorf("failed to save new schema version %d for schema %s: %w", version, s.sourceSchema.ID, err)
	}

	return nil
}

func (s *Schema) GetVersionID(ctx context.Context, msg []byte) (string, error) {
	version, err := extractSchemaVersion(msg)
	if err != nil {
		return "", fmt.Errorf("failed to extract schema version from message: %w", err)
	}
	return fmt.Sprintf("%d", version), nil
}

func extractSchemaVersion(data []byte) (int, error) {
	if len(data) < 5 {
		return 0, fmt.Errorf("message too short: expected at least 5 bytes, got %d", len(data))
	}

	// Check magic byte
	if data[0] != 0 {
		return 0, fmt.Errorf("invalid magic byte: expected 0x00, got 0x%02x", data[0])
	}
	return int(binary.BigEndian.Uint32(data[1:5])), nil
}
