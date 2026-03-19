package processor

import (
	"context"
	"fmt"
	"time"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/pkg/observability"
)

type filter interface {
	Matches([]byte) (bool, error)
}

type FilterProcessor struct {
	filter filter
}

func (fp *FilterProcessor) Close(_ context.Context) error {
	return nil
}

func NewFilterProcessor(filter filter) *FilterProcessor {
	return &FilterProcessor{
		filter: filter,
	}
}

func (fp *FilterProcessor) ProcessBatch(
	ctx context.Context,
	batch ProcessorBatch,
) ProcessorBatch {
	start := time.Now()

	var inBytes int64
	for _, msg := range batch.Messages {
		inBytes += int64(len(msg.Payload()))
	}
	observability.RecordBytesProcessed(ctx, "filter", "in", inBytes)

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
	observability.RecordProcessingDuration(ctx, "filter", duration)

	successCount := int64(len(messages))
	if successCount > 0 {
		observability.RecordProcessorMessages(ctx, "filter", "success", successCount)
	}

	filteredCount := int64(len(batch.Messages) - len(messages) - len(failedMessages))
	if filteredCount > 0 {
		observability.RecordProcessorMessages(ctx, "filter", "filtered", filteredCount)
	}

	if len(failedMessages) > 0 {
		observability.RecordProcessorMessages(ctx, "filter", "error", int64(len(failedMessages)))
	}

	var outBytes int64
	for _, msg := range messages {
		outBytes += int64(len(msg.Payload()))
	}
	observability.RecordBytesProcessed(ctx, "filter", "out", outBytes)

	return ProcessorBatch{
		Messages:       messages,
		FailedMessages: failedMessages,
	}
}
