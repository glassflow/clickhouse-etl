package nats

import (
	"context"
	"fmt"
	"time"

	"github.com/nats-io/nats.go"
	"github.com/nats-io/nats.go/jetstream"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

type subjectRouter interface {
	Subject(msg []byte) string
}

// BatchWriter implements batch.BatchWriter interface for NATS JetStream with async publishing
type BatchWriter struct {
	js            jetstream.JetStream
	subjectRouter subjectRouter
	chunkSize     int
}

// NewBatchWriter creates a new NATS async batch writer.
// chunkSize controls how many messages are published per async round-trip;
// use a value <= 0 to publish all messages in a single chunk.
func NewBatchWriter(
	js jetstream.JetStream,
	subjectRouter subjectRouter,
	chunkSize int,
) *BatchWriter {
	return &BatchWriter{
		js:            js,
		subjectRouter: subjectRouter,
		chunkSize:     chunkSize,
	}
}

// WriteBatch writes a batch of messages to NATS asynchronously.
// Messages are published in chunks to cap peak memory usage from in-flight futures.
func (w *BatchWriter) WriteBatch(ctx context.Context, messages []models.Message) []models.FailedMessage {
	if len(messages) == 0 {
		return nil
	}

	chunkSize := w.chunkSize
	if chunkSize <= 0 {
		chunkSize = len(messages)
	}

	var failedMessages []models.FailedMessage
	for i := 0; i < len(messages); i += chunkSize {
		end := i + chunkSize
		if end > len(messages) {
			end = len(messages)
		}
		failed := w.writeChunk(ctx, messages[i:end])
		failedMessages = append(failedMessages, failed...)
	}
	return failedMessages
}

func (w *BatchWriter) writeChunk(_ context.Context, messages []models.Message) []models.FailedMessage {
	futures := make([]jetstream.PubAckFuture, 0, len(messages))
	var failedMessages []models.FailedMessage

	for _, msg := range messages {
		natsMsg := w.convertToNatsMsg(msg)

		future, err := w.js.PublishMsgAsync(natsMsg)
		if err != nil {
			failedMessages = append(failedMessages, models.FailedMessage{
				Message: models.Message{
					Type:            models.MessageTypeNatsMsg,
					NatsMsgOriginal: natsMsg,
				},
				Error: err,
			})
			continue
		}

		futures = append(futures, future)
	}

	if len(futures) == 0 {
		return failedMessages
	}

	<-w.js.PublishAsyncComplete()

	for _, future := range futures {
		select {
		case <-future.Ok():
			continue
		case err := <-future.Err():
			failedMessages = append(failedMessages, models.FailedMessage{
				Message: models.Message{
					Type:            models.MessageTypeNatsMsg,
					NatsMsgOriginal: future.Msg(),
				},
				Error: err,
			})
		}
	}

	return failedMessages
}

// Close closes the batch writer
func (w *BatchWriter) Close() error {
	// Wait for any pending async publishes to complete

	select {
	case <-w.js.PublishAsyncComplete():
	case <-time.After(internal.DefaultComponentShutdownTimeout):
		return fmt.Errorf("publish async complete timed out")
	}

	return nil
}

// convertToNatsMsg converts a models.Message to a NATS message
func (w *BatchWriter) convertToNatsMsg(msg models.Message) *nats.Msg {
	natsMsg := &nats.Msg{
		Subject: w.subjectRouter.Subject(msg.Payload()),
		Data:    msg.Payload(),
	}

	// Get all headers (original + internal mutations)
	headers := msg.Headers()
	if len(headers) > 0 {
		natsMsg.Header = make(nats.Header)
		for key, values := range headers {
			for _, value := range values {
				natsMsg.Header.Add(key, value)
			}
		}
	}

	return natsMsg
}
