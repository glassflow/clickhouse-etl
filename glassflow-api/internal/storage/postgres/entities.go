package postgres

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// getSource retrieves a source and its connection
func (s *PostgresStorage) getSource(ctx context.Context, sourceID uuid.UUID) (json.RawMessage, json.RawMessage, error) {
	return getEntityWithConnection(ctx, s.pool, s.logger, "sources", "id", sourceID)
}

// getSink retrieves a sink and its connection
func (s *PostgresStorage) getSink(ctx context.Context, sinkID uuid.UUID) (json.RawMessage, json.RawMessage, error) {
	return getEntityWithConnection(ctx, s.pool, s.logger, "sinks", "id", sinkID)
}

// getEntityWithConnection is a generic helper to get an entity (source/sink) and its connection
func getEntityWithConnection(
	ctx context.Context,
	pool *pgxpool.Pool,
	logger *slog.Logger,
	entityTable, entityIDColumn string,
	entityID uuid.UUID,
) (entityConfig json.RawMessage, connConfig json.RawMessage, err error) {
	var (
		connID           uuid.UUID
		entityConfigJSON []byte
	)

	// Query entity table
	err = pool.QueryRow(ctx, fmt.Sprintf(`
		SELECT connection_id, config
		FROM %s
		WHERE %s = $1
	`, entityTable, entityIDColumn), entityID).Scan(&connID, &entityConfigJSON)
	if err != nil {
		logger.ErrorContext(ctx, "failed to query entity",
			slog.String("entity_table", entityTable),
			slog.String("entity_id", entityID.String()),
			slog.String("error", err.Error()))
		return nil, nil, fmt.Errorf("get %s: %w", entityTable, err)
	}

	// Query connection
	var connConfigJSON []byte
	err = pool.QueryRow(ctx, `
		SELECT config
		FROM connections
		WHERE id = $1
	`, connID).Scan(&connConfigJSON)
	if err != nil {
		logger.ErrorContext(ctx, "failed to query connection",
			slog.String("entity_table", entityTable),
			slog.String("connection_id", connID.String()),
			slog.String("error", err.Error()))
		return nil, nil, fmt.Errorf("get connection: %w", err)
	}

	// Return raw JSON for direct unmarshaling into typed structs
	return json.RawMessage(entityConfigJSON), json.RawMessage(connConfigJSON), nil
}

// ------------------------------------------------------------------------------------------------

// insertSource inserts a source
func (s *PostgresStorage) insertSource(ctx context.Context, tx pgx.Tx, sourceType string, connID uuid.UUID, streams map[string]models.StreamSchemaConfig) (uuid.UUID, error) {
	configJSON, err := json.Marshal(map[string]interface{}{
		"streams": streams,
	})
	if err != nil {
		s.logger.ErrorContext(ctx, "failed to marshal source config",
			slog.String("source_type", sourceType),
			slog.String("error", err.Error()))
		return uuid.Nil, fmt.Errorf("marshal source config: %w", err)
	}

	var sourceID uuid.UUID
	err = tx.QueryRow(ctx, `
		INSERT INTO sources (type, connection_id, config)
		VALUES ($1, $2, $3)
		RETURNING id
	`, sourceType, connID, configJSON).Scan(&sourceID)
	if err != nil {
		s.logger.ErrorContext(ctx, "failed to insert source",
			slog.String("source_type", sourceType),
			slog.String("connection_id", connID.String()),
			slog.String("error", err.Error()))
		return uuid.Nil, fmt.Errorf("insert source: %w", err)
	}

	return sourceID, nil
}

// updateSource updates an existing source
func (s *PostgresStorage) updateSource(ctx context.Context, tx pgx.Tx, sourceID uuid.UUID, streams map[string]models.StreamSchemaConfig) error {
	configJSON, err := json.Marshal(map[string]interface{}{
		"streams": streams,
	})
	if err != nil {
		s.logger.ErrorContext(ctx, "failed to marshal source config",
			slog.String("source_id", sourceID.String()),
			slog.String("error", err.Error()))
		return fmt.Errorf("marshal source config: %w", err)
	}

	_, err = tx.Exec(ctx, `
		UPDATE sources
		SET config = $1, updated_at = NOW()
		WHERE id = $2
	`, configJSON, sourceID)
	if err != nil {
		s.logger.ErrorContext(ctx, "failed to update source",
			slog.String("source_id", sourceID.String()),
			slog.String("error", err.Error()))
		return fmt.Errorf("update source: %w", err)
	}

	return nil
}

// ------------------------------------------------------------------------------------------------

// insertSink inserts a sink
func (s *PostgresStorage) insertSink(ctx context.Context, tx pgx.Tx, sinkType string, connID uuid.UUID, sinkMapping []models.SinkMappingConfig) (uuid.UUID, error) {
	configJSON, err := json.Marshal(map[string]interface{}{
		"sink_mapping": sinkMapping,
	})
	if err != nil {
		s.logger.ErrorContext(ctx, "failed to marshal sink config",
			slog.String("sink_type", sinkType),
			slog.String("error", err.Error()))
		return uuid.Nil, fmt.Errorf("marshal sink config: %w", err)
	}

	var sinkID uuid.UUID
	err = tx.QueryRow(ctx, `
		INSERT INTO sinks (type, connection_id, config)
		VALUES ($1, $2, $3)
		RETURNING id
	`, sinkType, connID, configJSON).Scan(&sinkID)
	if err != nil {
		s.logger.ErrorContext(ctx, "failed to insert sink",
			slog.String("sink_type", sinkType),
			slog.String("connection_id", connID.String()),
			slog.String("error", err.Error()))
		return uuid.Nil, fmt.Errorf("insert sink: %w", err)
	}

	return sinkID, nil
}

// updateSink updates an existing sink
func (s *PostgresStorage) updateSink(ctx context.Context, tx pgx.Tx, sinkID uuid.UUID, sinkMapping []models.SinkMappingConfig) error {
	configJSON, err := json.Marshal(map[string]interface{}{
		"sink_mapping": sinkMapping,
	})
	if err != nil {
		s.logger.ErrorContext(ctx, "failed to marshal sink config",
			slog.String("sink_id", sinkID.String()),
			slog.String("error", err.Error()))
		return fmt.Errorf("marshal sink config: %w", err)
	}

	_, err = tx.Exec(ctx, `
		UPDATE sinks
		SET config = $1, updated_at = NOW()
		WHERE id = $2
	`, configJSON, sinkID)
	if err != nil {
		s.logger.ErrorContext(ctx, "failed to update sink",
			slog.String("sink_id", sinkID.String()),
			slog.String("error", err.Error()))
		return fmt.Errorf("update sink: %w", err)
	}

	return nil
}

// ------------------------------------------------------------------------------------------------

// insertTransformation inserts a transformation entity
func (s *PostgresStorage) insertTransformation(ctx context.Context, tx pgx.Tx, transType string, config interface{}) (uuid.UUID, error) {
	configJSON, err := json.Marshal(config)
	if err != nil {
		s.logger.ErrorContext(ctx, "failed to marshal transformation config",
			slog.String("transformation_type", transType),
			slog.String("error", err.Error()))
		return uuid.Nil, fmt.Errorf("marshal transformation config: %w", err)
	}

	var transID uuid.UUID
	err = tx.QueryRow(ctx, `
		INSERT INTO transformations (type, config)
		VALUES ($1, $2)
		RETURNING id
	`, transType, configJSON).Scan(&transID)
	if err != nil {
		s.logger.ErrorContext(ctx, "failed to insert transformation",
			slog.String("transformation_type", transType),
			slog.String("error", err.Error()))
		return uuid.Nil, fmt.Errorf("insert transformation: %w", err)
	}

	return transID, nil
}

// updateTransformation updates an existing transformation
func (s *PostgresStorage) updateTransformation(ctx context.Context, tx pgx.Tx, transID uuid.UUID, config interface{}) error {
	configJSON, err := json.Marshal(config)
	if err != nil {
		s.logger.ErrorContext(ctx, "failed to marshal transformation config",
			slog.String("transformation_id", transID.String()),
			slog.String("error", err.Error()))
		return fmt.Errorf("marshal transformation config: %w", err)
	}

	_, err = tx.Exec(ctx, `
		UPDATE transformations
		SET config = $1, updated_at = NOW()
		WHERE id = $2
	`, configJSON, transID)
	if err != nil {
		s.logger.ErrorContext(ctx, "failed to update transformation",
			slog.String("transformation_id", transID.String()),
			slog.String("error", err.Error()))
		return fmt.Errorf("update transformation: %w", err)
	}

	return nil
}

// getTransformationType retrieves the type of a transformation by ID
func (s *PostgresStorage) getTransformationType(ctx context.Context, tx pgx.Tx, transID uuid.UUID) (string, error) {
	var transType string
	err := tx.QueryRow(ctx, `
		SELECT type FROM transformations WHERE id = $1
	`, transID).Scan(&transType)
	if err != nil {
		s.logger.ErrorContext(ctx, "failed to get transformation type",
			slog.String("transformation_id", transID.String()),
			slog.String("error", err.Error()))
		return "", fmt.Errorf("get transformation type: %w", err)
	}
	return transType, nil
}

// updateTransformationsFromPipeline updates transformations by matching type, deletes unused ones, and inserts new ones
func (s *PostgresStorage) updateTransformationsFromPipeline(ctx context.Context, tx pgx.Tx, pipelineID uuid.UUID, oldTransformationIDs []uuid.UUID, p models.PipelineConfig) ([]uuid.UUID, error) {
	// Build map of old transformations by type
	oldByType := make(map[string]uuid.UUID) // type -> transformation_id
	for _, transID := range oldTransformationIDs {
		transType, err := s.getTransformationType(ctx, tx, transID)
		if err != nil {
			return nil, fmt.Errorf("get transformation type: %w", err)
		}
		oldByType[transType] = transID
	}

	var newTransformationIDs []uuid.UUID
	updatedIDs := make(map[uuid.UUID]bool)

	// Process deduplication transformation
	for _, topic := range p.Ingestor.KafkaTopics {
		if topic.Deduplication.Enabled {
			if oldID, exists := oldByType["deduplication"]; exists {
				// Update existing transformation
				err := s.updateTransformation(ctx, tx, oldID, topic.Deduplication)
				if err != nil {
					s.logger.ErrorContext(ctx, "failed to update deduplication transformation",
						slog.String("pipeline_id", pipelineID.String()),
						slog.String("error", err.Error()))
					return nil, fmt.Errorf("update deduplication transformation: %w", err)
				}
				newTransformationIDs = append(newTransformationIDs, oldID)
				updatedIDs[oldID] = true
			} else {
				// Insert new transformation
				dedupID, err := s.insertTransformation(ctx, tx, "deduplication", topic.Deduplication)
				if err != nil {
					s.logger.ErrorContext(ctx, "failed to insert deduplication transformation",
						slog.String("pipeline_id", pipelineID.String()),
						slog.String("error", err.Error()))
					return nil, fmt.Errorf("insert deduplication transformation: %w", err)
				}
				newTransformationIDs = append(newTransformationIDs, dedupID)
			}
			break // Only one deduplication needed
		}
	}

	// Process join transformation
	if p.Join.Enabled {
		if oldID, exists := oldByType["join"]; exists {
			// Update existing transformation
			err := s.updateTransformation(ctx, tx, oldID, p.Join)
			if err != nil {
				s.logger.ErrorContext(ctx, "failed to update join transformation",
					slog.String("pipeline_id", pipelineID.String()),
					slog.String("error", err.Error()))
				return nil, fmt.Errorf("update join transformation: %w", err)
			}
			newTransformationIDs = append(newTransformationIDs, oldID)
			updatedIDs[oldID] = true
		} else {
			// Insert new transformation
			joinID, err := s.insertTransformation(ctx, tx, "join", p.Join)
			if err != nil {
				s.logger.ErrorContext(ctx, "failed to insert join transformation",
					slog.String("pipeline_id", pipelineID.String()),
					slog.String("error", err.Error()))
				return nil, fmt.Errorf("insert join transformation: %w", err)
			}
			newTransformationIDs = append(newTransformationIDs, joinID)
		}
	}

	// Process filter transformation
	if p.Filter.Enabled {
		if oldID, exists := oldByType["filter"]; exists {
			// Update existing transformation
			err := s.updateTransformation(ctx, tx, oldID, p.Filter)
			if err != nil {
				s.logger.ErrorContext(ctx, "failed to update filter transformation",
					slog.String("pipeline_id", pipelineID.String()),
					slog.String("error", err.Error()))
				return nil, fmt.Errorf("update filter transformation: %w", err)
			}
			newTransformationIDs = append(newTransformationIDs, oldID)
			updatedIDs[oldID] = true
		} else {
			// Insert new transformation
			filterID, err := s.insertTransformation(ctx, tx, "filter", p.Filter)
			if err != nil {
				s.logger.ErrorContext(ctx, "failed to insert filter transformation",
					slog.String("pipeline_id", pipelineID.String()),
					slog.String("error", err.Error()))
				return nil, fmt.Errorf("insert filter transformation: %w", err)
			}
			newTransformationIDs = append(newTransformationIDs, filterID)
		}
	}

	// Delete old transformations that weren't updated
	if len(oldTransformationIDs) > 0 {
		// Build list of IDs to delete (those not in updatedIDs)
		var idsToDelete []uuid.UUID
		for _, oldID := range oldTransformationIDs {
			if !updatedIDs[oldID] {
				idsToDelete = append(idsToDelete, oldID)
			}
		}

		if len(idsToDelete) > 0 {
			_, err := tx.Exec(ctx, `
				DELETE FROM transformations WHERE id = ANY($1)
			`, idsToDelete)
			if err != nil {
				s.logger.ErrorContext(ctx, "failed to delete unused transformations",
					slog.String("pipeline_id", pipelineID.String()),
					slog.String("error", err.Error()))
				return nil, fmt.Errorf("delete unused transformations: %w", err)
			}
		}
	}

	return newTransformationIDs, nil
}

// getTransformations retrieves transformations by their IDs
func (s *PostgresStorage) getTransformations(ctx context.Context, transIDs []uuid.UUID) (map[string]interface{}, error) {
	if len(transIDs) == 0 {
		return make(map[string]interface{}), nil
	}

	query := `SELECT type, config FROM transformations WHERE id = ANY($1)`
	rows, err := s.pool.Query(ctx, query, transIDs)
	if err != nil {
		return nil, fmt.Errorf("query transformations: %w", err)
	}
	defer rows.Close()

	transformations := make(map[string]interface{})
	for rows.Next() {
		var transType string
		var configJSON []byte
		if err := rows.Scan(&transType, &configJSON); err != nil {
			return nil, fmt.Errorf("scan transformation: %w", err)
		}

		var config map[string]interface{}
		if err := json.Unmarshal(configJSON, &config); err != nil {
			return nil, fmt.Errorf("unmarshal transformation config: %w", err)
		}

		transformations[transType] = config
	}

	return transformations, nil
}

// insertTransformationsFromPipeline extracts and inserts transformations from a pipeline config
func (s *PostgresStorage) insertTransformationsFromPipeline(ctx context.Context, tx pgx.Tx, p models.PipelineConfig) ([]uuid.UUID, error) {
	var transformationIDs []uuid.UUID

	// Deduplication transformation (from topics)
	for _, topic := range p.Ingestor.KafkaTopics {
		if topic.Deduplication.Enabled {
			dedupID, err := s.insertTransformation(ctx, tx, "deduplication", topic.Deduplication)
			if err != nil {
				s.logger.ErrorContext(ctx, "failed to insert deduplication transformation",
					slog.String("pipeline_id", p.ID),
					slog.String("error", err.Error()))
				return nil, fmt.Errorf("insert deduplication transformation: %w", err)
			}
			transformationIDs = append(transformationIDs, dedupID)
			break // Only one deduplication needed
		}
	}

	// Join transformation
	if p.Join.Enabled {
		joinID, err := s.insertTransformation(ctx, tx, "join", p.Join)
		if err != nil {
			s.logger.ErrorContext(ctx, "failed to insert join transformation",
				slog.String("pipeline_id", p.ID),
				slog.String("error", err.Error()))
			return nil, fmt.Errorf("insert join transformation: %w", err)
		}
		transformationIDs = append(transformationIDs, joinID)
	}

	// Filter transformation
	if p.Filter.Enabled {
		filterID, err := s.insertTransformation(ctx, tx, "filter", p.Filter)
		if err != nil {
			s.logger.ErrorContext(ctx, "failed to insert filter transformation",
				slog.String("pipeline_id", p.ID),
				slog.String("error", err.Error()))
			return nil, fmt.Errorf("insert filter transformation: %w", err)
		}
		transformationIDs = append(transformationIDs, filterID)
	}

	return transformationIDs, nil
}
