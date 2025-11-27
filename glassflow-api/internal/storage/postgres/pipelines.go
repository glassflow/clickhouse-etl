package postgres

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/service"
	"github.com/google/uuid"
)

// pipelineData holds all the data needed to reconstruct a PipelineConfig
type pipelineData struct {
	pipelineID      uuid.UUID
	name            string
	status          string
	source          map[string]interface{}
	kafkaConn       map[string]interface{}
	sink            map[string]interface{}
	chConn          map[string]interface{}
	transformations map[string]interface{}
	metadataJSON    []byte
	createdAt       time.Time
	updatedAt       time.Time
}

// GetPipeline retrieves a pipeline by ID and reconstructs PipelineConfig
func (s *PostgresStorage) GetPipeline(ctx context.Context, id string) (*models.PipelineConfig, error) {
	pipelineID, err := parsePipelineID(id)
	if err != nil {
		return nil, err
	}

	data, err := s.loadPipelineData(ctx, pipelineID)
	if err != nil {
		return nil, err
	}

	return s.reconstructPipelineFromData(ctx, data)
}

// GetPipelines retrieves all pipelines
func (s *PostgresStorage) GetPipelines(ctx context.Context) ([]models.PipelineConfig, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, name, status, source_id, sink_id, transformation_ids, metadata, created_at, updated_at
		FROM pipelines
		ORDER BY created_at DESC
	`)
	if err != nil {
		s.logger.ErrorContext(ctx, "failed to query pipelines",
			slog.String("error", err.Error()))
		return nil, fmt.Errorf("query pipelines: %w", err)
	}
	defer rows.Close()

	var pipelines []models.PipelineConfig
	for rows.Next() {
		var row pipelineRow
		var transformationIDsStr sql.NullString

		if err := rows.Scan(
			&row.pipelineID,
			&row.name,
			&row.status,
			&row.sourceID,
			&row.sinkID,
			&transformationIDsStr,
			&row.metadataJSON,
			&row.createdAt,
			&row.updatedAt,
		); err != nil {
			s.logger.ErrorContext(ctx, "failed to scan pipeline row",
				slog.String("error", err.Error()))
			return nil, fmt.Errorf("scan pipeline: %w", err)
		}

		// Parse PostgreSQL UUID array string
		if transformationIDsStr.Valid && transformationIDsStr.String != "" {
			transformationIDs, err := parsePostgresUUIDArray(transformationIDsStr.String)
			if err != nil {
				s.logger.ErrorContext(ctx, "failed to parse transformation IDs",
					slog.String("pipeline_id", row.pipelineID.String()),
					slog.String("transformation_ids_str", transformationIDsStr.String),
					slog.String("error", err.Error()))
				return nil, fmt.Errorf("parse transformation IDs: %w", err)
			}
			row.transformationIDsPtr = &transformationIDs
		}

		data, err := s.buildPipelineData(ctx, &row)
		if err != nil {
			s.logger.ErrorContext(ctx, "failed to build pipeline data",
				slog.String("pipeline_id", row.pipelineID.String()),
				slog.String("error", err.Error()))
			return nil, err
		}

		cfg, err := s.reconstructPipelineFromData(ctx, data)
		if err != nil {
			s.logger.ErrorContext(ctx, "failed to reconstruct pipeline config",
				slog.String("pipeline_id", row.pipelineID.String()),
				slog.String("error", err.Error()))
			return nil, fmt.Errorf("reconstruct pipeline config: %w", err)
		}

		pipelines = append(pipelines, *cfg)
	}

	return pipelines, nil
}

// reconstructPipelineFromData reconstructs a PipelineConfig from pipelineData
func (s *PostgresStorage) reconstructPipelineFromData(ctx context.Context, data *pipelineData) (*models.PipelineConfig, error) {
	return s.reconstructPipelineConfig(ctx, data)
}

// InsertPipeline inserts a new pipeline and its related entities
func (s *PostgresStorage) InsertPipeline(ctx context.Context, p models.PipelineConfig) error {
	s.logger.InfoContext(ctx, "inserting pipeline",
		slog.String("pipeline_id", p.ID),
		slog.String("pipeline_name", p.Name))

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		s.logger.ErrorContext(ctx, "failed to begin transaction",
			slog.String("pipeline_id", p.ID),
			slog.String("error", err.Error()))
		return fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Insert Kafka connection and source
	sourceID, err := s.insertKafkaSource(ctx, tx, p)
	if err != nil {
		s.logger.ErrorContext(ctx, "failed to insert kafka source",
			slog.String("pipeline_id", p.ID),
			slog.String("error", err.Error()))
		return err
	}

	// Insert ClickHouse connection and sink
	sinkID, err := s.insertClickHouseSink(ctx, tx, p)
	if err != nil {
		s.logger.ErrorContext(ctx, "failed to insert clickhouse sink",
			slog.String("pipeline_id", p.ID),
			slog.String("error", err.Error()))
		return err
	}

	// Insert transformations
	transformationIDs, err := s.insertTransformationsFromPipeline(ctx, tx, p)
	if err != nil {
		s.logger.ErrorContext(ctx, "failed to insert transformations",
			slog.String("pipeline_id", p.ID),
			slog.String("error", err.Error()))
		return err
	}

	// Prepare insert data
	insertData, err := s.preparePipelineInsertData(p, sourceID, sinkID, transformationIDs)
	if err != nil {
		s.logger.ErrorContext(ctx, "failed to prepare pipeline insert data",
			slog.String("pipeline_id", p.ID),
			slog.String("error", err.Error()))
		return err
	}

	// Insert pipeline
	_, err = tx.ExecContext(ctx, `
		INSERT INTO pipelines (id, name, status, source_id, sink_id, transformation_ids, metadata, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`, insertData.pipelineID, insertData.name, insertData.status, insertData.sourceID, insertData.sinkID, insertData.transformationIDsArg, insertData.metadataJSON, insertData.createdAt, insertData.updatedAt)
	if err != nil {
		s.logger.ErrorContext(ctx, "failed to insert pipeline",
			slog.String("pipeline_id", p.ID),
			slog.String("error", err.Error()))
		return fmt.Errorf("insert pipeline: %w", err)
	}

	// Build and insert schema
	schemaJSON, err := s.buildSchemaJSON(ctx, p)
	if err != nil {
		s.logger.ErrorContext(ctx, "failed to build schema JSON",
			slog.String("pipeline_id", p.ID),
			slog.String("error", err.Error()))
		return fmt.Errorf("build schema JSON: %w", err)
	}

	err = s.insertSchema(ctx, tx, insertData.pipelineID, schemaJSON, "v0", true)
	if err != nil {
		s.logger.ErrorContext(ctx, "failed to insert schema",
			slog.String("pipeline_id", p.ID),
			slog.String("error", err.Error()))
		return fmt.Errorf("insert schema: %w", err)
	}

	if err := tx.Commit(); err != nil {
		s.logger.ErrorContext(ctx, "failed to commit transaction",
			slog.String("pipeline_id", p.ID),
			slog.String("error", err.Error()))
		return fmt.Errorf("commit transaction: %w", err)
	}

	s.logger.InfoContext(ctx, "pipeline inserted successfully",
		slog.String("pipeline_id", p.ID),
		slog.String("pipeline_name", p.Name))

	return nil
}

// UpdatePipelineStatus updates the pipeline status
func (s *PostgresStorage) UpdatePipelineStatus(ctx context.Context, id string, status models.PipelineHealth) error {
	pipelineID, err := parsePipelineID(id)
	if err != nil {
		s.logger.ErrorContext(ctx, "invalid pipeline ID format",
			slog.String("pipeline_id", id),
			slog.String("error", err.Error()))
		return err
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		s.logger.ErrorContext(ctx, "failed to begin transaction",
			slog.String("pipeline_id", id),
			slog.String("error", err.Error()))
		return fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback()

	statusStr := string(status.OverallStatus)
	now := time.Now().UTC()

	result, err := tx.ExecContext(ctx, `
		UPDATE pipelines
		SET status = $1, updated_at = $2
		WHERE id = $3
	`, statusStr, now, pipelineID)
	if err != nil {
		s.logger.ErrorContext(ctx, "failed to update pipeline status",
			slog.String("pipeline_id", id),
			slog.String("status", statusStr),
			slog.String("error", err.Error()))
		return fmt.Errorf("update pipeline status: %w", err)
	}

	if err := checkRowsAffected(result); err != nil {
		s.logger.ErrorContext(ctx, "pipeline not found for status update",
			slog.String("pipeline_id", id),
			slog.String("error", err.Error()))
		return err
	}

	if err := tx.Commit(); err != nil {
		s.logger.ErrorContext(ctx, "failed to commit transaction",
			slog.String("pipeline_id", id),
			slog.String("error", err.Error()))
		return fmt.Errorf("commit transaction: %w", err)
	}

	s.logger.InfoContext(ctx, "pipeline status updated",
		slog.String("pipeline_id", id),
		slog.String("status", statusStr))

	return nil
}

// UpdatePipeline updates an existing pipeline
func (s *PostgresStorage) UpdatePipeline(ctx context.Context, id string, newCfg models.PipelineConfig) error {
	s.logger.InfoContext(ctx, "updating pipeline",
		slog.String("pipeline_id", id),
		slog.String("pipeline_name", newCfg.Name))

	// Get existing pipeline to verify it exists and get old IDs
	pipelineID, err := parsePipelineID(id)
	if err != nil {
		s.logger.ErrorContext(ctx, "invalid pipeline ID format",
			slog.String("pipeline_id", id),
			slog.String("error", err.Error()))
		return err
	}

	existingData, err := s.loadPipelineData(ctx, pipelineID)
	if err != nil {
		if errors.Is(err, service.ErrPipelineNotExists) {
			s.logger.DebugContext(ctx, "pipeline not found for update",
				slog.String("pipeline_id", id))
			return err
		}
		s.logger.ErrorContext(ctx, "failed to load existing pipeline",
			slog.String("pipeline_id", id),
			slog.String("error", err.Error()))
		return fmt.Errorf("load existing pipeline: %w", err)
	}

	// Get old IDs from existing pipeline row
	oldRow, err := s.loadPipelineRow(ctx, existingData.pipelineID)
	if err != nil {
		s.logger.ErrorContext(ctx, "failed to load pipeline row",
			slog.String("pipeline_id", id),
			slog.String("error", err.Error()))
		return fmt.Errorf("load pipeline row: %w", err)
	}

	// Get old transformation IDs
	oldTransformationIDs := handleTransformationIDs(oldRow.transformationIDsPtr)

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		s.logger.ErrorContext(ctx, "failed to begin transaction",
			slog.String("pipeline_id", id),
			slog.String("error", err.Error()))
		return fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Get connection IDs from existing source and sink
	var kafkaConnID, chConnID uuid.UUID
	err = tx.QueryRowContext(ctx, `
		SELECT connection_id FROM sources WHERE id = $1
	`, oldRow.sourceID).Scan(&kafkaConnID)
	if err != nil {
		s.logger.ErrorContext(ctx, "failed to get kafka connection ID",
			slog.String("pipeline_id", id),
			slog.String("source_id", oldRow.sourceID.String()),
			slog.String("error", err.Error()))
		return fmt.Errorf("get kafka connection ID: %w", err)
	}

	err = tx.QueryRowContext(ctx, `
		SELECT connection_id FROM sinks WHERE id = $1
	`, oldRow.sinkID).Scan(&chConnID)
	if err != nil {
		s.logger.ErrorContext(ctx, "failed to get clickhouse connection ID",
			slog.String("pipeline_id", id),
			slog.String("sink_id", oldRow.sinkID.String()),
			slog.String("error", err.Error()))
		return fmt.Errorf("get clickhouse connection ID: %w", err)
	}

	// Update Kafka connection and source
	err = s.updateKafkaSource(ctx, tx, kafkaConnID, oldRow.sourceID, newCfg)
	if err != nil {
		s.logger.ErrorContext(ctx, "failed to update kafka source",
			slog.String("pipeline_id", id),
			slog.String("error", err.Error()))
		return err
	}

	// Update ClickHouse connection and sink
	err = s.updateClickHouseSink(ctx, tx, chConnID, oldRow.sinkID, newCfg)
	if err != nil {
		s.logger.ErrorContext(ctx, "failed to update clickhouse sink",
			slog.String("pipeline_id", id),
			slog.String("error", err.Error()))
		return err
	}

	// Update transformations (match by type, update/delete/insert as needed)
	newTransformationIDs, err := s.updateTransformationsFromPipeline(ctx, tx, existingData.pipelineID, oldTransformationIDs, newCfg)
	if err != nil {
		s.logger.ErrorContext(ctx, "failed to update transformations",
			slog.String("pipeline_id", id),
			slog.String("error", err.Error()))
		return err
	}

	// Prepare update data
	updateData, err := s.preparePipelineUpdateData(newCfg, oldRow.sourceID, oldRow.sinkID, newTransformationIDs, oldRow.createdAt)
	if err != nil {
		s.logger.ErrorContext(ctx, "failed to prepare pipeline update data",
			slog.String("pipeline_id", id),
			slog.String("error", err.Error()))
		return err
	}

	// Update pipeline
	_, err = tx.ExecContext(ctx, `
		UPDATE pipelines
		SET name = $1, status = $2, transformation_ids = $3, metadata = $4, updated_at = $5
		WHERE id = $6
	`, updateData.name, updateData.status, updateData.transformationIDsArg, updateData.metadataJSON, updateData.updatedAt, updateData.pipelineID)
	if err != nil {
		s.logger.ErrorContext(ctx, "failed to update pipeline",
			slog.String("pipeline_id", id),
			slog.String("error", err.Error()))
		return fmt.Errorf("update pipeline: %w", err)
	}

	// Build and update schema
	schemaJSON, err := s.buildSchemaJSON(ctx, newCfg)
	if err != nil {
		s.logger.ErrorContext(ctx, "failed to build schema JSON",
			slog.String("pipeline_id", id),
			slog.String("error", err.Error()))
		return fmt.Errorf("build schema JSON: %w", err)
	}

	err = s.updateSchema(ctx, tx, existingData.pipelineID, schemaJSON)
	if err != nil {
		s.logger.ErrorContext(ctx, "failed to update schema",
			slog.String("pipeline_id", id),
			slog.String("error", err.Error()))
		return fmt.Errorf("update schema: %w", err)
	}

	if err := tx.Commit(); err != nil {
		s.logger.ErrorContext(ctx, "failed to commit transaction",
			slog.String("pipeline_id", id),
			slog.String("error", err.Error()))
		return fmt.Errorf("commit transaction: %w", err)
	}

	s.logger.InfoContext(ctx, "pipeline updated successfully",
		slog.String("pipeline_id", id),
		slog.String("pipeline_name", newCfg.Name))

	return nil
}

// PatchPipelineName updates only the pipeline name
func (s *PostgresStorage) PatchPipelineName(ctx context.Context, id, name string) error {
	pipelineID, err := parsePipelineID(id)
	if err != nil {
		s.logger.ErrorContext(ctx, "invalid pipeline ID format",
			slog.String("pipeline_id", id),
			slog.String("error", err.Error()))
		return err
	}

	result, err := s.db.ExecContext(ctx, `
		UPDATE pipelines
		SET name = $1, updated_at = NOW()
		WHERE id = $2
	`, name, pipelineID)
	if err != nil {
		s.logger.ErrorContext(ctx, "failed to update pipeline name",
			slog.String("pipeline_id", id),
			slog.String("new_name", name),
			slog.String("error", err.Error()))
		return fmt.Errorf("update pipeline name: %w", err)
	}

	if err := checkRowsAffected(result); err != nil {
		s.logger.ErrorContext(ctx, "pipeline not found for name update",
			slog.String("pipeline_id", id),
			slog.String("error", err.Error()))
		return err
	}

	s.logger.InfoContext(ctx, "pipeline name updated",
		slog.String("pipeline_id", id),
		slog.String("new_name", name))

	return nil
}

// PatchPipelineMetadata updates only the pipeline metadata
func (s *PostgresStorage) PatchPipelineMetadata(ctx context.Context, id string, metadata models.PipelineMetadata) error {
	pipelineID, err := parsePipelineID(id)
	if err != nil {
		s.logger.ErrorContext(ctx, "invalid pipeline ID format",
			slog.String("pipeline_id", id),
			slog.String("error", err.Error()))
		return err
	}

	metadataJSON, err := json.Marshal(metadata)
	if err != nil {
		s.logger.ErrorContext(ctx, "failed to marshal metadata",
			slog.String("pipeline_id", id),
			slog.String("error", err.Error()))
		return fmt.Errorf("marshal metadata: %w", err)
	}

	result, err := s.db.ExecContext(ctx, `
		UPDATE pipelines
		SET metadata = $1, updated_at = NOW()
		WHERE id = $2
	`, metadataJSON, pipelineID)
	if err != nil {
		s.logger.ErrorContext(ctx, "failed to update pipeline metadata",
			slog.String("pipeline_id", id),
			slog.String("error", err.Error()))
		return fmt.Errorf("update pipeline metadata: %w", err)
	}

	if err := checkRowsAffected(result); err != nil {
		s.logger.ErrorContext(ctx, "pipeline not found for metadata update",
			slog.String("pipeline_id", id),
			slog.String("error", err.Error()))
		return err
	}

	s.logger.InfoContext(ctx, "pipeline metadata updated",
		slog.String("pipeline_id", id))

	return nil
}

// DeletePipeline deletes a pipeline and all associated entities
func (s *PostgresStorage) DeletePipeline(ctx context.Context, id string) error {
	pipelineID, err := parsePipelineID(id)
	if err != nil {
		s.logger.ErrorContext(ctx, "invalid pipeline ID format",
			slog.String("pipeline_id", id),
			slog.String("error", err.Error()))
		return err
	}

	s.logger.InfoContext(ctx, "deleting pipeline",
		slog.String("pipeline_id", id))

	// Get pipeline row to find associated entity IDs
	row, err := s.loadPipelineRow(ctx, pipelineID)
	if err != nil {
		if errors.Is(err, service.ErrPipelineNotExists) {
			s.logger.DebugContext(ctx, "pipeline not found for deletion",
				slog.String("pipeline_id", id))
			return err
		}
		s.logger.ErrorContext(ctx, "failed to load pipeline row for deletion",
			slog.String("pipeline_id", id),
			slog.String("error", err.Error()))
		return fmt.Errorf("load pipeline row: %w", err)
	}

	// Get transformation IDs
	transformationIDs := handleTransformationIDs(row.transformationIDsPtr)

	// Get connection IDs from source and sink
	var kafkaConnID, chConnID uuid.UUID
	err = s.db.QueryRowContext(ctx, `
		SELECT connection_id FROM sources WHERE id = $1
	`, row.sourceID).Scan(&kafkaConnID)
	if err != nil {
		s.logger.ErrorContext(ctx, "failed to get kafka connection ID",
			slog.String("pipeline_id", id),
			slog.String("source_id", row.sourceID.String()),
			slog.String("error", err.Error()))
		return fmt.Errorf("get kafka connection ID: %w", err)
	}

	err = s.db.QueryRowContext(ctx, `
		SELECT connection_id FROM sinks WHERE id = $1
	`, row.sinkID).Scan(&chConnID)
	if err != nil {
		s.logger.ErrorContext(ctx, "failed to get clickhouse connection ID",
			slog.String("pipeline_id", id),
			slog.String("sink_id", row.sinkID.String()),
			slog.String("error", err.Error()))
		return fmt.Errorf("get clickhouse connection ID: %w", err)
	}

	// Begin transaction for atomic deletion
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		s.logger.ErrorContext(ctx, "failed to begin transaction",
			slog.String("pipeline_id", id),
			slog.String("error", err.Error()))
		return fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback()

	// 1. Delete transformations (no foreign key constraints)
	if len(transformationIDs) > 0 {
		_, err = tx.ExecContext(ctx, `
			DELETE FROM transformations WHERE id = ANY($1)
		`, transformationIDs)
		if err != nil {
			s.logger.ErrorContext(ctx, "failed to delete transformations",
				slog.String("pipeline_id", id),
				slog.String("error", err.Error()))
			return fmt.Errorf("delete transformations: %w", err)
		}
	}

	// 2. Delete pipeline (CASCADE will delete schemas and pipeline_history)
	result, err := tx.ExecContext(ctx, `
		DELETE FROM pipelines WHERE id = $1
	`, pipelineID)
	if err != nil {
		s.logger.ErrorContext(ctx, "failed to delete pipeline",
			slog.String("pipeline_id", id),
			slog.String("error", err.Error()))
		return fmt.Errorf("delete pipeline: %w", err)
	}

	if err := checkRowsAffected(result); err != nil {
		s.logger.ErrorContext(ctx, "pipeline not found for deletion",
			slog.String("pipeline_id", id),
			slog.String("error", err.Error()))
		return err
	}

	// 3. Delete sources (no longer referenced by pipeline)
	_, err = tx.ExecContext(ctx, `
		DELETE FROM sources WHERE id = $1
	`, row.sourceID)
	if err != nil {
		s.logger.ErrorContext(ctx, "failed to delete source",
			slog.String("pipeline_id", id),
			slog.String("source_id", row.sourceID.String()),
			slog.String("error", err.Error()))
		return fmt.Errorf("delete source: %w", err)
	}

	// 4. Delete sinks (no longer referenced by pipeline)
	_, err = tx.ExecContext(ctx, `
		DELETE FROM sinks WHERE id = $1
	`, row.sinkID)
	if err != nil {
		s.logger.ErrorContext(ctx, "failed to delete sink",
			slog.String("pipeline_id", id),
			slog.String("sink_id", row.sinkID.String()),
			slog.String("error", err.Error()))
		return fmt.Errorf("delete sink: %w", err)
	}

	// 5. Delete connections (no longer referenced by sources/sinks)
	_, err = tx.ExecContext(ctx, `
		DELETE FROM connections WHERE id = $1
	`, kafkaConnID)
	if err != nil {
		s.logger.ErrorContext(ctx, "failed to delete kafka connection",
			slog.String("pipeline_id", id),
			slog.String("connection_id", kafkaConnID.String()),
			slog.String("error", err.Error()))
		return fmt.Errorf("delete kafka connection: %w", err)
	}

	// Only delete ClickHouse connection if it's different from Kafka connection
	if chConnID != kafkaConnID {
		_, err = tx.ExecContext(ctx, `
			DELETE FROM connections WHERE id = $1
		`, chConnID)
		if err != nil {
			s.logger.ErrorContext(ctx, "failed to delete clickhouse connection",
				slog.String("pipeline_id", id),
				slog.String("connection_id", chConnID.String()),
				slog.String("error", err.Error()))
			return fmt.Errorf("delete clickhouse connection: %w", err)
		}
	}

	// Commit transaction
	if err := tx.Commit(); err != nil {
		s.logger.ErrorContext(ctx, "failed to commit transaction",
			slog.String("pipeline_id", id),
			slog.String("error", err.Error()))
		return fmt.Errorf("commit transaction: %w", err)
	}

	s.logger.InfoContext(ctx, "pipeline and all associated entities deleted successfully",
		slog.String("pipeline_id", id),
		slog.Int("transformations_deleted", len(transformationIDs)),
		slog.String("source_id", row.sourceID.String()),
		slog.String("sink_id", row.sinkID.String()))

	return nil
}

// ------------------------------------------------------------------------------------------------

// insertKafkaSource inserts Kafka connection and source
func (s *PostgresStorage) insertKafkaSource(ctx context.Context, tx *sql.Tx, p models.PipelineConfig) (uuid.UUID, error) {
	kafkaConnConfig := map[string]interface{}{
		"kafka_connection_params": p.Ingestor.KafkaConnectionParams,
		"kafka_topics":            p.Ingestor.KafkaTopics,
		"provider":                p.Ingestor.Provider,
	}
	kafkaConnID, err := s.insertConnectionWithConfig(ctx, tx, "kafka", kafkaConnConfig)
	if err != nil {
		return uuid.Nil, fmt.Errorf("insert kafka connection: %w", err)
	}

	sourceID, err := s.insertSource(ctx, tx, "kafka", kafkaConnID, p.Mapper.Streams)
	if err != nil {
		return uuid.Nil, fmt.Errorf("insert source: %w", err)
	}

	return sourceID, nil
}

// updateKafkaSource updates Kafka connection and source
func (s *PostgresStorage) updateKafkaSource(ctx context.Context, tx *sql.Tx, kafkaConnID uuid.UUID, sourceID uuid.UUID, p models.PipelineConfig) error {
	kafkaConnConfig := map[string]interface{}{
		"kafka_connection_params": p.Ingestor.KafkaConnectionParams,
		"kafka_topics":            p.Ingestor.KafkaTopics,
		"provider":                p.Ingestor.Provider,
	}
	err := s.updateConnectionWithConfig(ctx, tx, kafkaConnID, kafkaConnConfig)
	if err != nil {
		return fmt.Errorf("update kafka connection: %w", err)
	}

	err = s.updateSource(ctx, tx, sourceID, p.Mapper.Streams)
	if err != nil {
		return fmt.Errorf("update source: %w", err)
	}

	return nil
}

// insertClickHouseSink inserts ClickHouse connection and sink
func (s *PostgresStorage) insertClickHouseSink(ctx context.Context, tx *sql.Tx, p models.PipelineConfig) (uuid.UUID, error) {
	chConnConfig := map[string]interface{}{
		"clickhouse_connection_params": p.Sink.ClickHouseConnectionParams,
		"batch":                        p.Sink.Batch,
		"stream_id":                    p.Sink.StreamID,
	}
	chConnID, err := s.insertConnectionWithConfig(ctx, tx, "clickhouse", chConnConfig)
	if err != nil {
		return uuid.Nil, fmt.Errorf("insert clickhouse connection: %w", err)
	}

	sinkID, err := s.insertSink(ctx, tx, "clickhouse", chConnID, p.Mapper.SinkMapping)
	if err != nil {
		return uuid.Nil, fmt.Errorf("insert sink: %w", err)
	}

	return sinkID, nil
}

// updateClickHouseSink updates ClickHouse connection and sink
func (s *PostgresStorage) updateClickHouseSink(ctx context.Context, tx *sql.Tx, chConnID uuid.UUID, sinkID uuid.UUID, p models.PipelineConfig) error {
	chConnConfig := map[string]interface{}{
		"clickhouse_connection_params": p.Sink.ClickHouseConnectionParams,
		"batch":                        p.Sink.Batch,
		"stream_id":                    p.Sink.StreamID,
	}
	err := s.updateConnectionWithConfig(ctx, tx, chConnID, chConnConfig)
	if err != nil {
		return fmt.Errorf("update clickhouse connection: %w", err)
	}

	err = s.updateSink(ctx, tx, sinkID, p.Mapper.SinkMapping)
	if err != nil {
		return fmt.Errorf("update sink: %w", err)
	}

	return nil
}

// ------------------------------------------------------------------------------------------------

// pipelineInsertData holds data needed to insert a pipeline
type pipelineInsertData struct {
	pipelineID           uuid.UUID
	name                 string
	status               string
	sourceID             uuid.UUID
	sinkID               uuid.UUID
	transformationIDsArg interface{} // nil or []uuid.UUID
	metadataJSON         []byte
	createdAt            time.Time
	updatedAt            time.Time
}

// preparePipelineUpdateData prepares data for pipeline update
func (s *PostgresStorage) preparePipelineUpdateData(p models.PipelineConfig, sourceID, sinkID uuid.UUID, transformationIDs []uuid.UUID, oldCreatedAt time.Time) (*pipelineInsertData, error) {
	pipelineID, err := parsePipelineID(p.ID)
	if err != nil {
		return nil, err
	}

	status := string(p.Status.OverallStatus)
	if status == "" {
		status = "Created"
	}

	metadataJSON, err := json.Marshal(p.Metadata)
	if err != nil {
		return nil, fmt.Errorf("marshal metadata: %w", err)
	}

	var transformationIDsArg interface{}
	if len(transformationIDs) == 0 {
		transformationIDsArg = nil
	} else {
		transformationIDsArg = transformationIDs
	}

	return &pipelineInsertData{
		pipelineID:           pipelineID,
		name:                 p.Name,
		status:               status,
		sourceID:             sourceID,
		sinkID:               sinkID,
		transformationIDsArg: transformationIDsArg,
		metadataJSON:         metadataJSON,
		createdAt:            oldCreatedAt, // Preserve original created_at
		updatedAt:            time.Now().UTC(),
	}, nil
}

// preparePipelineInsertData prepares data for pipeline insertion
func (s *PostgresStorage) preparePipelineInsertData(p models.PipelineConfig, sourceID, sinkID uuid.UUID, transformationIDs []uuid.UUID) (*pipelineInsertData, error) {
	pipelineID, err := parsePipelineID(p.ID)
	if err != nil {
		return nil, err
	}

	status := string(p.Status.OverallStatus)
	if status == "" {
		status = "Created"
	}

	metadataJSON, err := json.Marshal(p.Metadata)
	if err != nil {
		return nil, fmt.Errorf("marshal metadata: %w", err)
	}

	var transformationIDsArg interface{}
	if len(transformationIDs) == 0 {
		transformationIDsArg = nil
	} else {
		transformationIDsArg = transformationIDs
	}

	return &pipelineInsertData{
		pipelineID:           pipelineID,
		name:                 p.Name,
		status:               status,
		sourceID:             sourceID,
		sinkID:               sinkID,
		transformationIDsArg: transformationIDsArg,
		metadataJSON:         metadataJSON,
		createdAt:            p.CreatedAt,
		updatedAt:            time.Now().UTC(),
	}, nil
}

// ------------------------------------------------------------------------------------------------

// pipelineRow represents a row from the pipelines table
type pipelineRow struct {
	pipelineID           uuid.UUID
	name                 string
	status               string
	sourceID             uuid.UUID
	sinkID               uuid.UUID
	transformationIDsPtr *[]uuid.UUID
	metadataJSON         []byte
	createdAt            time.Time
	updatedAt            time.Time
}

// loadPipelineRow loads a pipeline row from the database by ID
func (s *PostgresStorage) loadPipelineRow(ctx context.Context, pipelineID uuid.UUID) (*pipelineRow, error) {
	var row pipelineRow
	var transformationIDsStr sql.NullString

	err := s.db.QueryRowContext(ctx, `
		SELECT id, name, status, source_id, sink_id, transformation_ids, metadata, created_at, updated_at
		FROM pipelines
		WHERE id = $1
	`, pipelineID).Scan(
		&row.pipelineID,
		&row.name,
		&row.status,
		&row.sourceID,
		&row.sinkID,
		&transformationIDsStr,
		&row.metadataJSON,
		&row.createdAt,
		&row.updatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			s.logger.DebugContext(ctx, "pipeline not found",
				slog.String("pipeline_id", pipelineID.String()))
			return nil, service.ErrPipelineNotExists
		}
		s.logger.ErrorContext(ctx, "failed to load pipeline row",
			slog.String("pipeline_id", pipelineID.String()),
			slog.String("error", err.Error()))
		return nil, fmt.Errorf("get pipeline: %w", err)
	}

	// Parse PostgreSQL UUID array string
	if transformationIDsStr.Valid && transformationIDsStr.String != "" {
		transformationIDs, err := parsePostgresUUIDArray(transformationIDsStr.String)
		if err != nil {
			s.logger.ErrorContext(ctx, "failed to parse transformation IDs",
				slog.String("pipeline_id", pipelineID.String()),
				slog.String("transformation_ids_str", transformationIDsStr.String),
				slog.String("error", err.Error()))
			return nil, fmt.Errorf("parse transformation IDs: %w", err)
		}
		row.transformationIDsPtr = &transformationIDs
	}

	return &row, nil
}

// buildPipelineData builds pipelineData from a pipelineRow by loading related entities
func (s *PostgresStorage) buildPipelineData(ctx context.Context, row *pipelineRow) (*pipelineData, error) {
	transformationIDs := handleTransformationIDs(row.transformationIDsPtr)

	source, kafkaConn, err := s.getSource(ctx, row.sourceID)
	if err != nil {
		s.logger.ErrorContext(ctx, "failed to get source",
			slog.String("pipeline_id", row.pipelineID.String()),
			slog.String("source_id", row.sourceID.String()),
			slog.String("error", err.Error()))
		return nil, fmt.Errorf("get source: %w", err)
	}

	sink, chConn, err := s.getSink(ctx, row.sinkID)
	if err != nil {
		s.logger.ErrorContext(ctx, "failed to get sink",
			slog.String("pipeline_id", row.pipelineID.String()),
			slog.String("sink_id", row.sinkID.String()),
			slog.String("error", err.Error()))
		return nil, fmt.Errorf("get sink: %w", err)
	}

	var transformations map[string]interface{}
	if len(transformationIDs) > 0 {
		transformations, err = s.getTransformations(ctx, transformationIDs)
		if err != nil {
			s.logger.ErrorContext(ctx, "failed to get transformations",
				slog.String("pipeline_id", row.pipelineID.String()),
				slog.String("error", err.Error()))
			return nil, fmt.Errorf("get transformations: %w", err)
		}
	} else {
		transformations = make(map[string]interface{})
	}

	return &pipelineData{
		pipelineID:      row.pipelineID,
		name:            row.name,
		status:          row.status,
		source:          source,
		kafkaConn:       kafkaConn,
		sink:            sink,
		chConn:          chConn,
		transformations: transformations,
		metadataJSON:    row.metadataJSON,
		createdAt:       row.createdAt,
		updatedAt:       row.updatedAt,
	}, nil
}

// loadPipelineData loads pipeline data from database and returns all components needed for reconstruction
func (s *PostgresStorage) loadPipelineData(ctx context.Context, pipelineID uuid.UUID) (*pipelineData, error) {
	row, err := s.loadPipelineRow(ctx, pipelineID)
	if err != nil {
		return nil, err
	}

	return s.buildPipelineData(ctx, row)
}
