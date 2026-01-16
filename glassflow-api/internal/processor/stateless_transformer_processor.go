package processor

import (
	"context"

	"github.com/nats-io/nats.go"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

type statelessTransformer interface {
	Transform(inputBytes []byte) ([]byte, error)
}

type StatelessTransformerProcessor struct {
	transformer statelessTransformer
}

func NewStatelessTransformerProcessor(transformer statelessTransformer) *StatelessTransformerProcessor {
	return &StatelessTransformerProcessor{transformer: transformer}
}

func (stp *StatelessTransformerProcessor) ProcessBatch(
	_ context.Context,
	batch ProcessorBatch,
) ProcessorBatch {
	result := ProcessorBatch{}
	for _, message := range batch.Messages {
		transformedBytes, err := stp.transformer.Transform(message.Payload())
		if err != nil {
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
			models.Message{
				Type: models.MessageTypeNatsMsg,
				NatsMsgOriginal: &nats.Msg{
					Data:   transformedBytes,
					Header: message.Headers(),
				},
			},
		)
	}

	return result
}

func (stp *StatelessTransformerProcessor) Close(_ context.Context) error {
	return nil
}
