package stream

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/nats-io/nats.go"
	"github.com/nats-io/nats.go/jetstream"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

type NatsAsyncBatchWriter struct {
	publisher             Publisher
	dlqPublisher          Publisher
	log                   *slog.Logger
	pendingPublishesLimit int
}

func NewNatsBatchWriter(
	publisher Publisher,
	dlqPublisher Publisher,
	log *slog.Logger,
	pendingPublishesLimit int,
) *NatsAsyncBatchWriter {
	return &NatsAsyncBatchWriter{
		publisher:             publisher,
		dlqPublisher:          dlqPublisher,
		log:                   log,
		pendingPublishesLimit: pendingPublishesLimit,
	}
}

func (w *NatsAsyncBatchWriter) WriteBatch(ctx context.Context, messages []jetstream.Msg) error {
	if len(messages) == 0 {
		return nil
	}

	futures := make([]jetstream.PubAckFuture, 0, len(messages))

	for _, msg := range messages {
		natsMsgToPublish := &nats.Msg{
			Subject: w.publisher.GetSubject(),
			Data:    msg.Data(),
			Header:  msg.Headers(),
		}

		fut, err := w.publisher.PublishNatsMsgAsync(natsMsgToPublish, w.pendingPublishesLimit)
		if err != nil {
			w.log.Error("Failed to publish message async",
				slog.Any("error", err),
				slog.String("subject", natsMsgToPublish.Subject))

			if dlqErr := w.pushMsgToDLQ(ctx, natsMsgToPublish.Data, err); dlqErr != nil {
				return fmt.Errorf("failed to publish async: %w", err)
			}

			continue
		}

		futures = append(futures, fut)
	}

	<-w.publisher.WaitForAsyncPublishAcks()

	for _, fut := range futures {
		select {
		case <-fut.Ok():
			continue
		case err := <-fut.Err():
			w.log.Error("Failed to receive async publish ack",
				slog.Any("error", err),
				slog.String("subject", fut.Msg().Subject))

			if dlqErr := w.pushMsgToDLQ(ctx, fut.Msg().Data, err); dlqErr != nil {
				return fmt.Errorf("async publish failed: %w", err)
			}
		}
	}

	return nil
}

func (w *NatsAsyncBatchWriter) pushMsgToDLQ(ctx context.Context, orgMsg []byte, err error) error {
	// we might want to write batches to dlq, so to avoid recursion we use nil dlq publisher in dlq batch writer
	if w.dlqPublisher == nil {
		return nil
	}

	w.log.Error("Pushing message to DLQ", slog.Any("error", err))

	data, err := models.NewDLQMessage("batch-writer", err.Error(), orgMsg).ToJSON()
	if err != nil {
		return fmt.Errorf("failed to convert DLQ message to JSON: %w", err)
	}

	err = w.dlqPublisher.Publish(ctx, data)
	if err != nil {
		return fmt.Errorf("failed to publish to DLQ: %w", err)
	}

	return nil
}
