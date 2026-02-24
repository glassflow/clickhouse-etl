package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/encryption"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

// getSource retrieves a source and its connection
func (s *PostgresStorage) getSource(ctx context.Context, sourceID uuid.UUID) (json.RawMessage, json.RawMessage, error) {
	return getEntityWithConnection(ctx, s.pool, s.logger, "sources", "id", sourceID, s.encryptionService)
}

// getSink retrieves a sink and its connection
func (s *PostgresStorage) getSink(ctx context.Context, sinkID uuid.UUID) (json.RawMessage, json.RawMessage, error) {
	return getEntityWithConnection(ctx, s.pool, s.logger, "sinks", "id", sinkID, s.encryptionService)
}

// getEntityWithConnection is a generic helper to get an entity (source/sink) and its connection
func getEntityWithConnection(
	ctx context.Context,
	pool *pgxpool.Pool,
	logger *slog.Logger,
	entityTable, entityIDColumn string,
	entityID uuid.UUID,
	encryptionService *encryption.Service,
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

	// Query connection (type and config)
	var connType string
	var connConfigJSON []byte
	err = pool.QueryRow(ctx, `
		SELECT type, config
		FROM connections
		WHERE id = $1
	`, connID).Scan(&connType, &connConfigJSON)
	if err != nil {
		logger.ErrorContext(ctx, "failed to query connection",
			slog.String("entity_table", entityTable),
			slog.String("connection_id", connID.String()),
			slog.String("error", err.Error()))
		return nil, nil, fmt.Errorf("get connection: %w", err)
	}

	// Decrypt sensitive fields if encryption is enabled
	if encryptionService != nil {
		decrypted, err := decryptSensitiveFields(encryptionService, connType, connConfigJSON)
		if err != nil {
			// Try to unmarshal as plaintext JSON (backward compatibility - old unencrypted data)
			var testJSON interface{}
			if json.Unmarshal(connConfigJSON, &testJSON) == nil {
				logger.WarnContext(ctx, "failed to decrypt sensitive fields, treating as unencrypted",
					slog.String("entity_table", entityTable),
					slog.String("connection_id", connID.String()),
					slog.String("error", err.Error()))
				return entityConfigJSON, connConfigJSON, nil
			}
			logger.ErrorContext(ctx, "failed to decrypt sensitive fields",
				slog.String("entity_table", entityTable),
				slog.String("connection_id", connID.String()),
				slog.String("error", err.Error()))
			return nil, nil, fmt.Errorf("decrypt sensitive fields: %w", err)
		}
		connConfigJSON = decrypted
	}

	// Return raw JSON for direct unmarshaling into typed structs
	return entityConfigJSON, connConfigJSON, nil
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

// upsertTransformationEntity handles INSERT or UPDATE of a transformation entity
func (s *PostgresStorage) upsertTransformationEntity(
	ctx context.Context,
	tx pgx.Tx,
	pipelineID string,
	transType string,
	config interface{},
	oldByType map[string]uuid.UUID,
	updatedIDs map[uuid.UUID]bool,
) (uuid.UUID, error) {
	oldID, exists := oldByType[transType]
	if exists {
		// Update existing transformation
		err := s.updateTransformation(ctx, tx, oldID, config)
		if err != nil {
			s.logger.ErrorContext(ctx, "failed to update transformation",
				slog.String("pipeline_id", pipelineID),
				slog.String("transformation_type", transType),
				slog.String("error", err.Error()))
			return uuid.Nil, fmt.Errorf("update %s transformation: %w", transType, err)
		}
		updatedIDs[oldID] = true
		return oldID, nil
	}

	// Insert new transformation
	transID, err := s.insertTransformation(ctx, tx, transType, config)
	if err != nil {
		s.logger.ErrorContext(ctx, "failed to insert transformation",
			slog.String("pipeline_id", pipelineID),
			slog.String("transformation_type", transType),
			slog.String("error", err.Error()))
		return uuid.Nil, fmt.Errorf("insert %s transformation: %w", transType, err)
	}
	return transID, nil
}

// upsertStatelessTransformationSchemaAndConfig handles schema version and config for stateless transformation
func (s *PostgresStorage) upsertStatelessTransformationSchemaAndConfig(
	ctx context.Context,
	tx pgx.Tx,
	p models.PipelineConfig,
) error {
	// backward compatibility check
	if p.SchemaVersions == nil {
		return nil
	}

	outputSchema, found := p.SchemaVersions[p.StatelessTransformation.ID]
	if !found {
		return fmt.Errorf("find output schema version for stateless transformation")
	}

	sourceSchema, found := p.SchemaVersions[p.StatelessTransformation.SourceID]
	if !found {
		return fmt.Errorf("schema version for stateless transformation source not found")
	}

	existingConfig, err := s.getStatelessTransformationConfig(
		ctx,
		tx,
		p.ID,
		p.StatelessTransformation.SourceID,
		sourceSchema.VersionID,
	)

	var outputSchemaVersionID string

	if errors.Is(err, models.ErrRecordNotFound) {
		// Config doesn't exist - INSERT
		outputSchemaVersionID, err = s.upsertSchemaVersion(
			ctx,
			tx,
			p.ID,
			p.StatelessTransformation.ID,
			outputSchema.VersionID,
			outputSchema.Fields,
		)
		if err != nil {
			return fmt.Errorf("upsert schema version for stateless transformation: %w", err)
		}

		err = s.insertStatelessTransformationConfig(
			ctx,
			tx,
			p.ID,
			p.StatelessTransformation.SourceID,
			sourceSchema.VersionID,
			p.StatelessTransformation.ID,
			outputSchemaVersionID,
			p.StatelessTransformation.Config.Transform,
		)
		if err != nil {
			return fmt.Errorf("insert transformation config: %w", err)
		}
	} else if err != nil {
		return fmt.Errorf("get existing stateless transformation config: %w", err)
	} else {
		// Config exists - UPDATE using existing output schema version ID
		outputSchemaVersionID = existingConfig.OutputSchemaVersionID

		err = s.updateStatelessTransformationConfig(
			ctx,
			tx,
			p.ID,
			p.StatelessTransformation.SourceID,
			sourceSchema.VersionID,
			p.StatelessTransformation.Config.Transform,
		)
		if err != nil {
			return fmt.Errorf("update stateless transformation config: %w", err)
		}

		_, err = s.upsertSchemaVersion(
			ctx,
			tx,
			p.ID,
			p.StatelessTransformation.ID,
			outputSchemaVersionID,
			outputSchema.Fields,
		)
		if err != nil {
			return fmt.Errorf("upsert schema version for stateless transformation: %w", err)
		}
	}

	outputSchema.VersionID = outputSchemaVersionID
	p.SchemaVersions[p.StatelessTransformation.ID] = outputSchema

	return nil
}

// upsertJoinTransformationSchemaAndConfig handles schema version and config for join transformation
func (s *PostgresStorage) upsertJoinTransformationSchemaAndConfig(
	ctx context.Context,
	tx pgx.Tx,
	p models.PipelineConfig,
) error {
	// backward compatibility check
	if p.SchemaVersions == nil {
		return nil
	}

	outputSchema, found := p.SchemaVersions[p.Join.ID]
	if !found {
		return fmt.Errorf("find output schema version for join transformation")
	}

	// Compute target join output schema version once for this edit.
	outputSchemaVersionID, err := s.upsertSchemaVersion(
		ctx,
		tx,
		p.ID,
		p.Join.ID,
		outputSchema.VersionID,
		outputSchema.Fields,
	)
	if err != nil {
		return fmt.Errorf("upsert schema version for join transformation: %w", err)
	}

	outputSchema.VersionID = outputSchemaVersionID
	p.SchemaVersions[p.Join.ID] = outputSchema

	// Upsert config for every join source against the SAME output schema version.
	for _, src := range p.Join.Sources {
		sourceSchema, found := p.SchemaVersions[src.SourceID]
		if !found {
			return fmt.Errorf("schema version for join transformation source '%s' not found", src.SourceID)
		}

		if err := s.upsertJoinConfig(
			ctx,
			tx,
			p.ID,
			src.SourceID,
			sourceSchema.VersionID,
			p.Join.ID,
			outputSchemaVersionID,
			p.Join.Config,
		); err != nil {
			return err
		}
	}

	return nil
}

// deleteUnusedTransformations removes transformations that are no longer used
func (s *PostgresStorage) deleteUnusedTransformations(
	ctx context.Context,
	tx pgx.Tx,
	pipelineID string,
	oldTransformationIDs []uuid.UUID,
	updatedIDs map[uuid.UUID]bool,
) error {
	if len(oldTransformationIDs) == 0 {
		return nil
	}

	// Build list of IDs to delete (those not in updatedIDs)
	var idsToDelete []uuid.UUID
	for _, oldID := range oldTransformationIDs {
		if !updatedIDs[oldID] {
			idsToDelete = append(idsToDelete, oldID)
		}
	}

	if len(idsToDelete) == 0 {
		return nil
	}

	_, err := tx.Exec(ctx, `
		DELETE FROM transformations WHERE id = ANY($1)
	`, idsToDelete)
	if err != nil {
		s.logger.ErrorContext(ctx, "failed to delete unused transformations",
			slog.String("pipeline_id", pipelineID),
			slog.String("error", err.Error()))
		return fmt.Errorf("delete unused transformations: %w", err)
	}

	return nil
}

// updateTransformationsFromPipeline updates transformations by matching type, deletes unused ones, and inserts new ones
func (s *PostgresStorage) updateTransformationsFromPipeline(
	ctx context.Context,
	tx pgx.Tx,
	pipelineID string,
	oldTransformationIDs []uuid.UUID,
	p models.PipelineConfig,
) ([]uuid.UUID, error) {
	// Build map of old transformations by type
	oldByType := make(map[string]uuid.UUID)
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
			dedupID, err := s.upsertTransformationEntity(
				ctx, tx, pipelineID, "deduplication", topic.Deduplication, oldByType, updatedIDs,
			)
			if err != nil {
				return nil, err
			}
			newTransformationIDs = append(newTransformationIDs, dedupID)
			break
		}
	}

	// Process filter transformation
	if p.Filter.Enabled {
		filterID, err := s.upsertTransformationEntity(
			ctx, tx, pipelineID, "filter", p.Filter, oldByType, updatedIDs,
		)
		if err != nil {
			return nil, err
		}
		newTransformationIDs = append(newTransformationIDs, filterID)
	}

	// Process stateless transformation
	if p.StatelessTransformation.Enabled {
		statelessID, err := s.upsertTransformationEntity(
			ctx, tx, pipelineID, "stateless_transformation", p.StatelessTransformation, oldByType, updatedIDs,
		)
		if err != nil {
			return nil, err
		}
		newTransformationIDs = append(newTransformationIDs, statelessID)

		// Handle schema version and config
		if err := s.upsertStatelessTransformationSchemaAndConfig(ctx, tx, p); err != nil {
			return nil, err
		}
	}

	// Process join transformation
	if p.Join.Enabled {
		joinID, err := s.upsertTransformationEntity(
			ctx, tx, pipelineID, "join", p.Join, oldByType, updatedIDs,
		)
		if err != nil {
			return nil, err
		}
		newTransformationIDs = append(newTransformationIDs, joinID)

		// Handle schema version and config
		if err := s.upsertJoinTransformationSchemaAndConfig(ctx, tx, p); err != nil {
			return nil, err
		}
	}

	// Delete old transformations that weren't updated
	if err := s.deleteUnusedTransformations(ctx, tx, pipelineID, oldTransformationIDs, updatedIDs); err != nil {
		return nil, err
	}

	return newTransformationIDs, nil
}

// getTransformations retrieves transformations by their IDs
func (s *PostgresStorage) getTransformations(ctx context.Context, transIDs []uuid.UUID) (map[string]Transformation, error) {
	if len(transIDs) == 0 {
		return make(map[string]Transformation), nil
	}

	query := `SELECT type, config FROM transformations WHERE id = ANY($1)`
	rows, err := s.pool.Query(ctx, query, transIDs)
	if err != nil {
		return nil, fmt.Errorf("query transformations: %w", err)
	}
	defer rows.Close()

	transformations := make(map[string]Transformation)
	for rows.Next() {
		var transType string
		var configJSON []byte
		if err := rows.Scan(&transType, &configJSON); err != nil {
			return nil, fmt.Errorf("scan transformation: %w", err)
		}

		transformations[transType] = Transformation{
			Type:   transType,
			Config: configJSON,
		}
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

	// Stateless transformation
	if p.StatelessTransformation.Enabled {
		statelessID, err := s.insertTransformation(ctx, tx, "stateless_transformation", p.StatelessTransformation)
		if err != nil {
			s.logger.ErrorContext(ctx, "failed to insert stateless transformation",
				slog.String("pipeline_id", p.ID),
				slog.String("error", err.Error()))
			return nil, fmt.Errorf("insert stateless transformation: %w", err)
		}
		transformationIDs = append(transformationIDs, statelessID)
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

	return transformationIDs, nil
}

func (s *PostgresStorage) insertStatelessTransformationSchemaAndConfig(
	ctx context.Context,
	tx pgx.Tx,
	p models.PipelineConfig,
) error {
	// backward compatibility check
	if p.SchemaVersions == nil {
		return nil
	}

	outputSchemaVersion, found := p.SchemaVersions[p.StatelessTransformation.ID]
	if !found {
		return fmt.Errorf("find output schema version for stateless transformation")
	}

	outputSchemaVersionID, err := s.upsertSchemaVersion(
		ctx,
		tx,
		p.ID,
		p.StatelessTransformation.ID,
		outputSchemaVersion.VersionID,
		outputSchemaVersion.Fields,
	)
	if err != nil {
		return fmt.Errorf("upsert schema version for stateless transformation: %w", err)
	}

	outputSchemaVersion.VersionID = outputSchemaVersionID
	p.SchemaVersions[p.StatelessTransformation.ID] = outputSchemaVersion

	sourceSchemaVersion, found := p.SchemaVersions[p.StatelessTransformation.SourceID]
	if !found {
		return fmt.Errorf("schema version for source ID '%s' not found", p.StatelessTransformation.SourceID)
	}

	err = s.insertStatelessTransformationConfig(
		ctx,
		tx,
		p.ID,
		p.StatelessTransformation.SourceID,
		sourceSchemaVersion.VersionID,
		p.StatelessTransformation.ID,
		outputSchemaVersionID,
		p.StatelessTransformation.Config.Transform,
	)
	if err != nil {
		return fmt.Errorf("insert transformation config: %w", err)
	}

	return nil
}

func (s *PostgresStorage) insertJoinSchemaAndConfig(
	ctx context.Context,
	tx pgx.Tx,
	p models.PipelineConfig,
) error {
	// backward compatibility check
	if p.SchemaVersions == nil {
		return nil
	}

	outputSchemaVersion, found := p.SchemaVersions[p.Join.ID]
	if !found {
		return fmt.Errorf("find output schema version for join transformation")
	}

	outputSchemaVersionID, err := s.upsertSchemaVersion(
		ctx,
		tx,
		p.ID,
		p.Join.ID,
		outputSchemaVersion.VersionID,
		outputSchemaVersion.Fields,
	)
	if err != nil {
		return fmt.Errorf("upsert schema version for join transformation: %w", err)
	}

	outputSchemaVersion.VersionID = outputSchemaVersionID
	p.SchemaVersions[p.Join.ID] = outputSchemaVersion

	for _, src := range p.Join.Sources {
		sourceSchemaVersion, found := p.SchemaVersions[src.SourceID]
		if !found {
			return fmt.Errorf("schema version for source ID '%s' not found", src.SourceID)
		}

		// Insert source schema version if it doesn't exist
		sourceSchemaVersionID, err := s.upsertSchemaVersion(
			ctx,
			tx,
			p.ID,
			src.SourceID,
			sourceSchemaVersion.VersionID,
			sourceSchemaVersion.Fields,
		)
		if err != nil {
			return fmt.Errorf("upsert source schema version for '%s': %w", src.SourceID, err)
		}

		// Update the schema version ID in the config
		sourceSchemaVersion.VersionID = sourceSchemaVersionID
		p.SchemaVersions[src.SourceID] = sourceSchemaVersion

		err = s.insertJoinConfig(
			ctx,
			tx,
			p.ID,
			sourceSchemaVersion.SourceID,
			sourceSchemaVersionID,
			p.Join.ID,
			outputSchemaVersionID,
			p.Join.Config,
		)
		if err != nil {
			return fmt.Errorf("insert join config: %w", err)
		}
	}

	return nil
}
