package badger

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"sync"

	"github.com/nats-io/nats.go/jetstream"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
)

type batchReader interface {
	ReadBatch(ctx context.Context, nowait bool) ([]jetstream.Msg, error)
}

type batchWriter interface {
	WriteBatch(ctx context.Context, messages []jetstream.Msg) error
}

type Consumer struct {
	reader       batchReader
	writer       batchWriter
	deduplicator Deduplicator
	cancel       context.CancelFunc
	shutdownOnce sync.Once
	log          *slog.Logger
}

// NewConsumer creates a new deduplication consumer
func NewConsumer(
	reader batchReader,
	writer batchWriter,
	deduplicator Deduplicator,
	log *slog.Logger,
) (*Consumer, error) {
	return &Consumer{
		reader:       reader,
		writer:       writer,
		deduplicator: deduplicator,
		log:          log,
	}, nil
}

// Start runs the deduplication consumer
func (c *Consumer) Start(ctx context.Context) error {
	c.log.InfoContext(ctx, "Deduplication consumer started")
	defer c.log.InfoContext(ctx, "Deduplication consumer stopped")

	ctx, cancel := context.WithCancel(ctx)
	c.cancel = cancel
	defer cancel()

	for {
		select {
		case <-ctx.Done():
			shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), internal.SinkDefaultShutdownTimeout)
			defer shutdownCancel()
			return c.handleShutdown(shutdownCtx)
		default:
			nowait := false
			err := c.processMessages(ctx, nowait)
			if err != nil {
				// Don't log context cancellation errors (shutdown)
				if !errors.Is(err, context.Canceled) && !errors.Is(err, context.DeadlineExceeded) {
					c.log.ErrorContext(ctx, "failed to process messages", "error", err)
				}
			}
		}
	}
}

// Stop gracefully stops the consumer
func (c *Consumer) Stop() {
	c.shutdownOnce.Do(func() {
		if c.cancel != nil {
			c.cancel()
		}
	})
}

// handleShutdown handles the shutdown logic
func (c *Consumer) handleShutdown(ctx context.Context) error {
	c.log.InfoContext(ctx, "Deduplication consumer shutting down")

	nowait := true
	err := c.processMessages(ctx, nowait)
	if err != nil {
		return fmt.Errorf("flush pending messages: %w", err)
	}

	return nil
}

// processMessages reads, deduplicates, and writes messages
func (c *Consumer) processMessages(ctx context.Context, nowait bool) error {
	messages, err := c.reader.ReadBatch(ctx, nowait)
	if err != nil {
		return fmt.Errorf("read batch: %w", err)
	}

	err = c.deduplicator.Deduplicate(
		ctx,
		messages,
		// Use a function to ensure atomic writes: only commit the KV transaction after successfully writing to the destination.
		func(ctx context.Context, messages []jetstream.Msg) error {
			err = c.writer.WriteBatch(ctx, messages)
			if err != nil {
				return fmt.Errorf("write batch: %w", err)
			}

			if err := c.ackMessages(ctx, messages); err != nil {
				return fmt.Errorf("failed to ack after successful write: %w", err)
			}

			c.log.InfoContext(ctx, "Deduplicated messages",
				"input_count", len(messages),
				"unique_count", len(messages),
				"duplicates_filtered", len(messages)-len(messages))

			return nil
		},
	)
	if err != nil {
		return fmt.Errorf("deduplicate: %w", err)
	}

	return nil
}

func (c *Consumer) ackMessages(_ context.Context, messages []jetstream.Msg) error {
	if len(messages) == 0 {
		return nil
	}

	// Ack the last message which acks all previous messages in the batch (AckAll policy)
	lastMsg := messages[len(messages)-1]
	if err := lastMsg.Ack(); err != nil {
		return fmt.Errorf("failed to ack batch: %w", err)
	}

	return nil
}
