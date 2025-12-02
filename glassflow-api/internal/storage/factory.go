package storage

import (
	"context"
	"log/slog"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/client"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/service"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/storage/postgres"
)

// MigratePipelinesFromNATSKV migrates pipelines from NATS KV store to PostgreSQL
func MigratePipelinesFromNATSKV(
	ctx context.Context,
	nc *client.NATSClient,
	db service.PipelineStore,
	kvStoreName string,
	logger *slog.Logger,
) error {
	return postgres.MigratePipelinesFromNATSKV(ctx, nc, db, kvStoreName, logger)
}

// NewPipelineStore creates a new PipelineStore implementation.
func NewPipelineStore(ctx context.Context, dsn string, logger *slog.Logger) (service.PipelineStore, error) {
	return postgres.NewPostgres(ctx, dsn, logger)
}
