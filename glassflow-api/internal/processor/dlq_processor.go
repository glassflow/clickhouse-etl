package processor

import (
	"context"
	"log/slog"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/batch"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

// DLQMiddleware returns a middleware that wraps a processor and writes failed messages to DLQ.
// componentName is used in logs (e.g. "transform", "filter"). log may be nil to skip logging.
func DLQMiddleware(dlqWriter batch.BatchWriter, role string, componentName string, log *slog.Logger) func(Processor) Processor {
	return func(next Processor) Processor {
		return &dlqMiddleware{
			next:           next,
			dlqWriter:      dlqWriter,
			role:           role,
			componentName:  componentName,
			log:            log,
		}
	}
}

type dlqMiddleware struct {
	next          Processor
	dlqWriter     batch.BatchWriter
	role          string
	componentName string
	log           *slog.Logger
}

func (d *dlqMiddleware) Close(ctx context.Context) error {
	return nil
}

func (d *dlqMiddleware) ProcessBatch(ctx context.Context, batch ProcessorBatch) ProcessorBatch {
	result := d.next.ProcessBatch(ctx, batch)

	if len(result.FailedMessages) > 0 {
		result.DlqCount = len(result.FailedMessages)

		if d.log != nil {
			for _, failedMsg := range result.FailedMessages {
				d.log.ErrorContext(ctx, "message sent to DLQ",
					"component", d.componentName,
					"error", failedMsg.Error,
				)
			}
		}

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

		result.FailedMessages = nil
	}

	return result
}
