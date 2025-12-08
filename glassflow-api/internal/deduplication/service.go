package deduplication

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/nats-io/nats.go/jetstream"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/deduplication/badger"
)

type batchReader interface {
	ReadBatchNoWait(ctx context.Context, batchSize int) ([]jetstream.Msg, error)
	ReadBatch(ctx context.Context, batchSize int, opts ...jetstream.FetchOpt) ([]jetstream.Msg, error)
}

type batchWriter interface {
	WriteBatch(ctx context.Context, messages []jetstream.Msg) error
}

type DedupService struct {
	reader       batchReader
	writer       batchWriter
	deduplicator *badger.Deduplicator
	cancel       context.CancelFunc
	shutdownOnce sync.Once
	log          *slog.Logger
	doneCh       chan struct{}
	batchSize    int
	maxWait      time.Duration
}

// NewDedupService creates a new deduplication consumer
func NewDedupService(
	reader batchReader,
	writer batchWriter,
	deduplicator *badger.Deduplicator,
	log *slog.Logger,
	batchSize int,
	maxWait time.Duration,
) (*DedupService, error) {
	return &DedupService{
		reader:       reader,
		writer:       writer,
		deduplicator: deduplicator,
		log:          log,
		batchSize:    batchSize,
		maxWait:      maxWait,
		doneCh:       make(chan struct{}),
	}, nil
}

// Start runs the deduplication consumer
func (c *DedupService) Start(ctx context.Context) error {
	c.log.InfoContext(ctx, "Deduplication consumer started")
	defer c.log.InfoContext(ctx, "Deduplication consumer stopped")
	defer close(c.doneCh)

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
			err := c.Process(ctx)
			if err != nil {
				// Don't log context cancellation errors (shutdown)
				if !errors.Is(err, context.Canceled) && !errors.Is(err, context.DeadlineExceeded) {
					c.log.ErrorContext(ctx, "failed to process messages", "error", err)
				}
			}
		}
	}
}

func (c *DedupService) Process(ctx context.Context) error {
	batchMessages, err := c.reader.ReadBatch(
		ctx,
		c.batchSize,
		jetstream.FetchMaxWait(c.maxWait),
	)
	if err != nil {
		return fmt.Errorf("read batch: %w", err)
	}

	err = c.processMessages(ctx, batchMessages)

	return err
}

// handleShutdown handles the shutdown logic
func (c *DedupService) handleShutdown(ctx context.Context) error {
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
func (c *DedupService) processMessages(ctx context.Context, batchMessages []jetstream.Msg) error {
	err := c.deduplicator.Deduplicate(
		ctx,
		batchMessages,
		// Use a function to ensure atomic writes: only commit the KV transaction after successfully writing to the destination.
		func(ctx context.Context, filteredMessages []jetstream.Msg) error {
			err := c.writer.WriteBatch(ctx, filteredMessages)
			if err != nil {
				return fmt.Errorf("write batch: %w", err)
			}

			if err := c.ackMessages(ctx, batchMessages); err != nil {
				return fmt.Errorf("failed to ack after successful write: %w", err)
			}

			c.log.InfoContext(ctx, "Deduplicated messages",
				"input_count", len(batchMessages),
				"unique_count", len(filteredMessages),
				"duplicates_filtered", len(batchMessages)-len(filteredMessages))

			return nil
		},
	)
	if err != nil {
		c.nakMessages(ctx, batchMessages)
		return fmt.Errorf("deduplicate: %w", err)
	}

	return nil
}

func (c *DedupService) nakMessages(ctx context.Context, messages []jetstream.Msg) {
	for _, msg := range messages {
		if err := msg.Nak(); err != nil {
			c.log.ErrorContext(ctx, "failed to nak message", "error", err)
		}
	}
}

func (c *DedupService) ackMessages(_ context.Context, messages []jetstream.Msg) error {
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

func (c *DedupService) Done() <-chan struct{} {
	return c.doneCh
}

// Shutdown gracefully stops the consumer
func (c *DedupService) Shutdown() {
	c.shutdownOnce.Do(func() {
		if c.cancel != nil {
			c.cancel()
		}
	})
}
