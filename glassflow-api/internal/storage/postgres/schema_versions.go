package postgres

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"

	"github.com/jackc/pgx/v5"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

func (s *PostgresStorage) upsertSchemaVersion(ctx context.Context, tx pgx.Tx, pipelineID, sourceID, version string, fields []models.Field) (string, error) {
	// If version is empty, auto-increment from the latest version
	if version == "" {
		var latestVersion string
		err := tx.QueryRow(ctx, `
			SELECT version_id FROM schema_versions 
			WHERE pipeline_id = $1 AND source_id = $2 
			ORDER BY CAST(version_id AS INTEGER) DESC LIMIT 1
		`, pipelineID, sourceID).Scan(&latestVersion)

		if err != nil && err != pgx.ErrNoRows {
			return "", fmt.Errorf("get latest version: %w", err)
		}

		// If no previous version exists, start with "1"
		if err == pgx.ErrNoRows || latestVersion == "" {
			version = "1"
		} else {
			// Parse and increment
			versionNum, parseErr := strconv.Atoi(latestVersion)
			if parseErr != nil {
				return "", fmt.Errorf("parse version '%s' as integer: %w", latestVersion, parseErr)
			}
			version = strconv.Itoa(versionNum + 1)
		}
	}

	fieldsJSON, err := json.Marshal(fields)
	if err != nil {
		return "", fmt.Errorf("marshal fields: %w", err)
	}

	var versionID string
	err = tx.QueryRow(ctx, `
		INSERT INTO schema_versions (pipeline_id, source_id, version_id, data_format, fields)
		VALUES ($1, $2, $3, 'json', $4)
		ON CONFLICT (pipeline_id, source_id, version_id)
		DO UPDATE SET fields = EXCLUDED.fields, updated_at = NOW()
		RETURNING version_id
	`, pipelineID, sourceID, version, fieldsJSON).Scan(&versionID)
	if err != nil {
		return "", fmt.Errorf("upsert schema version: %w", err)
	}

	return versionID, nil
}

func (s *PostgresStorage) getSchemaVersion(ctx context.Context, tx pgx.Tx, pipelineID, sourceID, version string) (zero models.SchemaVersion, _ error) {
	var (
		schemaVersion models.SchemaVersion
		fieldsJSON    []byte
		dataFormat    string
	)

	err := tx.QueryRow(ctx, `
		SELECT source_id, version_id, data_format, fields
		FROM schema_versions
		WHERE pipeline_id = $1 AND source_id = $2 AND version_id = $3
	`, pipelineID, sourceID, version).Scan(
		&schemaVersion.SourceID,
		&schemaVersion.VersionID,
		&dataFormat,
		&fieldsJSON,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return zero, models.ErrRecordNotFound
		}
		return zero, fmt.Errorf("get schema version: %w", err)
	}

	schemaVersion.DataType = models.SchemaDataFormat(dataFormat)

	if err := json.Unmarshal(fieldsJSON, &schemaVersion.Fields); err != nil {
		return zero, fmt.Errorf("unmarshal fields: %w", err)
	}

	return schemaVersion, nil
}

func (s *PostgresStorage) getLatestSchemaVersion(ctx context.Context, tx pgx.Tx, pipelineID, sourceID string) (zero models.SchemaVersion, _ error) {
	var (
		schemaVersion models.SchemaVersion
		fieldsJSON    []byte
		dataFormat    string
	)

	err := tx.QueryRow(ctx, `
		SELECT source_id, version_id, data_format, fields
		FROM schema_versions
		WHERE pipeline_id = $1 AND source_id = $2
		ORDER BY created_at DESC
		LIMIT 1
	`, pipelineID, sourceID).Scan(
		&schemaVersion.SourceID,
		&schemaVersion.VersionID,
		&dataFormat,
		&fieldsJSON,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return zero, models.ErrRecordNotFound
		}
		return zero, fmt.Errorf("get latest schema version: %w", err)
	}

	schemaVersion.DataType = models.SchemaDataFormat(dataFormat)

	if err := json.Unmarshal(fieldsJSON, &schemaVersion.Fields); err != nil {
		return zero, fmt.Errorf("unmarshal fields: %w", err)
	}

	return schemaVersion, nil
}
