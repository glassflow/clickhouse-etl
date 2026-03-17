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
	start := time.Now()

	var inBytes int64
	for _, msg := range batch.Messages {
		inBytes += int64(len(msg.Payload()))
	}
	if fp.meter != nil {
		fp.meter.RecordBytesProcessed(ctx, "filter", "in", inBytes)
	}

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
		fp.meter.RecordProcessingDuration(ctx, "filter", duration)

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

		var outBytes int64
		for _, msg := range messages {
			outBytes += int64(len(msg.Payload()))
		}
		fp.meter.RecordBytesProcessed(ctx, "filter", "out", outBytes)
	}

	return ProcessorBatch{
		Messages:       messages,
		FailedMessages: failedMessages,
	}
}
