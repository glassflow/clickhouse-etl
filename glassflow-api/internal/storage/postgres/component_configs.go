package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

func (s *PostgresStorage) insertStatelessTransformationConfig(ctx context.Context, tx pgx.Tx, pipelineID, sourceID, sourceSchemaVersionID, transformationID, outputSchemaVersionID string, config []models.Transform) error {
	configJSON, err := json.Marshal(config)
	if err != nil {
		return fmt.Errorf("marshal transformation config: %w", err)
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO transformation_configs (pipeline_id, source_id, schema_version_id, transformation_id, output_schema_version_id, config)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, pipelineID, sourceID, sourceSchemaVersionID, transformationID, outputSchemaVersionID, configJSON)
	if err != nil {
		return fmt.Errorf("insert transformation config: %w", err)
	}

	return nil
}

func (s *PostgresStorage) updateStatelessTransformationConfig(ctx context.Context, tx pgx.Tx, pipelineID, sourceID, sourceSchemaVersionID string, config []models.Transform) error {
	configJSON, err := json.Marshal(config)
	if err != nil {
		return fmt.Errorf("marshal transformation config: %w", err)
	}

	_, err = tx.Exec(ctx, `
		UPDATE transformation_configs
		SET config = $1, updated_at = NOW()
		WHERE pipeline_id = $2 AND source_id = $3 AND schema_version_id = $4
	`, configJSON, pipelineID, sourceID, sourceSchemaVersionID)
	if err != nil {
		return fmt.Errorf("update transformation config: %w", err)
	}

	return nil
}

func (s *PostgresStorage) getStatelessTransformationConfig(ctx context.Context, tx pgx.Tx, pipelineID, sourceID, sourceSchemaVersion string) (*models.TransformationConfig, error) {
	var (
		result     models.TransformationConfig
		configJSON []byte
	)

	err := tx.QueryRow(ctx, `
		SELECT source_id, schema_version_id, transformation_id, output_schema_version_id, config
		FROM transformation_configs
		WHERE pipeline_id = $1 AND source_id = $2 AND schema_version_id = $3
	`, pipelineID, sourceID, sourceSchemaVersion).Scan(
		&result.SourceID,
		&result.SourceSchemaVersionID,
		&result.TransformationID,
		&result.OutputSchemaVersionID,
		&configJSON,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrRecordNotFound
		}
		return nil, fmt.Errorf("get transformation config: %w", err)
	}

	if err := json.Unmarshal(configJSON, &result.Config); err != nil {
		return nil, fmt.Errorf("unmarshal transformation config: %w", err)
	}

	return &result, nil
}

func (s *PostgresStorage) insertJoinConfig(ctx context.Context, tx pgx.Tx, pipelineID, sourceID, sourceSchemaVersionID, joinID, outputSchemaVersionID string, config []models.JoinRule) error {
	configJSON, err := json.Marshal(config)
	if err != nil {
		return fmt.Errorf("marshal join config: %w", err)
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO join_configs (pipeline_id, source_id, schema_version_id, join_id, output_schema_version_id, config)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, pipelineID, sourceID, sourceSchemaVersionID, joinID, outputSchemaVersionID, configJSON)
	if err != nil {
		return fmt.Errorf("insert join config: %w", err)
	}

	return nil
}

func (s *PostgresStorage) upsertJoinConfig(
	ctx context.Context,
	tx pgx.Tx,
	pipelineID, sourceID, sourceSchemaVersionID, joinID, outputSchemaVersionID string,
	config []models.JoinRule,
) error {
	configJSON, err := json.Marshal(config)
	if err != nil {
		return fmt.Errorf("marshal join config: %w", err)
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO join_configs (
			pipeline_id, source_id, schema_version_id, join_id, output_schema_version_id, config
		)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (pipeline_id, source_id, schema_version_id, join_id, output_schema_version_id)
		DO UPDATE
		SET config = EXCLUDED.config,
		    updated_at = NOW()
	`, pipelineID, sourceID, sourceSchemaVersionID, joinID, outputSchemaVersionID, configJSON)
	if err != nil {
		return fmt.Errorf("upsert join config: %w", err)
	}

	return nil
}

func (s *PostgresStorage) getJoinConfig(ctx context.Context, tx pgx.Tx, pipelineID, sourceID, sourceSchemaVersion string) (*models.JoinConfig, error) {
	var (
		result     models.JoinConfig
		configJSON []byte
	)

	err := tx.QueryRow(ctx, `
		SELECT source_id, schema_version_id, join_id, output_schema_version_id, config
		FROM join_configs
		WHERE pipeline_id = $1 AND source_id = $2 AND schema_version_id = $3
	`, pipelineID, sourceID, sourceSchemaVersion).Scan(
		&result.SourceID,
		&result.SourceSchemaVersionID,
		&result.JoinID,
		&result.OutputSchemaVersionID,
		&configJSON,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrRecordNotFound
		}
		return nil, fmt.Errorf("get join config: %w", err)
	}

	if err := json.Unmarshal(configJSON, &result.Config); err != nil {
		return nil, fmt.Errorf("unmarshal join config: %w", err)
	}

	return &result, nil
}

func (s *PostgresStorage) getJoinConfigsByOutputVersion(ctx context.Context, tx pgx.Tx, pipelineID, joinID, outputSchemaVersionID string) ([]models.JoinConfig, error) {
	rows, err := tx.Query(ctx, `
        SELECT source_id, schema_version_id, join_id, output_schema_version_id, config
        FROM join_configs
        WHERE pipeline_id = $1 AND join_id = $2 AND output_schema_version_id = $3
    `, pipelineID, joinID, outputSchemaVersionID)
	if err != nil {
		return nil, fmt.Errorf("query join configs: %w", err)
	}
	defer rows.Close()

	var configs []models.JoinConfig
	for rows.Next() {
		var cfg models.JoinConfig
		var configJSON []byte
		if err := rows.Scan(&cfg.SourceID, &cfg.SourceSchemaVersionID, &cfg.JoinID, &cfg.OutputSchemaVersionID, &configJSON); err != nil {
			return nil, fmt.Errorf("scan join config: %w", err)
		}
		if err := json.Unmarshal(configJSON, &cfg.Config); err != nil {
			return nil, fmt.Errorf("unmarshal join config: %w", err)
		}
		configs = append(configs, cfg)
	}

	return configs, nil
}

func (s *PostgresStorage) getJoinIDAndOutputSchemaID(ctx context.Context, tx pgx.Tx, pipelineID, leftSourceID, leftSchemaVersionID, rightSourceID, rightSchemaVersionID string) (string, string, error) {
	var joinID, outputSchemaVersionID string
	err := tx.QueryRow(ctx, `
		SELECT jc1.join_id, jc1.output_schema_version_id
		FROM join_configs jc1
		INNER JOIN join_configs jc2
			ON jc1.pipeline_id = jc2.pipeline_id
			AND jc1.join_id = jc2.join_id
			AND jc1.output_schema_version_id = jc2.output_schema_version_id
		WHERE jc1.pipeline_id = $1
			AND jc1.source_id = $2 AND jc1.schema_version_id = $3
			AND jc2.source_id = $4 AND jc2.schema_version_id = $5
	`, pipelineID, leftSourceID, leftSchemaVersionID, rightSourceID, rightSchemaVersionID).Scan(&joinID, &outputSchemaVersionID)
	if err != nil {
		return "", "", fmt.Errorf("query join config intersection: %w", err)
	}

	return joinID, outputSchemaVersionID, err
}

func (s *PostgresStorage) insertSinkConfig(ctx context.Context, tx pgx.Tx, pipelineID, sourceID, sourceSchemaVersionID string, config []models.Mapping) error {
	configJSON, err := json.Marshal(config)
	if err != nil {
		return fmt.Errorf("marshal sink config: %w", err)
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO sink_configs (pipeline_id, source_id, schema_version_id, config)
		VALUES ($1, $2, $3, $4)
	`, pipelineID, sourceID, sourceSchemaVersionID, configJSON)
	if err != nil {
		return fmt.Errorf("insert sink config: %w", err)
	}

	return nil
}

func (s *PostgresStorage) upsertSinkConfig(
	ctx context.Context,
	tx pgx.Tx,
	pipelineID, sourceID, sourceSchemaVersionID string,
	config []models.Mapping,
) error {
	configJSON, err := json.Marshal(config)
	if err != nil {
		return fmt.Errorf("marshal sink config: %w", err)
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO sink_configs (pipeline_id, source_id, schema_version_id, config)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (pipeline_id, source_id, schema_version_id)
		DO UPDATE
		SET config = EXCLUDED.config,
		    updated_at = NOW()
	`, pipelineID, sourceID, sourceSchemaVersionID, configJSON)
	if err != nil {
		return fmt.Errorf("upsert sink config: %w", err)
	}

	return nil
}

func (s *PostgresStorage) getSinkConfig(ctx context.Context, tx pgx.Tx, pipelineID, sourceID, sourceSchemaVersion string) (*models.SinkConfig, error) {
	var (
		result     models.SinkConfig
		configJSON []byte
	)

	err := tx.QueryRow(ctx, `
		SELECT source_id, schema_version_id, config
		FROM sink_configs
		WHERE pipeline_id = $1 AND source_id = $2 AND schema_version_id = $3
	`, pipelineID, sourceID, sourceSchemaVersion).Scan(
		&result.SourceID,
		&result.SourceSchemaVersionID,
		&configJSON,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrRecordNotFound
		}
		return nil, fmt.Errorf("get sink config: %w", err)
	}

	if err := json.Unmarshal(configJSON, &result.Config); err != nil {
		return nil, fmt.Errorf("unmarshal sink config: %w", err)
	}

	return &result, nil
}

func (s *PostgresStorage) GetStatelessTransformationConfig(ctx context.Context, pipelineID, sourceID, sourceSchemaVersion string) (*models.TransformationConfig, error) {
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{
		IsoLevel: pgx.ReadCommitted,
	})
	if err != nil {
		return nil, fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	config, err := s.getStatelessTransformationConfig(ctx, tx, pipelineID, sourceID, sourceSchemaVersion)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit transaction: %w", err)
	}

	return config, nil
}

func (s *PostgresStorage) GetJoinConfig(ctx context.Context, pipelineID, sourceID, sourceSchemaVersion string) (*models.JoinConfig, error) {
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{
		IsoLevel: pgx.ReadCommitted,
	})
	if err != nil {
		return nil, fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	config, err := s.getJoinConfig(ctx, tx, pipelineID, sourceID, sourceSchemaVersion)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit transaction: %w", err)
	}

	return config, nil
}

func (s *PostgresStorage) GetJoinConfigs(ctx context.Context, pipelineID, leftSourceID, leftSchemaVersionID, rightSourceID, rightSchemaVersionID string) ([]models.JoinConfig, error) {
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{
		IsoLevel: pgx.ReadCommitted,
	})
	if err != nil {
		return nil, fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// Find intersection of (join_id, output_schema_version_id) pairs for both sources
	joinID, outputSchemaVersionID, err := s.getJoinIDAndOutputSchemaID(ctx, tx, pipelineID, leftSourceID, leftSchemaVersionID, rightSourceID, rightSchemaVersionID)
	if err != nil {
		return nil, err
	}

	// Get all join_configs for this join_id and output_schema_version_id
	configs, err := s.getJoinConfigsByOutputVersion(ctx, tx, pipelineID, joinID, outputSchemaVersionID)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit transaction: %w", err)
	}

	return configs, nil
}

func (s *PostgresStorage) GetSinkConfig(ctx context.Context, pipelineID, sourceID, sourceSchemaVersion string) (*models.SinkConfig, error) {
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{
		IsoLevel: pgx.ReadCommitted,
	})
	if err != nil {
		return nil, fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	config, err := s.getSinkConfig(ctx, tx, pipelineID, sourceID, sourceSchemaVersion)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit transaction: %w", err)
	}

	return config, nil
}
