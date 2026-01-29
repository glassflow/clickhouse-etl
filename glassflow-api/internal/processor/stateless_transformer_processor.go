package processor

import (
	"context"
	"time"

	"github.com/nats-io/nats.go"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/pkg/observability"
)

type statelessTransformer interface {
	Transform(inputBytes []byte) ([]byte, error)
}

type StatelessTransformerProcessor struct {
	transformer statelessTransformer
	meter       *observability.Meter
}

func NewStatelessTransformerProcessor(transformer statelessTransformer, meter *observability.Meter) *StatelessTransformerProcessor {
	return &StatelessTransformerProcessor{
		transformer: transformer,
		meter:       meter,
	}
}

func (stp *StatelessTransformerProcessor) ProcessBatch(
	ctx context.Context,
	batch ProcessorBatch,
) ProcessorBatch {
	start := time.Now()

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

	duration := time.Since(start).Seconds()
	if stp.meter != nil {
		stp.meter.RecordProcessorDuration(ctx, "transform", duration)
		if len(result.Messages) > 0 {
			stp.meter.RecordProcessorMessages(ctx, "transform", "success", int64(len(result.Messages)))
		}
		if len(result.FailedMessages) > 0 {
			stp.meter.RecordProcessorMessages(ctx, "transform", "error", int64(len(result.FailedMessages)))
		}
	}

	return result
}

func (stp *StatelessTransformerProcessor) Close(_ context.Context) error {
	return nil
}
