package postgres

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

type schemaV2 struct {
	id                   uuid.UUID
	sourceName           string
	configType           string
	dataFormat           string
	schemaType           string
	externalSchemaConfig json.RawMessage
	createdAt            time.Time
	updatedAt            time.Time
}

type schemaVersion struct {
	id           uuid.UUID
	schemaID     uuid.UUID
	version      string
	status       string
	schemaFields json.RawMessage
	createdAt    time.Time
	updatedAt    time.Time
}

type schemaMapping struct {
	id            uuid.UUID
	mappingType   string
	mappingFields json.RawMessage
	createdAt     time.Time
	updatedAt     time.Time
}

// insertSchemaV2 inserts a new schema into the "schema_v2" table
func (s *PostgresStorage) insertSchemaV2(ctx context.Context, tx pgx.Tx, pipelineID, name string, configType string, dataFormat string, schemaType string, externalSchemaConfig []byte) (uuid.UUID, error) {
	var schemaID uuid.UUID
	err := tx.QueryRow(ctx, `
		INSERT INTO schema_v2 (pipeline_id, source_name, config_type, data_format, schema_type, external_schema_config, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
		ON CONFLICT (pipeline_id, source_name) UPDATE SET config_type = EXCLUDED.config_type, data_format = EXCLUDED.data_format, schema_type = EXCLUDED.schema_type, external_schema_config = EXCLUDED.external_schema_config, updated_at = NOW()
		RETURNING id
	`, pipelineID, name, configType, dataFormat, schemaType, externalSchemaConfig).Scan(&schemaID)
	if err != nil {
		return uuid.Nil, fmt.Errorf("insert schema: %w", err)
	}
	return schemaID, nil
}

// getSchemaV2 retrieves a schema from the "schemas" table
func (s *PostgresStorage) getSchemaV2(ctx context.Context, tx pgx.Tx, schemaID uuid.UUID) (*schemaV2, error) {
	var schema schemaV2
	err := tx.QueryRow(ctx, `
        SELECT id, source_name, config_type, data_format, schema_type, external_schema_config, created_at, updated_at
        FROM schemas
        WHERE id = $1
    `, schemaID).Scan(&schema.id, &schema.sourceName, &schema.configType, &schema.dataFormat, &schema.schemaType, &schema.externalSchemaConfig, &schema.createdAt, &schema.updatedAt)
	if err != nil {
		return nil, fmt.Errorf("get schema: %w", err)
	}
	return &schema, nil
}

// getSchemaByPipelineID retrieves schema by pipeline ID
func (s *PostgresStorage) getSchemaIDsByPipelineID(ctx context.Context, tx pgx.Tx, pipelineID string) (map[string]uuid.UUID, error) {
	rows, err := tx.Query(ctx, `
		SELECT id, source_name
		FROM schemas_v2
		WHERE pipeline_id = $1
	`, pipelineID)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, models.ErrRecordNotFound
		}

		return nil, fmt.Errorf("query existing schemas by piplineID: %w", err)
	}

	defer rows.Close()

	existingSchemas := make(map[string]uuid.UUID)
	for rows.Next() {
		var schemaUUID uuid.UUID
		var sourceName string
		if err := rows.Scan(&schemaUUID, &sourceName); err != nil {
			return nil, fmt.Errorf("scan existing schema: %w", err)
		}
		existingSchemas[sourceName] = schemaUUID
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows error: %w", err)
	}

	return existingSchemas, nil
}

// insertSchemaVersion inserts a new schema version into the schema_versions table
func (s *PostgresStorage) insertSchemaVersion(ctx context.Context, tx pgx.Tx, schemaID uuid.UUID, version, status string, schemaFields []byte) (uuid.UUID, error) {
	var versionID uuid.UUID
	err := tx.QueryRow(ctx, `
		INSERT INTO schema_versions (schema_id, version, status, schema_fields, created_at, updated_at)
		VALUES ($1, $2, $3, $4, NOW(), NOW())
		ON CONFLICT (schema_id, version) UPDATE SET status = EXCLUDED.status, schema_fields = EXCLUDED.schema_fields, updated_at = NOW()
		RETURNING id
	`, schemaID, version, status, schemaFields).Scan(&versionID)
	if err != nil {
		return uuid.Nil, fmt.Errorf("insert schema version: %w", err)
	}
	return versionID, nil
}

// getSchemaVersion retrieves a specific schema version for a given schema ID
func (s *PostgresStorage) getSchemaVersion(ctx context.Context, tx pgx.Tx, schemaID, version string) (*schemaVersion, error) {
	var sv schemaVersion
	err := tx.QueryRow(ctx, `
		SELECT id, schema_id, version, status, schema_fields, created_at, updated_at
		FROM schema_versions
		WHERE schema_id = $1 AND version = $2
	`, schemaID, version).Scan(&sv.id, &sv.schemaID, &sv.version, &sv.status, &sv.schemaFields, &sv.createdAt, &sv.updatedAt)
	if err != nil {
		return nil, fmt.Errorf("get schema version: %w", err)
	}
	return &sv, nil
}

// getSchemaVersionsBySchemaID retrieves all schema versions for a given schema ID
func (s *PostgresStorage) getSchemaVersionsBySchemaID(ctx context.Context, tx pgx.Tx, schemaID string) ([]*schemaVersion, error) {
	rows, err := tx.Query(ctx, `
		SELECT id, schema_id, version, status, schema_fields
		FROM schema_versions
		WHERE schema_id = $1 AND status = $2
	`, schemaID, schemaStatusActive)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, models.ErrRecordNotFound
		}
		return nil, fmt.Errorf("query schema versions: %w", err)
	}
	defer rows.Close()

	var versions []*schemaVersion
	for rows.Next() {
		var sv schemaVersion
		err := rows.Scan(&sv.id, &sv.schemaID, &sv.version, &sv.status, &sv.schemaFields)
		if err != nil {
			return nil, fmt.Errorf("scan schema version: %w", err)
		}
		versions = append(versions, &sv)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows error: %w", err)
	}

	return versions, nil
}

// setStatusToSchemaVersion updates the status of a schema version
func (s *PostgresStorage) setStatusToSchemaVersion(ctx context.Context, tx pgx.Tx, schemaVersionID uuid.UUID, status string) error {
	_, err := tx.Exec(ctx, `
		UPDATE schema_versions
		SET status = $1, updated_at = NOW()
		WHERE id = $2
	`, status, schemaVersionID)
	if err != nil {
		return fmt.Errorf("update schema version status: %w", err)
	}
	return nil
}

// getLatestSchemaVersion retrieves the latest schema version for a given schema ID
func (s *PostgresStorage) getLatestSchemaVersion(ctx context.Context, tx pgx.Tx, schemaID string) (*schemaVersion, error) {
	var sv schemaVersion
	err := tx.QueryRow(ctx, `
		SELECT id, schema_id, version, status, schema_fields, created_at, updated_at
		FROM schema_versions
		WHERE schema_id = $1 AND status = $2
		ORDER BY created_at DESC
		LIMIT 1
	`, schemaID, schemaStatusActive).Scan(&sv.id, &sv.schemaID, &sv.version, &sv.status, &sv.schemaFields, &sv.createdAt, &sv.updatedAt)
	if err != nil {
		return nil, fmt.Errorf("get latest schema version: %w", err)
	}
	return &sv, nil
}

// insertSchemaMapping inserts a mapping and returns its UUID
func (s *PostgresStorage) insertMapping(ctx context.Context, tx pgx.Tx, pipelineID, mappingType string, fields []byte) (uuid.UUID, error) {
	var mappingID uuid.UUID
	err := tx.QueryRow(ctx, `
		INSERT INTO schema_mappings (pipeline_id, mapping_type, mapping_fields, created_at, updated_at)
		VALUES ($1, $2, $3, NOW(), NOW())
		ON CONFLICT (pipeline_id, mapping_type) DO UPDATE SET mapping_fields = EXCLUDED.mapping_fields, updated_at = NOW()
		RETURNING id
	`, pipelineID, mappingType, fields).Scan(&mappingID)
	if err != nil {
		return uuid.Nil, fmt.Errorf("insert mapping: %w", err)
	}

	return mappingID, nil
}

// insertSchemaToMapping links a schema version to a mapping in the schema_to_mapping table
func (s *PostgresStorage) insertSchemaToMapping(ctx context.Context, tx pgx.Tx, schemaID, schemaVersionID, mappingID uuid.UUID, position string) error {
	_, err := tx.Exec(ctx, `
		INSERT INTO schema_to_mapping (schema_id, schema_version_id, mapping_id, orientation)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (schema_id, schema_version_id, mapping_id) DO NOTHING
	`, schemaID, schemaVersionID, mappingID, position)
	if err != nil {
		return fmt.Errorf("insert schema to mapping: %w", err)
	}
	return nil
}

// getMappingsBySchema is a helper that retrieves schema mappings within an existing transaction
func (s *PostgresStorage) getMappingsBySchema(ctx context.Context, tx pgx.Tx, schemaID string, orientation models.MappingOrintation) ([]*models.Mapping, error) {
	rows, err := tx.Query(ctx, `
		SELECT sm.id, sm.mapping_type, sm.mapping_fields, sm.created_at, sm.updated_at
		FROM schema_mappings sm
		JOIN schema_to_mapping stm ON sm.id = stm.mapping_id
		WHERE stm.schema_id = $1 AND stm.orientation = $2
	`, schemaID, string(orientation))
	if err != nil {
		return nil, fmt.Errorf("query schema mappings: %w", err)
	}
	defer rows.Close()

	var mappings []*models.Mapping
	for rows.Next() {
		var sm schemaMapping
		err := rows.Scan(&sm.id, &sm.mappingType, &sm.mappingFields, &sm.createdAt, &sm.updatedAt)
		if err != nil {
			return nil, fmt.Errorf("scan schema mapping: %w", err)
		}

		var mappingFields []models.MappingField
		err = json.Unmarshal(sm.mappingFields, &mappingFields)
		if err != nil {
			return nil, fmt.Errorf("unmarshal mapping fields: %w", err)
		}

		mappings = append(mappings, &models.Mapping{
			ID:        sm.id.String(),
			Type:      sm.mappingType,
			Fields:    mappingFields,
			CreatedAt: sm.createdAt,
			UpdatedAt: sm.updatedAt,
		})
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows error: %w", err)
	}

	return mappings, nil
}

// GetSchemaV2 - retrieves a schema by its ID
func (s *PostgresStorage) GetSchema(ctx context.Context, schemaID string) (*models.SchemaV2, error) {
	schemaUUID, err := uuid.Parse(schemaID)
	if err != nil {
		return nil, fmt.Errorf("invalid schema ID: %w", err)
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	schema, err := s.getSchemaV2(ctx, tx, schemaUUID)
	if err != nil {
		return nil, fmt.Errorf("get schema: %w", err)
	}

	var srConfig models.SchemaRegistryConfig
	err = json.Unmarshal(schema.externalSchemaConfig, &srConfig)
	if err != nil {
		return nil, fmt.Errorf("unmarshal schema registry config: %w", err)
	}

	return &models.SchemaV2{
		ID:                   schema.id.String(),
		ConfigType:           models.SchemaConfigType(schema.configType),
		ExternalSchemaConfig: srConfig,
		DataFormat:           models.SchemaDataFormat(schema.dataFormat),
		SchemaType:           models.SchemaType(schema.schemaType),
	}, nil
}

// GetSchemaVersion - retrieves a specific schema version by schema ID and version
func (s *PostgresStorage) GetSchemaVersion(ctx context.Context, schemaID, version string) (*models.SchemaVersion, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	sv, err := s.getSchemaVersion(ctx, tx, schemaID, version)
	if err != nil {
		return nil, fmt.Errorf("get schema version: %w", err)
	}

	var schemaFields models.SchemaFields
	err = json.Unmarshal(sv.schemaFields, &schemaFields)
	if err != nil {
		return nil, fmt.Errorf("unmarshal schema fields: %w", err)
	}

	return &models.SchemaVersion{
		ID:           sv.id.String(),
		SchemaID:     sv.schemaID.String(),
		Version:      sv.version,
		Status:       sv.status,
		SchemaFields: schemaFields,
		CreatedAt:    sv.createdAt,
		UpdatedAt:    sv.updatedAt,
	}, nil
}

// GetLatestSchemaVersion - retrieves the latest schema version for a given schema ID
func (s *PostgresStorage) GetLatestSchemaVersion(ctx context.Context, schemaID string) (*models.SchemaVersion, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	sv, err := s.getLatestSchemaVersion(ctx, tx, schemaID)
	if err != nil {
		return nil, fmt.Errorf("get latest schema version: %w", err)
	}

	var schemaFields models.SchemaFields
	err = json.Unmarshal(sv.schemaFields, &schemaFields)
	if err != nil {
		return nil, fmt.Errorf("unmarshal schema fields: %w", err)
	}

	return &models.SchemaVersion{
		ID:           sv.id.String(),
		SchemaID:     sv.schemaID.String(),
		Version:      sv.version,
		Status:       sv.status,
		SchemaFields: schemaFields,
		CreatedAt:    sv.createdAt,
		UpdatedAt:    sv.updatedAt,
	}, nil
}

// SaveSchemaVersion - saves a new schema version along with its source and destination mappings
func (s *PostgresStorage) SaveSchemaVersion(ctx context.Context, schemaVersion models.SchemaVersion, sourceMappings, destinationMappings []*models.Mapping) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	schemaUUID, err := uuid.Parse(schemaVersion.SchemaID)
	if err != nil {
		return fmt.Errorf("invalid schema ID: %w", err)
	}

	// Lock the schema row to prevent concurrent insertions of the same version
	var schemaID uuid.UUID
	err = tx.QueryRow(ctx, `
		SELECT id FROM schemas WHERE id = $1 FOR UPDATE
	`, schemaUUID).Scan(&schemaID)
	if err != nil {
		return fmt.Errorf("lock schema: %w", err)
	}

	// Marshal schema fields
	schemaFieldsJSON, err := json.Marshal(schemaVersion.SchemaFields)
	if err != nil {
		return fmt.Errorf("marshal schema fields: %w", err)
	}

	// Insert schema version
	versionID, err := s.insertSchemaVersion(ctx, tx, schemaUUID, schemaVersion.Version, schemaVersion.Status, schemaFieldsJSON)
	if err != nil {
		return fmt.Errorf("insert schema version: %w", err)
	}

	// link schema version to source mappings
	for _, mapping := range sourceMappings {
		mappingUUID, err := uuid.Parse(mapping.ID)
		if err != nil {
			return fmt.Errorf("invalid source mapping ID: %w", err)
		}

		err = s.insertSchemaToMapping(ctx, tx, schemaUUID, versionID, mappingUUID, string(models.MappingOrientationSource))
		if err != nil {
			return fmt.Errorf("insert schema to source mapping: %w", err)
		}
	}

	// link schema version to destination mappings
	for _, mapping := range destinationMappings {
		mappingUUID, err := uuid.Parse(mapping.ID)
		if err != nil {
			return fmt.Errorf("invalid destination mapping ID: %w", err)
		}

		err = s.insertSchemaToMapping(ctx, tx, schemaUUID, versionID, mappingUUID, string(models.MappingOrientationDestination))
		if err != nil {
			return fmt.Errorf("insert schema to destination mapping: %w", err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit transaction: %w", err)
	}

	return nil
}

// GetMappingsBySchema - retrieves schema mappings for a given schema ID and orientation
func (s *PostgresStorage) GetMappingsBySchema(ctx context.Context, sourceID, schemaID string, orientation models.MappingOrintation) ([]*models.Mapping, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	return s.getMappingsBySchema(ctx, tx, schemaID, orientation)
}
