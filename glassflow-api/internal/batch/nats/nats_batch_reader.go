package nats

import (
	"context"
	"fmt"
	"sync"

	"github.com/nats-io/nats.go/jetstream"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/batch"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

// BatchReader implements batch.BatchReader interface for NATS JetStream
type BatchReader struct {
	consumer jetstream.Consumer
}

// NewBatchReader creates a new NATS batch reader
func NewBatchReader(
	consumer jetstream.Consumer,
) batch.BatchReader {
	return &BatchReader{
		consumer: consumer,
	}
}

// ReadBatch reads a batch of messages from NATS with waiting
func (r *BatchReader) ReadBatch(ctx context.Context, options ...models.FetchOption) ([]models.Message, error) {
	fetchOpts := models.ApplyFetchOptions(options...)
	natsOpts := r.convertToNatsOptions(fetchOpts)

	msgBatch, err := r.consumer.Fetch(fetchOpts.BatchSize, natsOpts...)
	if err != nil {
		return nil, fmt.Errorf("fetch: %w", err)
	}

	return r.fetchMessagesFromBatch(ctx, msgBatch)
}

// ReadBatchNoWait reads a batch of messages from NATS without waiting
func (r *BatchReader) ReadBatchNoWait(ctx context.Context, options ...models.FetchOption) ([]models.Message, error) {
	fetchOpts := models.ApplyFetchOptions(options...)

	msgBatch, err := r.consumer.FetchNoWait(fetchOpts.BatchSize)
	if err != nil {
		return nil, fmt.Errorf("fetchNoWait: %w", err)
	}

	return r.fetchMessagesFromBatch(ctx, msgBatch)
}

// Ack acknowledges messages
func (r *BatchReader) Ack(_ context.Context, messages []models.Message) error {
	if len(messages) == 0 {
		return nil
	}

	// Ack the last message which acks all previous messages in the batch (only with AckAll policy)
	lastMsg := messages[len(messages)-1]
	if lastMsg.Type != models.MessageTypeJetstreamMsg {
		return fmt.Errorf("cannot ack non-NATS jetstream message: type=%s", lastMsg.Type)
	}
	if lastMsg.JetstreamMsgOriginal == nil {
		return fmt.Errorf("missing jestream NATS original message")
	}

	if err := lastMsg.JetstreamMsgOriginal.Ack(); err != nil {
		return fmt.Errorf("failed to ack batch: %w", err)
	}

	return nil
}

// Nak negatively acknowledges messages
func (r *BatchReader) Nak(_ context.Context, messages []models.Message) error {
	for _, msg := range messages {
		if msg.Type != models.MessageTypeJetstreamMsg {
			return fmt.Errorf("cannot nak non-NATS message: type=%s", msg.Type)
		}
		if msg.JetstreamMsgOriginal == nil {
			return fmt.Errorf("missing NATS original message")
		}

		if err := msg.JetstreamMsgOriginal.Nak(); err != nil {
			return fmt.Errorf("nak message: %w", err)
		}
	}
	return nil
}

// convertToNatsOptions converts FetchOpts to NATS JetStream FetchOpt options
func (r *BatchReader) convertToNatsOptions(opts models.FetchOpts) []jetstream.FetchOpt {
	var natsOpts []jetstream.FetchOpt

	if opts.Timeout > 0 {
		natsOpts = append(natsOpts, jetstream.FetchMaxWait(opts.Timeout))
	}

	return natsOpts
}

func (r *BatchReader) fetchMessagesFromBatch(
	ctx context.Context,
	messageBatch jetstream.MessageBatch,
) ([]models.Message, error) {
	messages := make([]models.Message, 0)

	for msg := range messageBatch.Messages() {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		default:
		}

		if msg == nil {
			break
		}

		modelMessage := models.Message{
			Type:                 models.MessageTypeJetstreamMsg,
			JetstreamMsgOriginal: msg,
		}

		messages = append(messages, modelMessage)
	}

	if len(messages) == 0 {
		return nil, nil
	}

	if messageBatch.Error() != nil {
		return nil, fmt.Errorf("fetch messages: %w", messageBatch.Error())
	}

	return messages, nil
}

// consumeHandle wraps jetstream.ConsumeContext to implement batch.ConsumeContext
type consumeHandle struct {
	consumeCtx jetstream.ConsumeContext
	doneCh     chan struct{}
	stopOnce   sync.Once
}

func (h *consumeHandle) Stop() {
	h.stopOnce.Do(func() {
		if h.consumeCtx != nil {
			h.consumeCtx.Stop()
		}
	})
}

func (h *consumeHandle) Done() <-chan struct{} {
	return h.doneCh
}

// Consume starts continuous message consumption using a callback handler
func (r *BatchReader) Consume(
	ctx context.Context,
	handler batch.MessageHandler,
	opts ...models.FetchOption,
) (batch.ConsumeContext, error) {
	fetchOpts := models.ApplyFetchOptions(opts...)

	var natsOpts []jetstream.PullConsumeOpt
	if fetchOpts.BatchSize > 0 {
		natsOpts = append(natsOpts, jetstream.PullMaxMessages(fetchOpts.BatchSize))
	}
	if fetchOpts.Timeout > 0 {
		natsOpts = append(natsOpts, jetstream.PullExpiry(fetchOpts.Timeout))
	}

	natsHandler := func(msg jetstream.Msg) {
		modelMsg := models.Message{
			Type:                 models.MessageTypeJetstreamMsg,
			JetstreamMsgOriginal: msg,
		}
		handler(modelMsg)
	}

	consumeCtx, err := r.consumer.Consume(natsHandler, natsOpts...)
	if err != nil {
		return nil, fmt.Errorf("consume: %w", err)
	}

	handle := &consumeHandle{
		consumeCtx: consumeCtx,
		doneCh:     make(chan struct{}),
	}

	go func() {
		defer close(handle.doneCh)
		select {
		case <-ctx.Done():
			consumeCtx.Stop()
		case <-consumeCtx.Closed():
			// ConsumeContext closed externally
		}
	}()

	return handle, nil
}
