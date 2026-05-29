package processor

import (
	"context"

	"github.com/glassflow/clickhouse-etl/glassflow-api/internal/batch"
	"github.com/glassflow/clickhouse-etl/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl/glassflow-api/pkg/observability"
)

// DLQMiddleware returns a middleware that wraps a processor and writes failed messages to DLQ.
// reason must be one of the observability.DLQReason* constants.
func DLQMiddleware(dlqWriter batch.BatchWriter, role, reason string) func(Processor) Processor {
	return func(next Processor) Processor {
		return &dlqMiddleware{
			next:      next,
			dlqWriter: dlqWriter,
			role:      role,
			reason:    reason,
		}
	}
}

type dlqMiddleware struct {
	next      Processor
	dlqWriter batch.BatchWriter
	role      string
	reason    string
}

func (d *dlqMiddleware) Close(ctx context.Context) error {
	return nil
}

func (d *dlqMiddleware) ProcessBatch(ctx context.Context, batch ProcessorBatch) ProcessorBatch {
	result := d.next.ProcessBatch(ctx, batch)

	if batch.FatalError != nil {
		return batch
	}

	if len(result.FailedMessages) > 0 {
		dlqMessages := make([]models.Message, len(result.FailedMessages))
		for i, failedMsg := range result.FailedMessages {
			msg, err := models.FailedMessageToMessage(
				failedMsg,
				d.role,
				failedMsg.Error,
			)
			if err != nil {
				result.FatalError = err
				return result
			}
			dlqMessages[i] = msg
		}

		failedBatch := d.dlqWriter.WriteBatch(ctx, dlqMessages)
		if len(failedBatch) > 0 {
			result.FatalError = failedBatch[0].Error
			return result
		}

		observability.RecordDLQWrite(ctx, d.role, d.reason, int64(len(result.FailedMessages)))

		result.FailedMessages = nil
	}

	return result
}
