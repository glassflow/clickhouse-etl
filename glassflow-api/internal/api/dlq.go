package api

import (
	"context"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

type DLQ interface {
	FetchDLQMessages(ctx context.Context, stream string, batchSize int) ([]models.DLQMessage, error)
	GetDLQState(ctx context.Context, stream string) (zero models.DLQState, _ error)
	PurgeDLQ(ctx context.Context, stream string) (err error)
}
