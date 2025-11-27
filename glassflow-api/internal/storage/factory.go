package storage

import (
	"context"
	"log/slog"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/service"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/storage/postgres"
)

// NewPipelineStore creates a new PipelineStore implementation.
func NewPipelineStore(ctx context.Context, dsn string, logger *slog.Logger) (service.PipelineStore, error) {
	return postgres.NewPostgres(ctx, dsn, logger)
}
