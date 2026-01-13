package processor

import (
	"context"
	"fmt"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/pkg/observability"
)

type filter interface {
	Matches([]byte) (bool, error)
}

type FilterProcessor struct {
	filter filter
	meter  *observability.Meter
}

func (fp *FilterProcessor) Close(_ context.Context) error {
	return nil
}

func NewFilterProcessor(filter filter, meter *observability.Meter) *FilterProcessor {
	return &FilterProcessor{
		filter: filter,
		meter:  meter,
	}
}

func (fp *FilterProcessor) ProcessBatch(
	ctx context.Context,
	batch ProcessorBatch,
) ProcessorBatch {
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

	if fp.meter != nil {
		filteredCount := len(batch.Messages) - len(messages) - len(failedMessages)
		if filteredCount > 0 {
			fp.meter.RecordFilteredMessage(ctx, int64(filteredCount))
		}
	}

	return ProcessorBatch{
		Messages:       messages,
		FailedMessages: failedMessages,
	}
}
