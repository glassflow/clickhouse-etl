package postgres

import (
	"context"
	"errors"
	"fmt"
	"log/slog"

	"github.com/nats-io/nats.go/jetstream"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/api"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/client"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/service"
)

// MigratePipelinesFromNATSKV migrates pipelines from NATS KV store to PostgreSQL
func MigratePipelinesFromNATSKV(
	ctx context.Context,
	nc *client.NATSClient,
	db service.PipelineStore,
	kvStoreName string,
	logger *slog.Logger,
) error {
	logger.Info("Starting data migration from NATS KV to PostgreSQL",
		slog.String("kv_store_name", kvStoreName))

	// Get KV store
	kvStore, err := nc.GetKeyValueStore(ctx, kvStoreName)
	if err != nil {
		// Store doesn't exist - this is OK (no pipelines to migrate)
		logger.Info("NATS KV store not found, skipping data migration",
			slog.String("store_name", kvStoreName),
			slog.String("error", err.Error()))
		return nil
	}

	// List all keys - use Keys() directly on the KV store
	keys, err := kvStore.Keys(ctx)
	if err != nil {
		logger.Info("NATS KV found but no pipelines in bucket:",
			slog.String("store_name", kvStoreName),
			slog.String("error", err.Error()))
		return nil
	}

	if len(keys) == 0 {
		logger.Info("No pipelines found in NATS KV store",
			slog.String("store_name", kvStoreName))
		return nil
	}

	logger.Info("Found pipelines in NATS KV store",
		slog.String("store_name", kvStoreName),
		slog.Int("count", len(keys)))

	// Process each pipeline
	var migrated, skipped, errorCount int
	for _, oldPipelineID := range keys {
		// Get pipeline JSON from KV
		value, err := kvStore.Get(ctx, oldPipelineID)
		if err != nil {
			if errors.Is(err, jetstream.ErrKeyNotFound) {
				logger.Warn("Pipeline key not found in KV store (may have been deleted)",
					slog.String("old_pipeline_id", oldPipelineID))
				skipped++
				continue
			}
			logger.Error("Failed to get pipeline from KV",
				slog.String("old_pipeline_id", oldPipelineID),
				slog.String("error", err.Error()))
			errorCount++
			continue
		}

		// Migrate pipeline
		pipelineConfig, pipelineID, err := migratePipelineFromJSON(value.Value(), oldPipelineID, logger)
		if err != nil {
			logger.Error("Failed to migrate pipeline",
				slog.String("pipeline_id", oldPipelineID),
				slog.String("error", err.Error()))
			errorCount++
			continue
		}

		// Check if pipeline already exists (by ID)
		existing, err := db.GetPipeline(ctx, pipelineID)
		if err != nil && !errors.Is(err, service.ErrPipelineNotExists) {
			logger.Error("Failed to check if pipeline exists",
				slog.String("pipeline_id", pipelineID),
				slog.String("error", err.Error()))
			errorCount++
			continue
		}
		if existing != nil {
			logger.Info("Pipeline already exists in Postgres, skipping",
				slog.String("pipeline_id", pipelineID),
				slog.String("name", pipelineConfig.Name))
			skipped++
			continue
		}

		// Insert into Postgres
		if err := db.InsertPipeline(ctx, *pipelineConfig); err != nil {
			logger.Error("Failed to insert pipeline into Postgres",
				slog.String("pipeline_id", pipelineID),
				slog.String("name", pipelineConfig.Name),
				slog.String("error", err.Error()))
			errorCount++
			// Don't delete from KV if insert failed (allows retry)
			continue
		}

		// Delete from NATS KV
		if err := kvStore.Delete(ctx, oldPipelineID); err != nil {
			logger.Warn("Failed to delete pipeline from NATS KV (pipeline already migrated)",
				slog.String("pipeline_id", pipelineID),
				slog.String("error", err.Error()))
			// Don't fail - pipeline is already in Postgres
		}

		logger.Info("Pipeline migrated successfully",
			slog.String("pipeline_id", pipelineID),
			slog.String("name", pipelineConfig.Name))
		migrated++
	}

	// Log summary
	logger.Info("Data migration completed",
		slog.Int("migrated", migrated),
		slog.Int("skipped", skipped),
		slog.Int("errors", errorCount),
		slog.String("store_name", kvStoreName))

	return nil
}

// migratePipelineFromJSON converts JSON to PipelineConfig using the same pipeline ID from NATS KV
// It automatically recalculates all derived values using the existing toModel() function
func migratePipelineFromJSON(
	jsonData []byte,
	pipelineID string,
	logger *slog.Logger,
) (*models.PipelineConfig, string, error) {
	// Use the same pipeline ID from NATS KV (it's already validated to be valid)

	// Use the API's migration helper which handles unmarshaling and conversion
	// This automatically recalculates all derived values based on the pipeline ID
	pipelineConfig, err := api.MigratePipelineFromJSON(jsonData, pipelineID)
	if err != nil {
		return nil, "", fmt.Errorf("migrate pipeline from JSON: %w", err)
	}

	logger.Info("Migrating pipeline with same ID",
		slog.String("pipeline_id", pipelineID),
		slog.String("name", pipelineConfig.Name))

	return &pipelineConfig, pipelineID, nil
}
