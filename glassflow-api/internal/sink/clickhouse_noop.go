package sink

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/avast/retry-go"

	"github.com/nats-io/nats.go/jetstream"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/schema"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/stream"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/pkg/observability"
)

type ClickHouseNoOpSink struct {
	streamConsumer jetstream.Consumer
	schemaMapper   schema.Mapper
	cancel         context.CancelFunc
	shutdownOnce   sync.Once
	sinkConfig     models.SinkComponentConfig
	streamSourceID string
	log            *slog.Logger
	meter          *observability.Meter
	dlqPublisher   stream.Publisher

	messageBuffer     []jetstream.Msg
	bufferMu          sync.Mutex
	bufferFlushTicker *time.Ticker
	maxBatchSize      int
	maxDelayTime      time.Duration
	consumeContext    jetstream.ConsumeContext
}

func NewClickHouseNoOpSink(
	sinkConfig models.SinkComponentConfig,
	streamConsumer jetstream.Consumer,
	schemaMapper schema.Mapper,
	log *slog.Logger,
	meter *observability.Meter,
	dlqPublisher stream.Publisher,
	streamSourceID string,
) (*ClickHouseNoOpSink, error) {
	if sinkConfig.Batch.MaxBatchSize <= 0 {
		return nil, fmt.Errorf("invalid max batch size, should be > 0: %d", sinkConfig.Batch.MaxBatchSize)
	}

	maxDelayTime := internal.SinkDefaultBatchMaxDelayTime
	if sinkConfig.Batch.MaxDelayTime.Duration() != 0 {
		maxDelayTime = sinkConfig.Batch.MaxDelayTime.Duration()
	}

	return &ClickHouseNoOpSink{
		streamConsumer: streamConsumer,
		schemaMapper:   schemaMapper,
		sinkConfig:     sinkConfig,
		log:            log,
		meter:          meter,
		dlqPublisher:   dlqPublisher,
		streamSourceID: streamSourceID,
		maxBatchSize:   sinkConfig.Batch.MaxBatchSize,
		maxDelayTime:   maxDelayTime,
		messageBuffer:  make([]jetstream.Msg, 0, sinkConfig.Batch.MaxBatchSize),
	}, nil
}

func (ch *ClickHouseNoOpSink) Start(ctx context.Context) error {
	ch.log.InfoContext(ctx, "ClickHouse NoOp sink started (NATS IO benchmark mode)",
		"max_batch_size", ch.maxBatchSize,
		"max_delay_time", ch.maxDelayTime,
		"mode", "noop_benchmark",
		"note", "Messages will be read from NATS and acked without writing to ClickHouse")

	defer ch.log.InfoContext(ctx, "ClickHouse NoOp sink stopped")

	ctx, cancel := context.WithCancel(ctx)
	ch.cancel = cancel
	defer cancel()

	// Create ticker for time-based flushing
	ch.bufferFlushTicker = time.NewTicker(ch.maxDelayTime)
	defer ch.bufferFlushTicker.Stop()

	// Start background goroutine for time-based flushing
	go ch.flushTickerLoop(ctx)

	// Message handler - called by Consume() as messages arrive
	messageHandler := func(msg jetstream.Msg) {
		ch.bufferMu.Lock()
		ch.messageBuffer = append(ch.messageBuffer, msg)
		shouldFlush := len(ch.messageBuffer) >= ch.maxBatchSize
		ch.bufferMu.Unlock()

		// Flush immediately if batch size reached
		if shouldFlush {
			ch.flushBuffer(ctx)
		}
	}

	// Start consuming using callback pattern (same as ClickHouseSink)
	cc, err := ch.streamConsumer.Consume(
		messageHandler,
		jetstream.PullMaxMessages(ch.maxBatchSize), // Pull in batches
	)
	if err != nil {
		return fmt.Errorf("failed to start consuming: %w", err)
	}
	ch.consumeContext = cc
	defer cc.Stop()

	// Wait for shutdown
	<-ctx.Done()

	// Handle graceful shutdown
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), internal.SinkDefaultShutdownTimeout)
	defer shutdownCancel()
	return ch.handleShutdown(shutdownCtx)
}

// flushTickerLoop handles time-based flushing
func (ch *ClickHouseNoOpSink) flushTickerLoop(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		case <-ch.bufferFlushTicker.C:
			ch.flushBuffer(ctx)
		}
	}
}

// flushBuffer atomically extracts and processes buffered messages
func (ch *ClickHouseNoOpSink) flushBuffer(ctx context.Context) {
	ch.bufferMu.Lock()
	if len(ch.messageBuffer) == 0 {
		ch.bufferMu.Unlock()
		return
	}

	// Extract messages atomically
	messages := make([]jetstream.Msg, len(ch.messageBuffer))
	copy(messages, ch.messageBuffer)
	ch.messageBuffer = ch.messageBuffer[:0] // Clear buffer
	ch.bufferMu.Unlock()

	// Process batch (just ack, no ClickHouse write)
	err := ch.flushEvents(ctx, messages)
	if err != nil {
		ch.log.ErrorContext(ctx, "failed to flush buffer", "error", err, "batch_size", len(messages))
	}
}

func (ch *ClickHouseNoOpSink) handleShutdown(ctx context.Context) error {
	ch.log.InfoContext(ctx, "ClickHouse NoOp sink shutting down")

	// Stop consuming new messages
	if ch.consumeContext != nil {
		ch.consumeContext.Stop()
	}

	// Flush any remaining messages
	ch.flushBuffer(ctx)

	return nil
}

func (ch *ClickHouseNoOpSink) flushEvents(ctx context.Context, messages []jetstream.Msg) error {
	err := ch.sendBatch(ctx, messages)
	if err == nil {
		return nil
	}
	ch.log.Error("failed to ack batch", "error", err, "batch_size", len(messages))

	// Even on error, try to ack messages to avoid redelivery
	// (in real scenario, you might want to handle this differently)
	for _, msg := range messages {
		_ = msg.Ack()
	}

	return fmt.Errorf("flush batch: %w", err)
}

func (ch *ClickHouseNoOpSink) sendBatch(ctx context.Context, messages []jetstream.Msg) error {
	if len(messages) == 0 {
		return nil
	}

	size := len(messages)
	start := time.Now()

	// NO ClickHouse write, just pure NATS IO throughput

	if ch.meter != nil {
		// Record NATS-only consumption metrics
		ch.meter.RecordNATSConsumption(ctx, int64(size))

		// Calculate and record NATS consumption rate
		duration := time.Since(start).Seconds()
		if duration > 0 {
			rate := float64(size) / duration
			ch.meter.RecordNATSConsumptionRate(ctx, rate)
		}
	}

	for _, msg := range messages {
		err := retry.Do(
			func() error {
				return msg.Ack()
			},
			retry.Attempts(3),
			retry.DelayType(retry.FixedDelay),
		)
		if err != nil {
			return fmt.Errorf("acknowledge message: %w", err)
		}
	}

	ch.log.DebugContext(ctx, "Batch processed (noop mode - no ClickHouse write)",
		"message_count", size,
		"duration_ms", time.Since(start).Milliseconds(),
	)

	ch.log.InfoContext(ctx, "Batch processing completed successfully (NATS IO only)",
		"status", "success",
		"acked_messages", size,
		"duration_ms", time.Since(start).Milliseconds(),
	)

	return nil
}

func (ch *ClickHouseNoOpSink) Stop(noWait bool) {
	ch.shutdownOnce.Do(func() {
		if ch.cancel != nil {
			ch.cancel()
		}
		ch.log.Debug("Stop signal sent", "no_wait", noWait)
	})
}
