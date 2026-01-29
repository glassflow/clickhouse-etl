package batch

import (
	"context"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

type MessageHandler func(msg models.Message)

type ConsumeContext interface {
	Stop()
	Done() <-chan struct{}
}

type BatchReader interface {
	ReadBatch(context.Context, ...models.FetchOption) ([]models.Message, error)
	ReadBatchNoWait(context.Context, ...models.FetchOption) ([]models.Message, error)
	Ack(ctx context.Context, messages []models.Message) error
	Nak(ctx context.Context, messages []models.Message) error
	Consume(ctx context.Context, handler MessageHandler, opts ...models.FetchOption) (ConsumeContext, error)
}
