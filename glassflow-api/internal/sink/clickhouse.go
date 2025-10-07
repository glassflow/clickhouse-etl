package sink

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"sync"
	"time"

	"github.com/nats-io/nats.go/jetstream"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/batch"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/client"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/schema"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/stream"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/pkg/observability"
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
	lastMsg        jetstream.Msg
	maxDelayTime   time.Duration
	maxBatchSize   int
	log            *slog.Logger
	meter          *observability.Meter
}

func NewClickHouseSink(sinkCfg models.SinkComponentConfig, streamCon stream.Consumer, schemaMapper schema.Mapper, log *slog.Logger, meter *observability.Meter) (*ClickHouseSink, error) {
	maxDelayTime := time.Duration(60) * time.Second
	if sinkCfg.Batch.MaxDelayTime.Duration() > 0 {
		maxDelayTime = sinkCfg.Batch.MaxDelayTime.Duration()
	}

	client, err := client.NewClickHouseClient(context.Background(), sinkCfg.ClickHouseConnectionParams)
	if err != nil {
		log.Error("failed to create clickhouse client", "error", err)
		return nil, fmt.Errorf("failed to create clickhouse client: %w", err)
	}

	if sinkCfg.Batch.MaxBatchSize <= 0 {
		log.Error("invalid max batch size", "max_batch_size", sinkCfg.Batch.MaxBatchSize)
		return nil, fmt.Errorf("max batch size must be greater than 0")
	}

	query := fmt.Sprintf("INSERT INTO %s.%s (%s)", client.GetDatabase(), client.GetTableName(), strings.Join(schemaMapper.GetOrderedColumns(), ", "))

	log.Debug("Insert query", "query", query)

	batch, err := batch.NewClickHouseBatch(context.Background(), client, query)
	if err != nil {
		log.Error("failed to create batch with query", "query", query, "error", err)
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
		lastMsg:        nil,
		maxDelayTime:   maxDelayTime,
		maxBatchSize:   sinkCfg.Batch.MaxBatchSize,
		log:            log,
		meter:          meter,
	}, nil
}

func (ch *ClickHouseSink) sendBatchAndAck(ctx context.Context) error {
	if ch.batch.Size() == 0 {
		ch.log.DebugContext(ctx, "No messages to send")
		return nil
	}

	size := ch.batch.Size()
	start := time.Now()

	// Send batch to ClickHouse
	err := ch.batch.Send(ctx)
	if err != nil {
		ch.log.ErrorContext(ctx, "failed to send batch to ClickHouse", "batch_size", size, "error", err)
		return fmt.Errorf("failed to send the batch: %w", err)
	}
	ch.log.DebugContext(ctx, "Batch sent to clickhouse", "message_count", size)

	// Record ClickHouse write metrics
	if ch.meter != nil {
		ch.meter.RecordClickHouseWrite(ctx, int64(size))

		// Calculate and record write rate
		duration := time.Since(start).Seconds()
		if duration > 0 {
			rate := float64(size) / duration
			ch.meter.RecordSinkRate(ctx, rate)
		}
	}

	// Acknowledge all using last message from the batch
	err = ch.lastMsg.Ack()
	if err != nil {
		ch.log.ErrorContext(ctx, "failed to acknowledge messages", "batch_size", size, "error", err)
		return fmt.Errorf("failed to acknowledge messages: %w", err)
	}

	mdata, err := ch.lastMsg.Metadata()
	if err != nil {
		ch.log.ErrorContext(ctx, "failed to get message metadata", "error", err)
	} else {
		ch.log.DebugContext(ctx, "Message acked by JetStream", "stream", mdata.Sequence.Stream)
	}

	ch.lastMsg = nil

	ch.log.InfoContext(ctx, "Batch processing completed successfully",
		"status", "success",
		"sent_messages", size,
	)

	return nil
}

func (ch *ClickHouseSink) handleMsg(ctx context.Context, msg jetstream.Msg) error {
	start := time.Now()

	mdata, err := msg.Metadata()
	if err != nil {
		ch.log.Error("failed to get message metadata", "error", err)
		return fmt.Errorf("failed to get message metadata: %w", err)
	}

	values, err := ch.schemaMapper.PrepareValues(msg.Data())
	if err != nil {
		ch.log.Error("failed to map data for ClickHouse", "error", err)
		return fmt.Errorf("failed to map data for ClickHouse: %w", err)
	}

	err = ch.batch.Append(mdata.Sequence.Stream, values...)
	if err != nil {
		ch.log.Error("failed to append values to the batch", "stream_sequence", mdata.Sequence.Stream, "error", err)
		return fmt.Errorf("failed to append values to the batch: %w", err)
	}

	ch.lastMsg = msg

	// Record processing duration
	if ch.meter != nil {
		duration := time.Since(start).Seconds()
		ch.meter.RecordProcessingDuration(ctx, duration)
	}

	return nil
}

func (ch *ClickHouseSink) getMsgBatch(ctx context.Context) error {
	msgBatch, err := ch.streamCon.FetchNoAwait(ch.maxBatchSize)
	if err != nil {
		// error can be ErrNoHeartbeat
		// TODO: handle this error
		ch.log.ErrorContext(ctx, "failed to fetch messages", "error", err)
		return fmt.Errorf("failed to fetch messages: %w", err)
	}
	// Process each message in the batch
	processedCount := 0
	totalMessages := 0

	for msg := range msgBatch.Messages() {
		if msg == nil {
			break
		}
		totalMessages++

		err = ch.handleMsg(ctx, msg)
		if err != nil {
			if errors.Is(err, batch.ErrAlreadyExists) {
				continue
			}
			ch.log.ErrorContext(ctx, "failed to handle message", "error", err)
			return fmt.Errorf("failed to handle message: %w", err)
		}
		processedCount++
	}

	if totalMessages == 0 {
		ch.isInputDrained = true
		return models.ErrNoNewMessages
	}

	if msgBatch.Error() != nil {
		// TODO: handle error
		ch.log.ErrorContext(ctx, "failed to fetch messages", "error", msgBatch.Error())
		return fmt.Errorf("failed to fetch messages: %w", msgBatch.Error())
	}

	// Only log success if we actually got messages
	if totalMessages > 0 {
		ch.log.DebugContext(ctx, "Successfully fetched batch from NATS",
			"message_count", totalMessages,
			"max_batch_size", ch.maxBatchSize)
	}

	ch.log.DebugContext(ctx, "Batch processing completed",
		"total_messages", totalMessages,
		"processed_messages", processedCount,
		"current_batch_size", ch.batch.Size())

	// If we have messages and batch is full, send it
	if ch.lastMsg != nil && ch.batch.Size() >= ch.maxBatchSize {
		ch.log.InfoContext(ctx, "Batch size reached, sending to ClickHouse",
			"batch_size", ch.batch.Size(),
			"max_batch_size", ch.maxBatchSize)

		err := ch.sendBatchAndAck(ctx)
		if err != nil {
			ch.log.ErrorContext(ctx, "failed to send the batch and ack", "error", err)
			return fmt.Errorf("failed to send the batch and ack: %w", err)
		}
	}

	return nil
}

func (ch *ClickHouseSink) Start(ctx context.Context) error {
	ch.log.InfoContext(ctx, "ClickHouse sink started with batch processing",
		"max_batch_size", ch.maxBatchSize,
		"clickhouse_timer_interval", ch.maxDelayTime,
		"mode", "batched_nats_reading",
		"note", "NATS and ClickHouse use same batch size and timeout values")

	defer ch.log.InfoContext(ctx, "ClickHouse sink stopped")
	defer ch.clearConn()

	ch.timer = time.NewTimer(ch.maxDelayTime)

	for {
		err := ch.getMsgBatch(ctx)
		if err != nil {
			if !errors.Is(err, models.ErrNoNewMessages) {
				ch.log.ErrorContext(ctx, "error on exporting data", "error", err)
			}
			// Add a small delay to prevent tight loop on errors
			time.Sleep(internal.FetchRetryDelay)
		}

		// Check if we should shutdown
		if ch.isClosed && ch.isInputDrained {
			// Send any remaining messages before shutdown
			err := ch.sendBatchAndAck(ctx)
			if err != nil {
				ch.log.ErrorContext(ctx, "failed to send the batch and ack during shutdown", "error", err)
				return fmt.Errorf("failed to send the batch and ack: %w", err)
			}
			return nil
		}

		// Check if timer has expired (backup mechanism)
		select {
		case <-ch.timer.C:
			// Timer-based batch flush (backup)
			ch.log.DebugContext(ctx, "Timer-based batch flush triggered",
				"current_batch_size", ch.batch.Size(),
				"timer_interval", ch.maxDelayTime)

			err := ch.sendBatchAndAck(ctx)
			if err != nil {
				ch.log.ErrorContext(ctx, "error on exporting data", "error", err)
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
		ch.log.Error("failed to close ClickHouse client connection", "error", err)
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
