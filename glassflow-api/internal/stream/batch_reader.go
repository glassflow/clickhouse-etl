package stream

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/nats-io/nats.go"
	"github.com/nats-io/nats.go/jetstream"
)

// BatchReader reads messages from NATS JetStream in batches.
type BatchReader struct {
	consumer jetstream.Consumer
	log      *slog.Logger
}

func NewBatchReader(
	consumer jetstream.Consumer,
	log *slog.Logger,
) *BatchReader {
	return &BatchReader{
		consumer: consumer,
		log:      log,
	}
}

func (r *BatchReader) ReadBatchNoWait(ctx context.Context, batchSize int) ([]*nats.Msg, error) {
	msgBatch, err := r.consumer.FetchNoWait(batchSize)
	if err != nil {
		return nil, fmt.Errorf("FetchNoWait: %w", err)
	}

	return r.fetchMessagesFromBatch(ctx, msgBatch)
}

func (r *BatchReader) ReadBatch(
	ctx context.Context,
	batchSize int,
	opts ...jetstream.FetchOpt,
) ([]*nats.Msg, error) {
	msgBatch, err := r.consumer.Fetch(batchSize, opts...)
	if err != nil {
		return nil, fmt.Errorf("FetchNoWait: %w", err)
	}

	return r.fetchMessagesFromBatch(ctx, msgBatch)
}

func (r *BatchReader) fetchMessagesFromBatch(
	ctx context.Context,
	msgBatch jetstream.MessageBatch,
) ([]*nats.Msg, error) {
	messages := make([]*nats.Msg, 0)
	for msg := range msgBatch.Messages() {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		default:
		}

		if msg == nil {
			break
		}
		messages = append(messages, &nats.Msg{
			Subject: msg.Subject(),
			Data:    msg.Data(),
			Header:  msg.Headers(),
		})
	}

	if len(messages) == 0 {
		return nil, nil
	}

	if msgBatch.Error() != nil {
		return nil, fmt.Errorf("fetch messages: %w", msgBatch.Error())
	}

	r.log.Debug("Fetched batch from NATS", slog.Int("message_count", len(messages)))

	return messages, nil
}
