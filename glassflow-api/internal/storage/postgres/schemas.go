package postgres

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// buildSchemaJSON reconstructs the schema JSON from PipelineConfig.Mapper
func (s *PostgresStorage) buildSchemaJSON(ctx context.Context, p models.PipelineConfig) ([]byte, error) {
	type schemaField struct {
		SourceID   string `json:"source_id"`
		Name       string `json:"name"`
		Type       string `json:"type"`
		ColumnName string `json:"column_name"`
		ColumnType string `json:"column_type"`
	}

	type schema struct {
		Fields []schemaField `json:"fields"`
	}

	schemaFields := make([]schemaField, 0)
	fieldMap := make(map[string]bool) // Track duplicates: streamName:fieldName

	// Build schema fields from MapperConfig.Streams and MapperConfig.SinkMapping
	for streamName, streamConfig := range p.Mapper.Streams {
		for _, field := range streamConfig.Fields {
			key := streamName + ":" + field.FieldName
			if !fieldMap[key] {
				// Find corresponding sink mapping for column info
				var columnName, columnType string
				for _, mapping := range p.Mapper.SinkMapping {
					if mapping.StreamName == streamName && mapping.FieldName == field.FieldName {
						columnName = mapping.ColumnName
						columnType = mapping.ColumnType
						break
					}
				}

				schemaFields = append(schemaFields, schemaField{
					SourceID:   streamName,
					Name:       field.FieldName,
					Type:       field.FieldType,
					ColumnName: columnName,
					ColumnType: columnType,
				})
				fieldMap[key] = true
			}
		}
	}

	schemaData := schema{
		Fields: schemaFields,
	}

	schemaJSON, err := json.Marshal(schemaData)
	if err != nil {
		s.logger.ErrorContext(ctx, "failed to marshal schema JSON",
			slog.String("pipeline_id", p.ID),
			slog.Int("field_count", len(schemaFields)),
			slog.String("error", err.Error()))
		return nil, fmt.Errorf("marshal schema: %w", err)
	}

	return schemaJSON, nil
}

// insertSchema inserts a schema into the schemas table
func (s *PostgresStorage) insertSchema(ctx context.Context, tx pgx.Tx, pipelineID uuid.UUID, schemaJSON []byte, version, status string) error {

	_, err := tx.Exec(ctx, `
		INSERT INTO schemas (pipeline_id, version, active, schema_data, created_at, updated_at)
		VALUES ($1, $2, $3, $4, NOW(), NOW())
	`, pipelineID, version, status, schemaJSON)
	if err != nil {
		s.logger.ErrorContext(ctx, "failed to insert schema",
			slog.String("pipeline_id", pipelineID.String()),
			slog.String("version", version),
			slog.String("active_status", status),
			slog.String("error", err.Error()))
		return fmt.Errorf("insert schema: %w", err)
	}

	return nil
}

// updateSchema updates the existing schema with version "v0" for the given pipeline
// NOTE: With schema evolution, updates to schema should be versioned (create new versions instead of updating)
func (s *PostgresStorage) updateSchema(ctx context.Context, tx pgx.Tx, pipelineID uuid.UUID, schemaJSON []byte) error {
	commandTag, err := tx.Exec(ctx, `
		UPDATE schemas
		SET schema_data = $1, updated_at = NOW()
		WHERE pipeline_id = $2 AND version = 'v0'
	`, schemaJSON, pipelineID)
	if err != nil {
		s.logger.ErrorContext(ctx, "failed to update schema",
			slog.String("pipeline_id", pipelineID.String()),
			slog.String("error", err.Error()))
		return fmt.Errorf("update schema: %w", err)
	}

	if commandTag.RowsAffected() == 0 {
		// Schema with v0 doesn't exist, insert it
		err = s.insertSchema(ctx, tx, pipelineID, schemaJSON, "v0", schemaStatusActive)
		if err != nil {
			return fmt.Errorf("insert schema: %w", err)
		}
	}

	return nil
}
