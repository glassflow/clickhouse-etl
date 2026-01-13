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

// BatchWriter implements batch.BatchWriter interface for NATS JetStream with async publishing
type BatchWriter struct {
	js      jetstream.JetStream
	subject string
}

// NewBatchWriter creates a new NATS async batch writer
func NewBatchWriter(
	js jetstream.JetStream,
	subject string,
) *BatchWriter {
	batchWriter := &BatchWriter{
		js:      js,
		subject: subject,
	}

	return batchWriter
}

// WriteBatch writes a batch of messages to NATS asynchronously
func (w *BatchWriter) WriteBatch(_ context.Context, messages []models.Message) []models.FailedMessage {
	if len(messages) == 0 {
		return nil
	}

	futures := make([]jetstream.PubAckFuture, 0, len(messages))
	var failedMessages []models.FailedMessage

	for _, msg := range messages {
		natsMsg := w.convertToNatsMsg(msg)

		future, err := w.js.PublishMsgAsync(natsMsg)
		if err != nil {
			// Failed to queue for async publishing - treat as failed message
			failedMessages = append(failedMessages, models.FailedMessage{
				Message: &models.Message{
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

	// Wait for all async publishes to complete
	<-w.js.PublishAsyncComplete()

	for _, future := range futures {
		select {
		case <-future.Ok():
			continue
		case err := <-future.Err():
			failedMessages = append(failedMessages, models.FailedMessage{
				Message: &models.Message{
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
		Subject: w.subject,
		Data:    msg.Payload(),
	}

	// TODO handle kafka partition?
	// we can leverage headers for it, but for now it's not needed

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
