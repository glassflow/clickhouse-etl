package postgres

import (
	"context"
	"encoding/json"
	"errors"
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
			ORDER BY created_at DESC LIMIT 1
		`, pipelineID, sourceID).Scan(&latestVersion)

		if err != nil && err != pgx.ErrNoRows {
			return "", fmt.Errorf("get latest version: %w", err)
		}

		// If no previous version exists, start with "1"
		if errors.Is(err, pgx.ErrNoRows) || latestVersion == "" {
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
		if errors.Is(err, pgx.ErrNoRows) {
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
		if errors.Is(err, pgx.ErrNoRows) {
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

func (s *PostgresStorage) GetSchemaVersion(ctx context.Context, pipelineID, sourceID, versionID string) (*models.SchemaVersion, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	schemaVersion, err := s.getSchemaVersion(ctx, tx, pipelineID, sourceID, versionID)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit transaction: %w", err)
	}

	return &schemaVersion, nil
}

func (s *PostgresStorage) GetLatestSchemaVersion(ctx context.Context, pipelineID, sourceID string) (*models.SchemaVersion, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	schemaVersion, err := s.getLatestSchemaVersion(ctx, tx, pipelineID, sourceID)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit transaction: %w", err)
	}

	return &schemaVersion, nil
}

func (s *PostgresStorage) SaveNewSchemaVersion(ctx context.Context, pipelineID, sourceID, oldVersionID, newVersionID string) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// Track items to process: (sourceID, oldVersionID, newVersionID)
	type propagationItem struct {
		sourceID     string
		oldVersionID string
		newVersionID string
	}

	var sv models.SchemaVersion
	var fieldsJSON []byte
	var dataFormat string

	// Lock the old schema version to prevent concurrent modifications
	err = tx.QueryRow(ctx, `
        SELECT source_id, version_id, data_format, fields
        FROM schema_versions
        WHERE pipeline_id = $1 AND source_id = $2 AND version_id = $3
        FOR UPDATE
    `, pipelineID, sourceID, oldVersionID).Scan(
		&sv.SourceID,
		&sv.VersionID,
		&dataFormat,
		&fieldsJSON,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return fmt.Errorf("schema version not found for source %s version %s", sourceID, oldVersionID)
		}
		return fmt.Errorf("lock schema version: %w", err)
	}

	// Create new schema version for initial source
	_, err = s.upsertSchemaVersion(ctx, tx, pipelineID, sourceID, newVersionID, sv.Fields)
	if err != nil {
		return fmt.Errorf("create new schema version for source %s: %w", sourceID, err)
	}

	// BFS queue for propagation
	queue := []propagationItem{{sourceID: sourceID, oldVersionID: oldVersionID, newVersionID: newVersionID}}
	visited := make(map[string]bool)

	for len(queue) > 0 {
		item := queue[0]
		queue = queue[1:]

		key := item.sourceID + ":" + item.oldVersionID
		if visited[key] {
			continue
		}
		visited[key] = true

		// Check for transformation_config
		tCfg, err := s.getStatelessTransformationConfig(ctx, tx, pipelineID, item.sourceID, item.oldVersionID)
		if err == nil {
			// Get the output component's source_id (transformation_id)
			componentSourceID := tCfg.TransfromationID

			// Get the component's current schema to copy fields
			compSchema, err := s.getSchemaVersion(ctx, tx, pipelineID, componentSourceID, tCfg.OutputSchemaVersionID)
			if err != nil {
				return fmt.Errorf("get schema for transformation %s: %w", componentSourceID, err)
			}

			// Step 5: Create new output schema version
			newOutputVersionID, err := s.upsertSchemaVersion(ctx, tx, pipelineID, componentSourceID, "", compSchema.Fields)
			if err != nil {
				return fmt.Errorf("create new schema version for transformation %s: %w", componentSourceID, err)
			}

			// Step 6: Create new transformation config
			err = s.insertStatelessTransformationConfig(ctx, tx, pipelineID, item.sourceID, item.newVersionID, componentSourceID, newOutputVersionID, tCfg.Config)
			if err != nil {
				return fmt.Errorf("create new transformation config for source %s: %w", item.sourceID, err)
			}

			// Step 4: Continue propagation with the component's output
			queue = append(queue, propagationItem{
				sourceID:     componentSourceID,
				oldVersionID: tCfg.OutputSchemaVersionID,
				newVersionID: newOutputVersionID,
			})
			continue
		} else if !errors.Is(err, models.ErrRecordNotFound) {
			return fmt.Errorf("get transformation config: %w", err)
		}

		// Check for join_config
		jCfg, err := s.getJoinConfig(ctx, tx, pipelineID, item.sourceID, item.oldVersionID)
		if err == nil {
			// Get the output component's source_id (join_id)
			componentSourceID := jCfg.JoinID

			// Get the component's current schema to copy fields
			compSchema, err := s.getSchemaVersion(ctx, tx, pipelineID, componentSourceID, jCfg.OutputSchemaVersionID)
			if err != nil {
				return fmt.Errorf("get schema for join %s: %w", componentSourceID, err)
			}

			// Create new output schema version
			newOutputVersionID, err := s.upsertSchemaVersion(ctx, tx, pipelineID, componentSourceID, "", compSchema.Fields)
			if err != nil {
				return fmt.Errorf("create new schema version for join %s: %w", componentSourceID, err)
			}

			// Find ALL join_configs for this join component with the same output version
			allJoinConfigs, err := s.getJoinConfigsByOutputVersion(ctx, tx, pipelineID, componentSourceID, jCfg.OutputSchemaVersionID)
			if err != nil {
				return fmt.Errorf("get all join configs for join %s: %w", componentSourceID, err)
			}

			// Create new join_config for each source
			for _, jc := range allJoinConfigs {
				newInputVersionID := jc.SourceSchemaVersionID
				if jc.SourceID == item.sourceID {
					// This is the source that triggered the change
					newInputVersionID = item.newVersionID
				}

				err = s.insertJoinConfig(ctx, tx, pipelineID, jc.SourceID, newInputVersionID, componentSourceID, newOutputVersionID, jc.Config)
				if err != nil {
					return fmt.Errorf("create new join config for source %s: %w", jc.SourceID, err)
				}
			}

			// Step 4: Continue propagation with the component's output
			queue = append(queue, propagationItem{
				sourceID:     componentSourceID,
				oldVersionID: jCfg.OutputSchemaVersionID,
				newVersionID: newOutputVersionID,
			})
			continue
		} else if !errors.Is(err, models.ErrRecordNotFound) {
			return fmt.Errorf("get join config: %w", err)
		}

		// Check for sink_config (terminal - no further propagation)
		sCfg, err := s.getSinkConfig(ctx, tx, pipelineID, item.sourceID, item.oldVersionID)
		if err == nil {
			// Step 6: Create new sink config
			err = s.insertSinkConfig(ctx, tx, pipelineID, item.sourceID, item.newVersionID, sCfg.Config)
			if err != nil {
				return fmt.Errorf("create new sink config for source %s: %w", item.sourceID, err)
			}
			// Sink is terminal, don't add to queue
		} else if !errors.Is(err, models.ErrRecordNotFound) {
			return fmt.Errorf("get sink config: %w", err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit transaction: %w", err)
	}

	return nil
}
