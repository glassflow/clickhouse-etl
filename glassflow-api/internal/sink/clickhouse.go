package sink

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"sync"
	"time"

	"github.com/nats-io/nats.go"
	"github.com/nats-io/nats.go/jetstream"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/batch"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/client"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/schema"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/stream"
)

type StopOptions struct {
	NoWait bool
}

type StopOtion func(*StopOptions)

func WithNoWait(noWait bool) StopOtion {
	return func(opts *StopOptions) {
		opts.NoWait = noWait
	}
}

type ClickHouseSink struct {
	client         *client.ClickHouseClient
	batch          batch.Batch
	streamCon      stream.Consumer
	schemaMapper   schema.Mapper
	isClosed       bool
	isInputDrained bool
	mu             sync.Mutex
	timer          *time.Timer
	pendingMsgs    []jetstream.Msg // Store messages for batch acknowledgment
	maxDelayTime   time.Duration
	maxBatchSize   int
	batchTimeout   time.Duration // Timeout for batch reading
	log            *slog.Logger
}

func NewClickHouseSink(sinkCfg models.SinkComponentConfig, streamCon stream.Consumer, schemaMapper schema.Mapper, log *slog.Logger) (*ClickHouseSink, error) {
	maxDelayTime := time.Duration(60) * time.Second
	if sinkCfg.Batch.MaxDelayTime.Duration() > 0 {
		maxDelayTime = sinkCfg.Batch.MaxDelayTime.Duration()
	}

	client, err := client.NewClickHouseClient(context.Background(), sinkCfg.ClickHouseConnectionParams)
	if err != nil {
		return nil, fmt.Errorf("failed to create clickhouse client: %w", err)
	}

	if sinkCfg.Batch.MaxBatchSize <= 0 {
		return nil, fmt.Errorf("max batch size must be greater than 0")
	}

	query := fmt.Sprintf("INSERT INTO %s.%s (%s)", client.GetDatabase(), client.GetTableName(), strings.Join(schemaMapper.GetOrderedColumns(), ", "))

	log.Debug("Insert query", slog.String("query", query))

	batch, err := batch.NewClickHouseBatch(context.Background(), client, query)
	if err != nil {
		return nil, fmt.Errorf("failed to create batch with query %s: %w", query, err)
	}

	return &ClickHouseSink{
		client:         client,
		batch:          batch,
		streamCon:      streamCon,
		schemaMapper:   schemaMapper,
		isClosed:       false,
		isInputDrained: false,
		mu:             sync.Mutex{},
		timer:          nil,
		pendingMsgs:    make([]jetstream.Msg, 0, sinkCfg.Batch.MaxBatchSize),
		maxDelayTime:   maxDelayTime,
		maxBatchSize:   sinkCfg.Batch.MaxBatchSize,
		batchTimeout:   maxDelayTime, // Use same timeout as ClickHouse batch delay
		log:            log,
	}, nil
}

func (ch *ClickHouseSink) sendBatchAndAck(ctx context.Context) error {
	if len(ch.pendingMsgs) == 0 || ch.batch.Size() == 0 {
		ch.log.Debug("No messages to send")
		return nil
	}

	// Send batch to ClickHouse
	err := ch.batch.Send(ctx)
	if err != nil {
		return fmt.Errorf("failed to send the batch: %w", err)
	}
	ch.log.Debug("Batch sent to clickhouse", slog.Int("message_count", len(ch.pendingMsgs)))

	// Acknowledge all messages in the batch
	ackCount := 0
	for _, msg := range ch.pendingMsgs {
		if err := msg.Ack(); err != nil {
			ch.log.Error("Failed to ack message", slog.Any("error", err))
			// Continue with other messages even if one fails
		} else {
			ackCount++
		}
	}

	ch.log.Info("Batch processing completed successfully",
		slog.Int("total_messages", len(ch.pendingMsgs)),
		slog.Int("acked_messages", ackCount),
		slog.Int("clickhouse_batch_size", ch.batch.Size()),
		slog.String("status", "success"))

	// Clear pending messages
	ch.pendingMsgs = ch.pendingMsgs[:0]

	return nil
}

func (ch *ClickHouseSink) handleMsg(ctx context.Context, msg jetstream.Msg) error {
	mdata, err := msg.Metadata()
	if err != nil {
		return fmt.Errorf("failed to get message metadata: %w", err)
	}

	values, err := ch.schemaMapper.PrepareValues(msg.Data())
	if err != nil {
		return fmt.Errorf("failed to map data for ClickHouse: %w", err)
	}

	err = ch.batch.Append(mdata.Sequence.Stream, values...)
	if err != nil {
		return fmt.Errorf("failed to append values to the batch: %w", err)
	}

	// Add message to pending list for batch acknowledgment
	ch.pendingMsgs = append(ch.pendingMsgs, msg)

	return nil
}

func (ch *ClickHouseSink) getMsgBatch(ctx context.Context) error {
	// Fetch a batch of messages from NATS
	ch.log.Debug("Fetching batch from NATS",
		slog.Int("max_batch_size", ch.maxBatchSize),
		slog.Duration("timeout", ch.batchTimeout))

	msgBatch, err := ch.streamCon.Fetch(ch.maxBatchSize, ch.batchTimeout)
	if err != nil {
		if errors.Is(err, nats.ErrTimeout) {
			ch.log.Debug("NATS fetch timeout - no messages available",
				slog.Duration("timeout", ch.batchTimeout))
			if ch.isClosed {
				ch.isInputDrained = true
			}
			return nil
		}
		return fmt.Errorf("failed to fetch messages: %w", err)
	}

	// Check if we got any messages
	if msgBatch == nil {
		ch.log.Debug("No messages available in batch")
		return nil
	}

	// Process each message in the batch
	processedCount := 0
	duplicateCount := 0
	totalMessages := 0

	for msg := range msgBatch.Messages() {
		if msg == nil {
			break
		}
		totalMessages++

		err = ch.handleMsg(ctx, msg)
		if err != nil {
			if errors.Is(err, batch.ErrAlreadyExists) {
				duplicateCount++
				ch.log.Debug("Skipping duplicate message")
				continue // Skip duplicate messages
			}
			return fmt.Errorf("failed to handle message: %w", err)
		}
		processedCount++
	}

	// Check for errors in the message batch
	if err := msgBatch.Error(); err != nil {
		return fmt.Errorf("error in message batch: %w", err)
	}

	// Only log success if we actually got messages
	if totalMessages > 0 {
		ch.log.Info("Successfully fetched batch from NATS",
			slog.Int("message_count", totalMessages),
			slog.Int("max_batch_size", ch.maxBatchSize),
			slog.Duration("timeout", ch.batchTimeout))
	}

	ch.log.Debug("Batch processing completed",
		slog.Int("total_messages", totalMessages),
		slog.Int("processed_messages", processedCount),
		slog.Int("duplicate_messages", duplicateCount),
		slog.Int("current_batch_size", ch.batch.Size()),
		slog.Int("pending_messages", len(ch.pendingMsgs)))

	// If we have messages and batch is full, send it
	if len(ch.pendingMsgs) > 0 && ch.batch.Size() >= ch.maxBatchSize {
		ch.log.Info("Batch size reached, sending to ClickHouse",
			slog.Int("batch_size", ch.batch.Size()),
			slog.Int("max_batch_size", ch.maxBatchSize))

		err := ch.sendBatchAndAck(ctx)
		if err != nil {
			return fmt.Errorf("failed to send the batch and ack: %w", err)
		}
	}

	return nil
}

func (ch *ClickHouseSink) Start(ctx context.Context) error {
	ch.log.Info("ClickHouse sink started with batch processing",
		slog.Int("max_batch_size", ch.maxBatchSize),
		slog.Duration("nats_batch_timeout", ch.batchTimeout),
		slog.Duration("clickhouse_timer_interval", ch.maxDelayTime),
		slog.String("mode", "batched_nats_reading"),
		slog.String("note", "NATS and ClickHouse use same batch size and timeout values"))
	defer ch.log.Info("ClickHouse sink stopped")
	defer ch.clearConn()

	ch.timer = time.NewTimer(ch.maxDelayTime)

	for {
		// Primary mechanism: Fetch messages from NATS with timeout
		// This will wait for up to batchTimeout (same as maxDelayTime)
		err := ch.getMsgBatch(ctx)
		if err != nil {
			ch.log.Error("error on exporting data", slog.Any("error", err))
			// Add a small delay to prevent tight loop on errors
			time.Sleep(100 * time.Millisecond)
			continue
		}

		// Check if we should shutdown
		if ch.isClosed && ch.isInputDrained {
			// Send any remaining messages before shutdown
			err := ch.sendBatchAndAck(ctx)
			if err != nil {
				return fmt.Errorf("failed to send the batch and ack: %w", err)
			}
			return nil
		}

		// Check if timer has expired (backup mechanism)
		select {
		case <-ch.timer.C:
			// Timer-based batch flush (backup)
			ch.log.Info("Timer-based batch flush triggered",
				slog.Int("pending_messages", len(ch.pendingMsgs)),
				slog.Int("current_batch_size", ch.batch.Size()),
				slog.Duration("timer_interval", ch.maxDelayTime))

			err := ch.sendBatchAndAck(ctx)
			if err != nil {
				ch.log.Error("error on exporting data", slog.Any("error", err))
			}
			ch.timer.Reset(ch.maxDelayTime)
		default:
			// Timer hasn't expired, continue with next NATS fetch
		}
	}
}

func (ch *ClickHouseSink) clearConn() {
	err := ch.client.Close()
	if err != nil {
		ch.log.Error("failed to close ClickHouse client connection", slog.Any("error", err))
	} else {
		ch.log.Debug("ClickHouse client connection closed")
	}
}

func (ch *ClickHouseSink) Stop(noWait bool) {
	ch.mu.Lock()
	defer ch.mu.Unlock()

	if ch.isClosed {
		ch.log.Debug("ClickHouse sink is already stopped.")
		return
	}

	ch.isInputDrained = noWait
	ch.isClosed = true
	ch.log.Debug("ClickHouse sink stop was sent")
}
