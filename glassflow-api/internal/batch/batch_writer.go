package batch

import (
	"context"

	"github.com/glassflow/clickhouse-etl/glassflow-api/internal/models"
)

type BatchWriter interface {
	WriteBatch(ctx context.Context, messages []models.Message) []models.FailedMessage
	Close() error
}
