package schemav2

import (
	"context"
	"encoding/binary"
	"errors"
	"fmt"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/schema_v2/registry"
)

type SourceData struct {
	SchemaID string
	Data     []byte
}

// MapperInterface defines methods for schema validation and data mapping (TEMPORARY INTERFACE)
type MapperInterface interface {
	GetKey(ctx context.Context, schemaID, keyName string, data []byte) (any, error)
	GetFieldNames(ctx context.Context, schemaID string) ([]string, error)
	TransformData(ctx context.Context, destinationSchemaID string, sources ...SourceData) ([]byte, error)
	Validate(ctx context.Context, schemaID string, msg []byte) error
}

type Mapper struct {
	store Store
}

func NewMapper(dbClient DBClient) *Mapper {
	return &Mapper{
		store: NewSchemaStore(dbClient),
	}
}

// Validate message against schema
func (m *Mapper) Validate(ctx context.Context, schemaID string, msg []byte) error {
	schema, err := m.store.GetSchema(ctx, schemaID)
	if err != nil {
		return fmt.Errorf("failed to get schema %s: %w", schemaID, err)
	}

	if schema.ConfigType == models.SchemaConfigTypeExternal {
		return m.validateMsgWithExternalSchema(ctx, schema, msg)
	}

	return m.validateMsgWithInternalSchema(ctx, schema, msg)
}

// validateMsgWithExternalSchema - validate message using external schema registry
func (m *Mapper) validateMsgWithExternalSchema(ctx context.Context, schema *models.SchemaV2, msg []byte) error {
	// Extract schema ID from message
	version, err := extractSchemaVersion(msg)
	if err != nil {
		return fmt.Errorf("failed to extract schema ID from message: %w", err)
	}

	schemaVersion, err := m.store.GetSchemaVersion(ctx, schema.ID, fmt.Sprintf("%d", version))
	if err != nil {
		if errors.Is(err, ErrSchemaVerionNotFound) {
			return m.validateAndSaveNewSchemaVersion(ctx, schema, version)
		}

		return fmt.Errorf("failed to get schema version %d for schema %s: %w", version, schema.ID, err)
	}

	if schemaVersion == nil {
		return fmt.Errorf("schema version %d for schema %s not found", version, schema.ID)
	}

	if schemaVersion.Status != "active" {
		return fmt.Errorf("schema version %d for schema %s is not active", version, schema.ID)
	}

	return nil
}

// validateMsgWithInternalSchema - validate message against internal schema
func (m *Mapper) validateMsgWithInternalSchema(ctx context.Context, schema *models.SchemaV2, msg []byte) error {
	schemaVersion, err := m.store.GetLatestSchemaVersion(ctx, schema.ID)
	if err != nil {
		return fmt.Errorf("failed to get latest schema version for internal schema %s: %w", schema.ID, err)
	}

	if schema.DataFormat != models.SchemaDataFormatJSON {
		return fmt.Errorf("unsupported schema data format: %s", schema.DataFormat)
	}

	// Validate message against schema fields
	if err := validateJSONToSchema(msg, schemaVersion.SchemaFields); err != nil {
		return fmt.Errorf("message validation against schema %s failed: %w", schema.ID, err)
	}

	return nil
}

func (m *Mapper) validateAndSaveNewSchemaVersion(ctx context.Context, schema *models.SchemaV2, version int) error {
	// fetch new schema from schema registry if not found in store
	srClient, err := registry.NewSchemaRegistryClient(schema.ExternalSchemaConfig)
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
		return fmt.Errorf("schema version %d for schema %s has no fields", version, schema.ID)
	}

	if schema.DataFormat != models.SchemaDataFormatJSON {
		return fmt.Errorf("unsupported schema data format: %s", schema.DataFormat)
	}

	latestSchemaVersion, err := m.store.GetLatestSchemaVersion(ctx, schema.ID)
	if err != nil {
		return fmt.Errorf("failed to get latest schema version for schema %s: %w", schema.ID, err)
	}

	var mappings []*models.Mapping
	srcMappings, err := m.store.GetSourceMapppings(ctx, schema.ID, latestSchemaVersion.Version)
	if err != nil {
		return fmt.Errorf("failed to get mapping for schema %s version %s: %w", schema.ID, latestSchemaVersion.Version, err)
	}

	mappings = append(mappings, srcMappings...)

	dstMappings, err := m.store.GetDestinationMappings(ctx, schema.ID, fmt.Sprintf("%d", version))
	if err != nil {
		return fmt.Errorf("failed to get mapping for schema %s version %d: %w", schema.ID, version, err)
	}

	mappings = append(mappings, dstMappings...)

	for _, mapping := range mappings {
		// Validate schema against mapping
		if err := validateSchemaToMapping(schema.SourceName, schemaFields, mapping); err != nil {
			return fmt.Errorf("schema validation failed: %w", err)
		}
	}

	// Save schema version to store
	schemaVersion := &models.SchemaVersion{
		SchemaID:     schema.ID,
		Version:      fmt.Sprintf("%d", version),
		Status:       "active",
		SchemaFields: schemaFields,
	}

	err = m.store.SaveSchemaVersion(ctx, *schemaVersion, srcMappings, dstMappings)
	if err != nil {
		return fmt.Errorf("failed to save schema version to store: %w", err)
	}

	return nil
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
