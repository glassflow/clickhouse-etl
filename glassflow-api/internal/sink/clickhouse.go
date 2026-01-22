package sink

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"sync"
	"time"

	"github.com/avast/retry-go"

	"github.com/nats-io/nats.go/jetstream"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/batch/clickhouse"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/client"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/schema"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/stream"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/pkg/observability"
)

type ClickHouseSink struct {
	client                *client.ClickHouseClient
	streamConsumer        jetstream.Consumer
	schemaMapper          schema.Mapper
	cancel                context.CancelFunc
	shutdownOnce          sync.Once
	sinkConfig            models.SinkComponentConfig
	clickhouseQueryConfig models.ClickhouseQueryConfig
	streamSourceID        string
	log                   *slog.Logger
	meter                 *observability.Meter
	dlqPublisher          stream.Publisher
	tracer                trace.Tracer
}

func NewClickHouseSink(
	sinkConfig models.SinkComponentConfig,
	streamConsumer jetstream.Consumer,
	schemaMapper schema.Mapper,
	log *slog.Logger,
	meter *observability.Meter,
	dlqPublisher stream.Publisher,
	clickhouseQueryConfig models.ClickhouseQueryConfig,
	streamSourceID string,
	tracer trace.Tracer,
) (*ClickHouseSink, error) {
	clickhouseClient, err := client.NewClickHouseClient(context.Background(), sinkConfig.ClickHouseConnectionParams)
	if err != nil {
		return nil, fmt.Errorf("failed to create clickhouse client: %w", err)
	}

	if sinkConfig.Batch.MaxBatchSize <= 0 {
		return nil, fmt.Errorf("invalid max batch size, should be > 0: %d", sinkConfig.Batch.MaxBatchSize)
	}

	return &ClickHouseSink{
		client:                clickhouseClient,
		streamConsumer:        streamConsumer,
		schemaMapper:          schemaMapper,
		sinkConfig:            sinkConfig,
		log:                   log,
		meter:                 meter,
		dlqPublisher:          dlqPublisher,
		clickhouseQueryConfig: clickhouseQueryConfig,
		streamSourceID:        streamSourceID,
		tracer:                tracer,
	}, nil
}

func (ch *ClickHouseSink) Start(ctx context.Context) error {
	maxDelayTime := internal.SinkDefaultBatchMaxDelayTime
	if ch.sinkConfig.Batch.MaxDelayTime.Duration() != 0 {
		maxDelayTime = ch.sinkConfig.Batch.MaxDelayTime.Duration()
	}
	maxBatchSize := ch.sinkConfig.Batch.MaxBatchSize

	ch.log.InfoContext(ctx, "ClickHouse sink started with batch processing",
		"max_batch_size", maxBatchSize,
		"clickhouse_timer_interval", ch.sinkConfig.Batch.MaxDelayTime.Duration(),
		"mode", "batched_nats_reading",
		"note", "NATS and ClickHouse use same batch size and timeout values")

	defer ch.log.InfoContext(ctx, "ClickHouse sink stopped")
	defer ch.clearConn()

	ticker := time.NewTicker(maxDelayTime)
	defer ticker.Stop()

	ctx, cancel := context.WithCancel(ctx)
	ch.cancel = cancel
	defer cancel()

	for {
		select {
		case <-ctx.Done():
			shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), internal.SinkDefaultShutdownTimeout)
			defer shutdownCancel()
			return ch.handleShutdown(shutdownCtx)
		case <-ticker.C:
			err := ch.fetchAndFlush(ctx)
			if err != nil {
				if errors.Is(err, models.ErrNoNewMessages) {
					continue
				}
				ch.log.ErrorContext(ctx, "failed to fetch and flush", "error", err)
			}
		default:
			hasEnoughEvents, err := ch.hasBatchSizeReached(ctx, ch.sinkConfig.Batch.MaxBatchSize)
			if err != nil {
				ch.log.ErrorContext(ctx, "hasEnoughEvents", "error", err)
				time.Sleep(internal.FetchRetryDelay)
				continue
			}

			if !hasEnoughEvents {
				time.Sleep(internal.FetchRetryDelay)
				continue
			}

			err = ch.fetchAndFlush(ctx)
			if err != nil {
				ch.log.ErrorContext(ctx, "fetchAndFlush", "error", err)
				continue
			}
			ticker.Reset(maxDelayTime)
		}
	}
}

// hasBatchSizeReached returns true if the consumer has at least batchSize pending messages.
func (ch *ClickHouseSink) hasBatchSizeReached(ctx context.Context, batchSize int) (bool, error) {
	consumerInfo, err := ch.streamConsumer.Info(ctx)
	if err != nil {
		return false, fmt.Errorf("get consumer info: %w", err)
	}
	if consumerInfo.NumPending >= uint64(batchSize) {
		return true, nil
	}

	return false, nil
}

func (ch *ClickHouseSink) fetchAndFlush(ctx context.Context) error {
	messages, err := ch.fetchMessages(ctx)
	if err != nil {
		return fmt.Errorf("fetch messages: %w", err)
	}

	err = ch.flushEvents(ctx, messages)
	if err != nil {
		return fmt.Errorf("flush events: %w", err)
	}

	return nil
}

// shutdown handles the shutdown logic
func (ch *ClickHouseSink) handleShutdown(ctx context.Context) error {
	ch.log.InfoContext(ctx, "ClickHouse sink shutting down")

	err := ch.fetchAndFlush(ctx)
	if err != nil && !errors.Is(err, models.ErrNoNewMessages) {
		return fmt.Errorf("flush pending messages: %w", err)
	}

	return nil
}

func (ch *ClickHouseSink) fetchMessages(ctx context.Context) ([]jetstream.Msg, error) {
	// Start trace span
	ctx, span := ch.tracer.Start(ctx, "nats.fetch_messages")
	defer span.End()

	// Custom timing
	start := time.Now()

	msgBatch, err := ch.streamConsumer.FetchNoWait(ch.sinkConfig.Batch.MaxBatchSize)
	if err != nil {
		span.RecordError(err)
		return nil, fmt.Errorf("failed to fetch messages: %w", err)
	}

	messages := make([]jetstream.Msg, 0, ch.sinkConfig.Batch.MaxBatchSize)
	for msg := range msgBatch.Messages() {
		if msg == nil {
			break
		}

		messages = append(messages, msg)
	}

	if len(messages) == 0 {
		return nil, models.ErrNoNewMessages
	}

	if msgBatch.Error() != nil {
		span.RecordError(msgBatch.Error())
		return nil, fmt.Errorf("failed to fetch messages: %w", msgBatch.Error())
	}

	duration := time.Since(start)

	// Set span attributes
	span.SetAttributes(
		attribute.Int("batch.size", len(messages)),
		attribute.Int64("duration_ms", duration.Milliseconds()),
	)

	// Log custom timing
	ch.log.InfoContext(ctx, "NATS fetch timing",
		"operation", "nats.fetch_messages",
		"duration_ms", duration.Milliseconds(),
		"message_count", len(messages),
	)

	// Only log success if we actually got messages
	if len(messages) > 0 {
		ch.log.DebugContext(ctx, "Successfully fetched batch from NATS",
			"message_count", len(messages),
			"max_batch_size", ch.sinkConfig.Batch.MaxBatchSize)
	}

	return messages, nil
}

func (ch *ClickHouseSink) flushEvents(ctx context.Context, messages []jetstream.Msg) error {
	err := ch.sendBatch(ctx, messages)
	if err == nil {
		return nil
	}
	ch.log.Error("failed to send CH batch, writing to dlq", "error", err, "batch_size", len(messages))

	err = ch.flushFailedBatch(ctx, messages, err)
	if err != nil {
		return fmt.Errorf("flush bad batch: %w", err)
	}

	return nil
}

// write failed batch to dlq
func (ch *ClickHouseSink) flushFailedBatch(
	ctx context.Context,
	messages []jetstream.Msg,
	batchErr error,
) error {
	for _, msg := range messages {
		err := ch.pushMsgToDLQ(ctx, msg.Data(), batchErr)
		if err != nil {
			return fmt.Errorf("push message to DLQ: %w", err)
		}

		err = retry.Do(
			func() error {
				err = msg.Ack()
				return err
			},
			retry.Attempts(3),
			retry.DelayType(retry.FixedDelay),
		)
		if err != nil {
			return fmt.Errorf("acknowledge message: %w", err)
		}
	}

	return nil
}

func (ch *ClickHouseSink) sendBatch(ctx context.Context, messages []jetstream.Msg) error {
	if len(messages) == 0 {
		return nil
	}

	// Start parent trace span
	ctx, span := ch.tracer.Start(ctx, "clickhouse.send_batch")
	defer span.End()

	chBatch, err := ch.createCHBatch(ctx, messages)
	if err != nil {
		span.RecordError(err)
		return fmt.Errorf("create CH batch: %w", err)
	}

	size := chBatch.Size()
	span.SetAttributes(attribute.Int("batch.size", size))

	// ClickHouse send span
	_, sendSpan := ch.tracer.Start(ctx, "clickhouse.prepare_batch")
	sendStart := time.Now()

	// Send batch to ClickHouse
	err = chBatch.Send(ctx)
	sendDuration := time.Since(sendStart)
	if err != nil {
		sendSpan.RecordError(err)
		sendSpan.End()
		span.RecordError(err)
		return fmt.Errorf("send the batch: %w", err)
	}
	sendSpan.SetAttributes(attribute.Int64("duration_ms", sendDuration.Milliseconds()))
	sendSpan.End()

	ch.log.DebugContext(ctx, "Batch sent to clickhouse", "message_count", size)

	// Log custom timing for ClickHouse send
	ch.log.InfoContext(ctx, "ClickHouse send timing",
		"operation", "clickhouse.prepare_batch",
		"duration_ms", sendDuration.Milliseconds(),
		"message_count", size,
	)

	// Record ClickHouse write metrics
	if ch.meter != nil {
		ch.meter.RecordClickHouseWrite(ctx, int64(size))

		// Calculate and record write rate
		duration := sendDuration.Seconds()
		if duration > 0 {
			rate := float64(size) / duration
			ch.meter.RecordSinkRate(ctx, rate)
		}
	}

	// NATS acknowledgment span
	_, ackSpan := ch.tracer.Start(ctx, "nats.acknowledge")
	ackStart := time.Now()

	// Acknowledge all using last message from the batch
	lastMsg := messages[len(messages)-1]
	err = retry.Do(
		func() error {
			err = lastMsg.Ack()
			return err
		},
		retry.Attempts(3),
		retry.DelayType(retry.FixedDelay),
	)
	ackDuration := time.Since(ackStart)
	if err != nil {
		ackSpan.RecordError(err)
		ackSpan.End()
		span.RecordError(err)
		return fmt.Errorf("acknowledge messages: %w", err)
	}
	ackSpan.SetAttributes(attribute.Int64("duration_ms", ackDuration.Milliseconds()))
	ackSpan.End()

	// Log custom timing for NATS ack
	ch.log.InfoContext(ctx, "NATS acknowledge timing",
		"operation", "nats.acknowledge",
		"duration_ms", ackDuration.Milliseconds(),
	)

	mdata, err := lastMsg.Metadata()
	if err != nil {
		ch.log.ErrorContext(ctx, "failed to get message metadata", "error", err)
	} else {
		ch.log.DebugContext(ctx, "Message acked by JetStream", "stream", mdata.Sequence.Stream)
	}

	totalDuration := sendDuration + ackDuration
	span.SetAttributes(
		attribute.Int64("total.duration_ms", totalDuration.Milliseconds()),
		attribute.Int64("clickhouse.send.duration_ms", sendDuration.Milliseconds()),
		attribute.Int64("nats.ack.duration_ms", ackDuration.Milliseconds()),
	)

	ch.log.InfoContext(ctx, "Batch processing completed successfully",
		"status", "success",
		"sent_messages", size,
		"total_duration_ms", totalDuration.Milliseconds(),
	)

	return nil
}

func (ch *ClickHouseSink) createCHBatch(
	ctx context.Context,
	messages []jetstream.Msg,
) (clickhouse.Batch, error) {
	// Start trace span
	ctx, span := ch.tracer.Start(ctx, "clickhouse.create_batch")
	defer span.End()

	// Custom timing for batch creation
	batchStart := time.Now()

	var query string
	if ch.streamSourceID != "" {
		query = fmt.Sprintf(
			"INSERT INTO %s.%s (%s)",
			ch.client.GetDatabase(),
			ch.client.GetTableName(),
			strings.Join(ch.schemaMapper.GetOrderedColumnsStream(ch.streamSourceID), ", "),
		)
	} else {
		query = fmt.Sprintf(
			"INSERT INTO %s.%s (%s)",
			ch.client.GetDatabase(),
			ch.client.GetTableName(),
			strings.Join(ch.schemaMapper.GetOrderedColumns(), ", "),
		)
	}

	ch.log.Debug("Insert query", "query", query)

	resultBatch, err := clickhouse.NewClickHouseBatch(ctx, ch.client, query)
	if err != nil {
		span.RecordError(err)
		return nil, fmt.Errorf("failed to create batch with query %s: %w", query, err)
	}

	// Set span attributes
	span.SetAttributes(
		attribute.Int("batch.message_count", len(messages)),
		attribute.String("query", query),
	)

	for i, msg := range messages {
		// Per-message schema mapping span
		_, msgSpan := ch.tracer.Start(ctx, "schema.map_message")
		msgStart := time.Now()

		var metadata *jetstream.MsgMetadata
		metadata, err = msg.Metadata()
		if err != nil {
			msgSpan.RecordError(err)
			msgSpan.End()
			return nil, fmt.Errorf("failed to get message metadata: %w", err)
		}

		var values []any
		if ch.streamSourceID != "" {
			values, err = ch.schemaMapper.PrepareValuesStream(ch.streamSourceID, msg.Data())
		} else {
			values, err = ch.schemaMapper.PrepareValues(msg.Data())
		}
		if err != nil {
			msgSpan.RecordError(err)
			msgSpan.End()
			return nil, fmt.Errorf("failed to prepare values for message: %w", err)
		}

		msgDuration := time.Since(msgStart)
		msgSpan.SetAttributes(
			attribute.Int("message.index", i),
			attribute.Int64("duration_ms", msgDuration.Milliseconds()),
		)
		if ch.streamSourceID != "" {
			msgSpan.SetAttributes(attribute.String("stream.source_id", ch.streamSourceID))
		}
		msgSpan.End()

		// Log custom timing for schema mapping
		ch.log.DebugContext(ctx, "Schema mapping timing",
			"operation", "schema.map_message",
			"message_index", i,
			"duration_ms", msgDuration.Milliseconds(),
		)

		err = resultBatch.Append(metadata.Sequence.Stream, values...)
		if err != nil {
			if errors.Is(err, clickhouse.ErrAlreadyExists) {
				continue
			}
			span.RecordError(err)
			return nil, fmt.Errorf("failed to append values to batch: %w", err)
		}
	}

	batchDuration := time.Since(batchStart)
	span.SetAttributes(attribute.Int64("batch.duration_ms", batchDuration.Milliseconds()))

	ch.log.InfoContext(ctx, "Batch creation timing",
		"operation", "clickhouse.create_batch",
		"duration_ms", batchDuration.Milliseconds(),
		"message_count", len(messages),
	)

	return resultBatch, nil
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
	ch.shutdownOnce.Do(func() {
		if ch.cancel != nil {
			ch.cancel()
		}
		ch.log.Debug("Stop signal sent", "no_wait", noWait)
	})
}

func (ch *ClickHouseSink) pushMsgToDLQ(ctx context.Context, orgMsg []byte, err error) error {
	data, err := models.NewDLQMessage(internal.RoleSink, err.Error(), orgMsg).ToJSON()
	if err != nil {
		return fmt.Errorf("convert DLQ message to JSON: %w", err)
	}

	err = ch.dlqPublisher.Publish(ctx, data)
	if err != nil {
		return fmt.Errorf("publish to DLQ: %w", err)
	}

	// Record DLQ write metric
	if ch.meter != nil {
		ch.meter.RecordDLQWrite(ctx, 1)
	}

	return nil
}
