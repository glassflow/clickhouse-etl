package processor

import (
	"context"
	"errors"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

type statelessTransformer interface {
	Transform(ctx context.Context, inputMessage models.Message) (models.Message, error)
}

type StatelessTransformerProcessor struct {
	transformer statelessTransformer
}

func NewStatelessTransformerProcessor(transformer statelessTransformer) *StatelessTransformerProcessor {
	return &StatelessTransformerProcessor{transformer: transformer}
}

func (stp *StatelessTransformerProcessor) ProcessBatch(
	ctx context.Context,
	batch ProcessorBatch,
) ProcessorBatch {
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

	return result
}

func (stp *StatelessTransformerProcessor) Close(_ context.Context) error {
	return nil
}
