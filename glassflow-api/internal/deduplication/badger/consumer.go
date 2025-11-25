package badger

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/nats-io/nats.go"
	"github.com/nats-io/nats.go/jetstream"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
)

type batchReader interface {
	ReadBatchNoWait(ctx context.Context, batchSize int) ([]*nats.Msg, error)
	ReadBatch(ctx context.Context, batchSize int, opts ...jetstream.FetchOpt) ([]*nats.Msg, error)
}

type batchWriter interface {
	WriteBatch(ctx context.Context, messages []*nats.Msg) error
}

type Consumer struct {
	reader       batchReader
	writer       batchWriter
	deduplicator Deduplicator
	cancel       context.CancelFunc
	shutdownOnce sync.Once
	log          *slog.Logger
	batchSize    int
	maxWait      time.Duration
}

// NewConsumer creates a new deduplication consumer
func NewConsumer(
	reader batchReader,
	writer batchWriter,
	deduplicator Deduplicator,
	log *slog.Logger,
	batchSize int,
	maxWait time.Duration,
) (*Consumer, error) {
	return &Consumer{
		reader:       reader,
		writer:       writer,
		deduplicator: deduplicator,
		log:          log,
		batchSize:    batchSize,
		maxWait:      maxWait,
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
			batchMessages, err := c.reader.ReadBatch(
				ctx,
				c.batchSize,
				jetstream.FetchMaxWait(c.maxWait),
			)
			if err != nil {
				return fmt.Errorf("read batch: %w", err)
			}

			err = c.processMessages(ctx, batchMessages)
			if err != nil {
				// Don't log context cancellation errors (shutdown)
				if !errors.Is(err, context.Canceled) && !errors.Is(err, context.DeadlineExceeded) {
					c.log.ErrorContext(ctx, "failed to process messages", "error", err)
				}
			}
		}
	}
}

// handleShutdown handles the shutdown logic
func (c *Consumer) handleShutdown(ctx context.Context) error {
	c.log.InfoContext(ctx, "Deduplication consumer shutting down")

	batchMessages, err := c.reader.ReadBatchNoWait(ctx, c.batchSize)
	if err != nil {
		return fmt.Errorf("read batch: %w", err)
	}

	err = c.processMessages(ctx, batchMessages)
	if err != nil {
		return fmt.Errorf("flush pending messages: %w", err)
	}

	return nil
}

// processMessages reads, deduplicates, and writes messages
func (c *Consumer) processMessages(ctx context.Context, batchMessages []*nats.Msg) error {
	err := c.deduplicator.Deduplicate(
		ctx,
		batchMessages,
		// Use a function to ensure atomic writes: only commit the KV transaction after successfully writing to the destination.
		func(ctx context.Context, messages []*nats.Msg) error {
			err := c.writer.WriteBatch(ctx, messages)
			if err != nil {
				return fmt.Errorf("write batch: %w", err)
			}

			if err := c.ackMessages(ctx, messages); err != nil {
				return fmt.Errorf("failed to ack after successful write: %w", err)
			}

			c.log.InfoContext(ctx, "Deduplicated messages",
				"input_count", len(batchMessages),
				"unique_count", len(messages),
				"duplicates_filtered", len(batchMessages)-len(messages))

			return nil
		},
	)
	if err != nil {
		return fmt.Errorf("deduplicate: %w", err)
	}

	return nil
}

func (c *Consumer) ackMessages(_ context.Context, messages []*nats.Msg) error {
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

// Stop gracefully stops the consumer
func (c *Consumer) Stop() {
	c.shutdownOnce.Do(func() {
		if c.cancel != nil {
			c.cancel()
		}
	})
}
