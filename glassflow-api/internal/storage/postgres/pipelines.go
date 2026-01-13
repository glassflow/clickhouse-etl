package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/service"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

const (
	schemaStatusActive   = "Active"
	schemaStatusInactive = "Inactive"
	schemaStatusInvalid  = "Invalid"
)

// Transformation represents a pipeline transformation with its type and configuration
type Transformation struct {
	Type   string
	Config json.RawMessage
}

// HistoryEntry represents a pipeline history entry
type HistoryEntry struct {
	Type     string          // "history", "error", or "status"
	Pipeline json.RawMessage // Full pipeline JSON
	Errors   []string        // Array of error messages (for error type)
}

// pipelineData holds all the data needed to reconstruct a PipelineConfig
type pipelineData struct {
	pipelineID      string
	name            string
	status          string
	source          json.RawMessage
	kafkaConn       json.RawMessage
	sink            json.RawMessage
	chConn          json.RawMessage
	transformations map[string]Transformation
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
	rows, err := s.pool.Query(ctx, `
		SELECT id, name, status, source_id, sink_id, transformation_ids, metadata, created_at, updated_at
		FROM pipelines
		ORDER BY created_at DESC
	`)
	if err != nil {
		return nil, fmt.Errorf("query pipelines: %w", err)
	}
	defer rows.Close()

	var pipelines []models.PipelineConfig
	for rows.Next() {
		var row pipelineRow
		var transformationIDsArray pgtype.Array[pgtype.UUID]

		if err := rows.Scan(
			&row.pipelineID,
			&row.name,
			&row.status,
			&row.sourceID,
			&row.sinkID,
			&transformationIDsArray,
			&row.metadataJSON,
			&row.createdAt,
			&row.updatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan pipeline: %w", err)
		}

		// Convert pgtype UUID array to []uuid.UUID
		if transformationIDsArray.Valid {
			transformationIDs := make([]uuid.UUID, 0, len(transformationIDsArray.Elements))
			for _, elem := range transformationIDsArray.Elements {
				if elem.Valid {
					transformationIDs = append(transformationIDs, elem.Bytes)
				}
			}
			row.transformationIDsPtr = &transformationIDs
		}

		data, err := s.buildPipelineData(ctx, &row)
		if err != nil {
			return nil, err
		}

		cfg, err := s.reconstructPipelineFromData(ctx, data)
		if err != nil {
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

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// Insert Kafka connection and source
	sourceID, err := s.insertKafkaSource(ctx, tx, p)
	if err != nil {
		return err
	}

	// Insert ClickHouse connection and sink
	sinkID, err := s.insertClickHouseSink(ctx, tx, p)
	if err != nil {
		return err
	}

	// Insert transformations
	transformationIDs, err := s.insertTransformationsFromPipeline(ctx, tx, p)
	if err != nil {
		return err
	}

	// Prepare insert data
	insertData, err := s.preparePipelineInsertData(p, sourceID, sinkID, transformationIDs)
	if err != nil {
		return err
	}

	// Insert pipeline
	_, err = tx.Exec(ctx, `
		INSERT INTO pipelines (id, name, status, source_id, sink_id, transformation_ids, metadata, version, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`, insertData.pipelineID, insertData.name, insertData.status, insertData.sourceID, insertData.sinkID, insertData.transformationIDsArg, insertData.metadataJSON, "v2", insertData.createdAt, insertData.updatedAt)
	if err != nil {
		return fmt.Errorf("insert pipeline: %w", err)
	}

	// Build and insert schema
	schemaJSON, err := s.buildSchemaJSON(ctx, p)
	if err != nil {
		return fmt.Errorf("build schema JSON: %w", err)
	}

	err = s.insertSchema(ctx, tx, insertData.pipelineID, schemaJSON, "v0", schemaStatusActive)
	if err != nil {
		return fmt.Errorf("insert schema: %w", err)
	}

	// Insert pipeline history event
	err = s.insertPipelineHistoryEvent(ctx, tx, insertData.pipelineID, p, "history", nil)
	if err != nil {
		return fmt.Errorf("insert pipeline history event: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
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

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	statusStr := string(status.OverallStatus)
	now := time.Now().UTC()

	commandTag, err := tx.Exec(ctx, `
		UPDATE pipelines
		SET status = $1, updated_at = $2
		WHERE id = $3
	`, statusStr, now, pipelineID)
	if err != nil {
		return fmt.Errorf("update pipeline status: %w", err)
	}

	if err := checkRowsAffected(commandTag.RowsAffected()); err != nil {
		return err
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit transaction: %w", err)
	}

	// Insert status history event in a separate transaction (non-blocking)
	// History insertion failure should not block status updates
	go func() {
		historyCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		pipeline, err := s.GetPipeline(historyCtx, id)
		if err != nil {
			s.logger.WarnContext(historyCtx, "failed to get pipeline for status history",
				slog.String("pipeline_id", id),
				slog.String("error", err.Error()))
			return
		}

		historyTx, err := s.pool.Begin(historyCtx)
		if err != nil {
			s.logger.WarnContext(historyCtx, "failed to begin transaction for status history",
				slog.String("pipeline_id", id),
				slog.String("error", err.Error()))
			return
		}
		defer historyTx.Rollback(historyCtx)

		err = s.insertPipelineHistoryEvent(historyCtx, historyTx, pipelineID, *pipeline, "status", nil)
		if err != nil {
			s.logger.WarnContext(historyCtx, "failed to insert status history event",
				slog.String("pipeline_id", id),
				slog.String("error", err.Error()))
			return
		}

		if err := historyTx.Commit(historyCtx); err != nil {
			s.logger.WarnContext(historyCtx, "failed to commit status history transaction",
				slog.String("pipeline_id", id),
				slog.String("error", err.Error()))
			return
		}
	}()

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
			return err
		}
		return fmt.Errorf("load existing pipeline: %w", err)
	}

	// Get old IDs from existing pipeline row
	oldRow, err := s.loadPipelineRow(ctx, existingData.pipelineID)
	if err != nil {
		return fmt.Errorf("load pipeline row: %w", err)
	}

	// Get old transformation IDs
	oldTransformationIDs := handleTransformationIDs(oldRow.transformationIDsPtr)

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// Get connection IDs from existing source and sink
	var kafkaConnID, chConnID uuid.UUID
	err = tx.QueryRow(ctx, `
		SELECT connection_id FROM sources WHERE id = $1
	`, oldRow.sourceID).Scan(&kafkaConnID)
	if err != nil {
		return fmt.Errorf("get kafka connection ID: %w", err)
	}

	err = tx.QueryRow(ctx, `
		SELECT connection_id FROM sinks WHERE id = $1
	`, oldRow.sinkID).Scan(&chConnID)
	if err != nil {
		return fmt.Errorf("get clickhouse connection ID: %w", err)
	}

	// Update Kafka connection and source
	err = s.updateKafkaSource(ctx, tx, kafkaConnID, oldRow.sourceID, newCfg)
	if err != nil {
		return err
	}

	// Update ClickHouse connection and sink
	err = s.updateClickHouseSink(ctx, tx, chConnID, oldRow.sinkID, newCfg)
	if err != nil {
		return err
	}

	// Update transformations (match by type, update/delete/insert as needed)
	newTransformationIDs, err := s.updateTransformationsFromPipeline(ctx, tx, existingData.pipelineID, oldTransformationIDs, newCfg)
	if err != nil {
		return err
	}

	// Prepare update data
	updateData, err := s.preparePipelineUpdateData(newCfg, oldRow.sourceID, oldRow.sinkID, newTransformationIDs, oldRow.createdAt)
	if err != nil {
		return err
	}

	// Update pipeline
	_, err = tx.Exec(ctx, `
		UPDATE pipelines
		SET name = $1, status = $2, transformation_ids = $3, metadata = $4, version = $5, updated_at = $6
		WHERE id = $7
	`, updateData.name, updateData.status, updateData.transformationIDsArg, updateData.metadataJSON, "v2", updateData.updatedAt, updateData.pipelineID)
	if err != nil {
		return fmt.Errorf("update pipeline: %w", err)
	}

	// Build and update schema
	schemaJSON, err := s.buildSchemaJSON(ctx, newCfg)
	if err != nil {
		return fmt.Errorf("build schema JSON: %w", err)
	}

	err = s.updateSchema(ctx, tx, existingData.pipelineID, schemaJSON)
	if err != nil {
		return fmt.Errorf("update schema: %w", err)
	}

	// Insert pipeline history event
	err = s.insertPipelineHistoryEvent(ctx, tx, existingData.pipelineID, newCfg, "history", nil)
	if err != nil {
		return fmt.Errorf("insert pipeline history event: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
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
		return err
	}

	commandTag, err := s.pool.Exec(ctx, `
		UPDATE pipelines
		SET name = $1, updated_at = NOW()
		WHERE id = $2
	`, name, pipelineID)
	if err != nil {
		return fmt.Errorf("update pipeline name: %w", err)
	}

	if err := checkRowsAffected(commandTag.RowsAffected()); err != nil {
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
		return err
	}

	metadataJSON, err := json.Marshal(metadata)
	if err != nil {
		return fmt.Errorf("marshal metadata: %w", err)
	}

	commandTag, err := s.pool.Exec(ctx, `
		UPDATE pipelines
		SET metadata = $1, updated_at = NOW()
		WHERE id = $2
	`, metadataJSON, pipelineID)
	if err != nil {
		return fmt.Errorf("update pipeline metadata: %w", err)
	}

	if err := checkRowsAffected(commandTag.RowsAffected()); err != nil {
		return err
	}

	s.logger.InfoContext(ctx, "pipeline metadata updated",
		slog.String("pipeline_id", id))

	return nil
}

// insertPipelineHistoryEvent inserts a pipeline history event
func (s *PostgresStorage) insertPipelineHistoryEvent(ctx context.Context, tx pgx.Tx, pipelineID string, pipeline models.PipelineConfig, eventType string, errors []string) error {
	// Default to "history" if not specified
	if eventType == "" {
		eventType = "history"
	}

	// Marshal entire pipeline to JSON
	pipelineJSON, err := json.Marshal(pipeline)
	if err != nil {
		return fmt.Errorf("marshal pipeline for history: %w", err)
	}

	// Build event object matching HistoryEntry structure
	event := HistoryEntry{
		Type:     eventType,
		Pipeline: pipelineJSON,
		Errors:   errors,
	}

	eventJSON, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("marshal pipeline history event: %w", err)
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO pipeline_history (pipeline_id, type, event)
		VALUES ($1, $2, $3)
	`, pipelineID, eventType, eventJSON)
	if err != nil {
		return fmt.Errorf("insert pipeline history event: %w", err)
	}

	return nil
}

// DeletePipeline deletes a pipeline and all associated entities
func (s *PostgresStorage) DeletePipeline(ctx context.Context, id string) error {
	pipelineID, err := parsePipelineID(id)
	if err != nil {
		return err
	}

	s.logger.InfoContext(ctx, "deleting pipeline",
		slog.String("pipeline_id", id))

	// Get pipeline row to find associated entity IDs
	row, err := s.loadPipelineRow(ctx, pipelineID)
	if err != nil {
		if errors.Is(err, service.ErrPipelineNotExists) {
			return err
		}
		return fmt.Errorf("load pipeline row: %w", err)
	}

	// Get transformation IDs
	transformationIDs := handleTransformationIDs(row.transformationIDsPtr)

	// Get connection IDs from source and sink
	var kafkaConnID, chConnID uuid.UUID
	err = s.pool.QueryRow(ctx, `
		SELECT connection_id FROM sources WHERE id = $1
	`, row.sourceID).Scan(&kafkaConnID)
	if err != nil {
		return fmt.Errorf("get kafka connection ID: %w", err)
	}

	err = s.pool.QueryRow(ctx, `
		SELECT connection_id FROM sinks WHERE id = $1
	`, row.sinkID).Scan(&chConnID)
	if err != nil {
		return fmt.Errorf("get clickhouse connection ID: %w", err)
	}

	// Begin transaction for atomic deletion
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// 1. Delete transformations (no foreign key constraints)
	if len(transformationIDs) > 0 {
		_, err = tx.Exec(ctx, `
			DELETE FROM transformations WHERE id = ANY($1)
		`, transformationIDs)
		if err != nil {
			return fmt.Errorf("delete transformations: %w", err)
		}
	}

	// 2. Delete pipeline (CASCADE will delete schemas and pipeline_history)
	commandTag, err := tx.Exec(ctx, `
		DELETE FROM pipelines WHERE id = $1
	`, pipelineID)
	if err != nil {
		return fmt.Errorf("delete pipeline: %w", err)
	}

	if err := checkRowsAffected(commandTag.RowsAffected()); err != nil {
		return err
	}

	// 3. Delete sources (no longer referenced by pipeline)
	_, err = tx.Exec(ctx, `
		DELETE FROM sources WHERE id = $1
	`, row.sourceID)
	if err != nil {
		return fmt.Errorf("delete source: %w", err)
	}

	// 4. Delete sinks (no longer referenced by pipeline)
	_, err = tx.Exec(ctx, `
		DELETE FROM sinks WHERE id = $1
	`, row.sinkID)
	if err != nil {
		return fmt.Errorf("delete sink: %w", err)
	}

	// 5. Delete connections (no longer referenced by sources/sinks)
	_, err = tx.Exec(ctx, `
		DELETE FROM connections WHERE id = $1
	`, kafkaConnID)
	if err != nil {
		return fmt.Errorf("delete kafka connection: %w", err)
	}

	// Only delete ClickHouse connection if it's different from Kafka connection
	if chConnID != kafkaConnID {
		_, err = tx.Exec(ctx, `
			DELETE FROM connections WHERE id = $1
		`, chConnID)
		if err != nil {
			return fmt.Errorf("delete clickhouse connection: %w", err)
		}
	}

	// Commit transaction
	if err := tx.Commit(ctx); err != nil {
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
func (s *PostgresStorage) insertKafkaSource(ctx context.Context, tx pgx.Tx, p models.PipelineConfig) (uuid.UUID, error) {
	kafkaConnConfig := models.IngestorComponentConfig{
		Provider:              p.Ingestor.Provider,
		KafkaTopics:           p.Ingestor.KafkaTopics,
		KafkaConnectionParams: p.Ingestor.KafkaConnectionParams,
		Type:                  p.Ingestor.Type,
	}

	connBytes, err := json.Marshal(kafkaConnConfig)
	if err != nil {
		return uuid.Nil, fmt.Errorf("marshal kafka connection config: %w", err)
	}

	kafkaConnID, err := s.insertConnectionWithConfig(ctx, tx, "kafka", connBytes)
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
func (s *PostgresStorage) updateKafkaSource(ctx context.Context, tx pgx.Tx, kafkaConnID uuid.UUID, sourceID uuid.UUID, p models.PipelineConfig) error {
	ingestorConnConfig := models.IngestorComponentConfig{
		KafkaConnectionParams: p.Ingestor.KafkaConnectionParams,
		KafkaTopics:           p.Ingestor.KafkaTopics,
		Provider:              p.Ingestor.Provider,
		Type:                  p.Ingestor.Type,
	}
	connBytes, err := json.Marshal(ingestorConnConfig)
	if err != nil {
		return fmt.Errorf("marshal kafka connection config: %w", err)
	}

	err = s.updateConnectionWithConfig(ctx, tx, kafkaConnID, "kafka", connBytes)
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
func (s *PostgresStorage) insertClickHouseSink(ctx context.Context, tx pgx.Tx, p models.PipelineConfig) (uuid.UUID, error) {
	sinkConnConfig := models.SinkComponentConfig{
		ClickHouseConnectionParams: p.Sink.ClickHouseConnectionParams,
		Batch:                      p.Sink.Batch,
		StreamID:                   p.Sink.StreamID,
		Type:                       p.Sink.Type,
		NATSConsumerName:           p.Sink.NATSConsumerName,
	}

	connBytes, err := json.Marshal(sinkConnConfig)
	if err != nil {
		return uuid.Nil, fmt.Errorf("marshal clickhouse connection config: %w", err)
	}

	chConnID, err := s.insertConnectionWithConfig(ctx, tx, "clickhouse", connBytes)
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
func (s *PostgresStorage) updateClickHouseSink(ctx context.Context, tx pgx.Tx, chConnID uuid.UUID, sinkID uuid.UUID, p models.PipelineConfig) error {
	sinkConnConfig := models.SinkComponentConfig{
		ClickHouseConnectionParams: p.Sink.ClickHouseConnectionParams,
		Batch:                      p.Sink.Batch,
		StreamID:                   p.Sink.StreamID,
		NATSConsumerName:           p.Sink.NATSConsumerName,
		Type:                       p.Sink.Type,
	}

	connBytes, err := json.Marshal(sinkConnConfig)
	if err != nil {
		return fmt.Errorf("marshal clickhouse connection config: %w", err)
	}

	err = s.updateConnectionWithConfig(ctx, tx, chConnID, "clickhouse", connBytes)
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
	pipelineID           string
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
	pipelineID           string
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
func (s *PostgresStorage) loadPipelineRow(ctx context.Context, pipelineID string) (*pipelineRow, error) {
	var row pipelineRow
	var transformationIDsArray pgtype.Array[pgtype.UUID]

	err := s.pool.QueryRow(ctx, `
		SELECT id, name, status, source_id, sink_id, transformation_ids, metadata, created_at, updated_at
		FROM pipelines
		WHERE id = $1
	`, pipelineID).Scan(
		&row.pipelineID,
		&row.name,
		&row.status,
		&row.sourceID,
		&row.sinkID,
		&transformationIDsArray,
		&row.metadataJSON,
		&row.createdAt,
		&row.updatedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			s.logger.DebugContext(ctx, "pipeline not found",
				slog.String("pipeline_id", pipelineID))
			return nil, service.ErrPipelineNotExists
		}
		s.logger.ErrorContext(ctx, "failed to load pipeline row",
			slog.String("pipeline_id", pipelineID),
			slog.String("error", err.Error()))
		return nil, fmt.Errorf("get pipeline: %w", err)
	}

	// Convert pgtype UUID array to []uuid.UUID
	if transformationIDsArray.Valid {
		transformationIDs := make([]uuid.UUID, 0, len(transformationIDsArray.Elements))
		for _, elem := range transformationIDsArray.Elements {
			if elem.Valid {
				transformationIDs = append(transformationIDs, elem.Bytes)
			}
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
			slog.String("pipeline_id", row.pipelineID),
			slog.String("source_id", row.sourceID.String()),
			slog.String("error", err.Error()))
		return nil, fmt.Errorf("get source: %w", err)
	}

	sink, chConn, err := s.getSink(ctx, row.sinkID)
	if err != nil {
		s.logger.ErrorContext(ctx, "failed to get sink",
			slog.String("pipeline_id", row.pipelineID),
			slog.String("sink_id", row.sinkID.String()),
			slog.String("error", err.Error()))
		return nil, fmt.Errorf("get sink: %w", err)
	}

	var transformations map[string]Transformation
	if len(transformationIDs) > 0 {
		transformations, err = s.getTransformations(ctx, transformationIDs)
		if err != nil {
			s.logger.ErrorContext(ctx, "failed to get transformations",
				slog.String("pipeline_id", row.pipelineID),
				slog.String("error", err.Error()))
			return nil, fmt.Errorf("get transformations: %w", err)
		}
	} else {
		transformations = make(map[string]Transformation)
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
func (s *PostgresStorage) loadPipelineData(ctx context.Context, pipelineID string) (*pipelineData, error) {
	row, err := s.loadPipelineRow(ctx, pipelineID)
	if err != nil {
		return nil, err
	}

	return s.buildPipelineData(ctx, row)
}
