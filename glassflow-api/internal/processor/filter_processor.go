package processor

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/pkg/observability"
)

type filter interface {
	Matches([]byte) (bool, error)
}

type FilterProcessor struct {
	filter filter
	meter  *observability.Meter
	log    *slog.Logger
}

func (fp *FilterProcessor) Close(_ context.Context) error {
	return nil
}

func NewFilterProcessor(filter filter, meter *observability.Meter, log *slog.Logger) *FilterProcessor {
	return &FilterProcessor{
		filter: filter,
		meter:  meter,
		log:    log,
	}
}

func (fp *FilterProcessor) ProcessBatch(
	ctx context.Context,
	batch ProcessorBatch,
) ProcessorBatch {
	start := time.Now()

	messages := make([]models.Message, 0, len(batch.Messages))
	failedMessages := make([]models.FailedMessage, 0)

	for _, msg := range batch.Messages {
		matched, err := fp.filter.Matches(msg.Payload())
		if err != nil {
			failedMessages = append(failedMessages, models.FailedMessage{
				Message: msg,
				Error:   fmt.Errorf("filter evaluation error: %w", err),
			})
			continue
		}

		if matched {
			// Message matches the filter expression, so it should be filtered out
			continue
		}

		messages = append(messages, msg)
	}

	duration := time.Since(start).Seconds()
	if fp.meter != nil {
		fp.meter.RecordProcessorDuration(ctx, "filter", duration)

		successCount := int64(len(messages))
		if successCount > 0 {
			fp.meter.RecordProcessorMessages(ctx, "filter", "success", successCount)
		}

		filteredCount := int64(len(batch.Messages) - len(messages) - len(failedMessages))
		if filteredCount > 0 {
			fp.meter.RecordProcessorMessages(ctx, "filter", "filtered", filteredCount)
		}

		if len(failedMessages) > 0 {
			fp.meter.RecordProcessorMessages(ctx, "filter", "error", int64(len(failedMessages)))
		}
	}

	if fp.log != nil {
		filteredOut := len(batch.Messages) - len(messages) - len(failedMessages)
		fp.log.InfoContext(ctx, "Filter batch completed",
			slog.Int("passed", len(messages)),
			slog.Int("filtered", filteredOut),
			slog.Int("dlq_count", len(failedMessages)),
		)
	}

	return ProcessorBatch{
		Messages:       messages,
		FailedMessages: failedMessages,
	}
}
