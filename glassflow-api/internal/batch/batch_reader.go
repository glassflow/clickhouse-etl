package batch

import (
	"context"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

type BatchReader interface {
	ReadBatch(context.Context, ...models.FetchOption) ([]models.Message, error)
	ReadBatchNoWait(context.Context, ...models.FetchOption) ([]models.Message, error)
	Ack(ctx context.Context, messages []models.Message) error
	Nak(ctx context.Context, messages []models.Message) error
}
