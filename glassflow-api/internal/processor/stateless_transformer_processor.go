package processor

import (
	"context"
	"time"

	"errors"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/pkg/observability"
)

type statelessTransformer interface {
	Transform(ctx context.Context, inputMessage models.Message) (models.Message, error)
}

type StatelessTransformerProcessor struct {
	transformer statelessTransformer
}

func NewStatelessTransformerProcessor(transformer statelessTransformer) *StatelessTransformerProcessor {
	return &StatelessTransformerProcessor{
		transformer: transformer,
	}
}

func (stp *StatelessTransformerProcessor) ProcessBatch(
	ctx context.Context,
	batch ProcessorBatch,
) ProcessorBatch {
	start := time.Now()

	var inBytes int64
	for _, msg := range batch.Messages {
		inBytes += int64(len(msg.Payload()))
	}
	observability.RecordBytesProcessed(ctx, "transform", "in", inBytes)

	result := ProcessorBatch{}
	for _, message := range batch.Messages {
		transformedMessage, err := stp.transformer.Transform(ctx, message)
		if err != nil {
			if errors.Is(err, models.ErrSignalSent) {
				return ProcessorBatch{
					FatalError: models.ErrSignalSent,
				}
			}

			result.FailedMessages = append(
				result.FailedMessages,
				models.FailedMessage{
					Message: message,
					Error:   err,
				},
			)

			continue
		}

		result.Messages = append(
			result.Messages,
			transformedMessage,
		)
	}

	duration := time.Since(start).Seconds()
	observability.RecordProcessingDuration(ctx, "transform", duration)
	if len(result.Messages) > 0 {
		observability.RecordProcessorMessages(ctx, "transform", "success", int64(len(result.Messages)))
	}
	if len(result.FailedMessages) > 0 {
		observability.RecordProcessorMessages(ctx, "transform", "error", int64(len(result.FailedMessages)))
	}

	var outBytes int64
	for _, msg := range result.Messages {
		outBytes += int64(len(msg.Payload()))
	}
	observability.RecordBytesProcessed(ctx, "transform", "out", outBytes)

	return result
}

func (stp *StatelessTransformerProcessor) Close(_ context.Context) error {
	return nil
}
