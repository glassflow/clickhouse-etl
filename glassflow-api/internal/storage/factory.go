package storage

import (
	"context"
	"log/slog"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/client"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
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
func NewPipelineStore(ctx context.Context, dsn string, logger *slog.Logger, encryptionKey []byte, role models.Role) (service.PipelineStore, error) {
	return postgres.NewPostgres(ctx, dsn, logger, encryptionKey, role)
}

// NewPool creates a bare connection pool for lightweight use cases such as
// running data migrations from an init container.
func NewPool(ctx context.Context, dsn string) (*pgxpool.Pool, error) {
	return postgres.NewPool(ctx, dsn)
}
