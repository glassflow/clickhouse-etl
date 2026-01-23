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

// ClickHouseSink uses Consume() callback pattern optimized for high throughput
// This implementation follows the NATS CLI benchmark pattern for efficient message consumption
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

	// Batch accumulation
	messageBuffer      []jetstream.Msg
	bufferMu           sync.Mutex
	bufferFlushTicker  *time.Ticker
	maxBatchSize       int
	maxDelayTime       time.Duration
	consumeContext     jetstream.ConsumeContext
	lastBatchStartTime time.Time
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

	maxDelayTime := internal.SinkDefaultBatchMaxDelayTime
	if sinkConfig.Batch.MaxDelayTime.Duration() != 0 {
		maxDelayTime = sinkConfig.Batch.MaxDelayTime.Duration()
	}

	// Set logger on mapper for detailed profiling (if it's a JsonToClickHouseMapper)
	if jsonMapper, ok := schemaMapper.(*schema.JsonToClickHouseMapper); ok {
		jsonMapper.SetLogger(log)
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
		maxBatchSize:          sinkConfig.Batch.MaxBatchSize,
		maxDelayTime:          maxDelayTime,
		messageBuffer:         make([]jetstream.Msg, 0, sinkConfig.Batch.MaxBatchSize),
	}, nil
}

func (ch *ClickHouseSink) Start(ctx context.Context) error {
	ch.log.InfoContext(ctx, "ClickHouse sink started with callback-based consumption",
		"max_batch_size", ch.maxBatchSize,
		"max_delay_time", ch.maxDelayTime,
		"mode", "callback_consume_pattern")

	defer ch.log.InfoContext(ctx, "ClickHouse sink stopped")
	defer ch.clearConn()

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
		wasEmpty := len(ch.messageBuffer) == 0
		ch.messageBuffer = append(ch.messageBuffer, msg)
		bufferSize := len(ch.messageBuffer)
		shouldFlush := bufferSize >= ch.maxBatchSize
		ch.bufferMu.Unlock()

		// Log when starting to accumulate a new batch (buffer was empty, first message arrived)
		if wasEmpty {
			ch.bufferMu.Lock()
			ch.lastBatchStartTime = time.Now()
			ch.bufferMu.Unlock()
			ch.log.InfoContext(ctx, "Starting to accumulate new batch from NATS",
				"status", "nats_read_started")
		}

		// Flush immediately if batch size reached
		if shouldFlush {
			ch.flushBuffer(ctx)
		}
	}

	// Start consuming using callback pattern (like NATS CLI bench)
	// This is event-driven and much more efficient than polling
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
func (ch *ClickHouseSink) flushTickerLoop(ctx context.Context) {
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
func (ch *ClickHouseSink) flushBuffer(ctx context.Context) {
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

	// Process batch
	err := ch.flushEvents(ctx, messages)
	if err != nil {
		ch.log.ErrorContext(ctx, "failed to flush buffer", "error", err, "batch_size", len(messages))
	}
}

func (ch *ClickHouseSink) handleShutdown(ctx context.Context) error {
	ch.log.InfoContext(ctx, "ClickHouse sink shutting down")

	// Stop consuming new messages
	if ch.consumeContext != nil {
		ch.consumeContext.Stop()
	}

	// Flush any remaining messages
	ch.flushBuffer(ctx)

	return nil
}

func (ch *ClickHouseSink) flushEvents(ctx context.Context, messages []jetstream.Msg) error {
	// Start trace span for batch processing
	ctx, span := ch.tracer.Start(ctx, "sink.batch_processing")
	defer span.End()

	// Calculate NATS read time if we tracked the start time
	var natsReadDuration time.Duration
	ch.bufferMu.Lock()
	if !ch.lastBatchStartTime.IsZero() {
		natsReadDuration = time.Since(ch.lastBatchStartTime)
		ch.lastBatchStartTime = time.Time{} // Reset
	}
	ch.bufferMu.Unlock()

	span.SetAttributes(
		attribute.Int("batch.size", len(messages)),
		attribute.Int64("nats_read_duration_ms", natsReadDuration.Milliseconds()),
	)

	ch.log.InfoContext(ctx, "All messages read from NATS, starting batch processing",
		"operation", "nats.fetch_messages",
		"message_count", len(messages),
		"nats_read_duration_ms", natsReadDuration.Milliseconds(),
		"status", "messages_read")

	err := ch.sendBatch(ctx, messages)
	if err == nil {
		return nil
	}
	span.RecordError(err)
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

	ch.log.InfoContext(ctx, "Data sent successfully to ClickHouse",
		"operation", "clickhouse.prepare_batch",
		"message_count", size,
		"duration_ms", sendDuration.Milliseconds(),
		"status", "clickhouse_write_success")
	ch.log.DebugContext(ctx, "Batch sent to clickhouse", "message_count", size)

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

	// Ack ALL messages individually (like NATS CLI bench)
	// This provides better flow control and throughput
	for _, msg := range messages {
		err = retry.Do(
			func() error {
				return msg.Ack()
			},
			retry.Attempts(3),
			retry.DelayType(retry.FixedDelay),
		)
		if err != nil {
			ackSpan.RecordError(err)
			ackSpan.End()
			span.RecordError(err)
			return fmt.Errorf("acknowledge message: %w", err)
		}
	}
	ackDuration := time.Since(ackStart)
	ackSpan.SetAttributes(attribute.Int64("duration_ms", ackDuration.Milliseconds()))
	ackSpan.End()

	// Log custom timing for NATS ack
	ch.log.InfoContext(ctx, "NATS acknowledge timing",
		"operation", "nats.acknowledge",
		"duration_ms", ackDuration.Milliseconds(),
		"message_count", len(messages),
	)

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

	prepStartTime := time.Now()

	// Step 1: Query creation
	queryStartTime := time.Now()
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
	queryDuration := time.Since(queryStartTime)

	ch.log.Debug("Insert query", "query", query)

	// Step 2: Batch creation
	batchCreateStartTime := time.Now()
	resultBatch, err := clickhouse.NewClickHouseBatch(ctx, ch.client, query)
	if err != nil {
		return nil, fmt.Errorf("failed to create batch with query %s: %w", query, err)
	}
	batchCreateDuration := time.Since(batchCreateStartTime)

	// Set span attributes
	span.SetAttributes(
		attribute.Int("batch.message_count", len(messages)),
		attribute.String("query", query),
	)

	// Step 3: Process messages (metadata + schema mapping + append)
	metadataTotalTime := time.Duration(0)
	schemaMappingTotalTime := time.Duration(0)
	appendTotalTime := time.Duration(0)
	skippedCount := 0

	for i, msg := range messages {
		// Per-message schema mapping span
		_, msgSpan := ch.tracer.Start(ctx, "schema.map_message")
		msgStart := time.Now()
		// Get metadata
		metadataStartTime := time.Now()
		var metadata *jetstream.MsgMetadata
		metadata, err = msg.Metadata()
		if err != nil {
			msgSpan.RecordError(err)
			msgSpan.End()
			return nil, fmt.Errorf("failed to get message metadata: %w", err)
		}
		metadataTotalTime += time.Since(metadataStartTime)

		// Schema mapping
		schemaStartTime := time.Now()
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
		schemaMappingTotalTime += time.Since(schemaStartTime)

		// Append to batch
		appendStartTime := time.Now()
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
				skippedCount++
				continue
			}
			span.RecordError(err)
			return nil, fmt.Errorf("failed to append values to batch: %w", err)
		}
		appendTotalTime += time.Since(appendStartTime)

		// Log progress for every 10k messages to track if there are slowdowns
		if (i+1)%10000 == 0 {
			ch.log.DebugContext(ctx, "Preparation progress",
				"processed_messages", i+1,
				"total_messages", len(messages),
				"elapsed_ms", time.Since(prepStartTime).Milliseconds())
		}
	}

	totalPrepDuration := time.Since(prepStartTime)

	avgPerMessageUs := int64(0)
	if len(messages) > 0 {
		avgPerMessageUs = totalPrepDuration.Microseconds() / int64(len(messages))
	}

	batchDuration := time.Since(prepStartTime)
	span.SetAttributes(attribute.Int64("batch.duration_ms", batchDuration.Milliseconds()))

	ch.log.InfoContext(ctx, "Preparation inside sink code completed, batch ready for ClickHouse",
		"operation", "clickhouse.create_batch",
		"message_count", len(messages),
		"skipped_count", skippedCount,
		"total_prep_duration_ms", totalPrepDuration.Milliseconds(),
		"query_creation_ms", queryDuration.Milliseconds(),
		"batch_creation_ms", batchCreateDuration.Milliseconds(),
		"metadata_total_ms", metadataTotalTime.Milliseconds(),
		"schema_mapping_total_ms", schemaMappingTotalTime.Milliseconds(),
		"append_total_ms", appendTotalTime.Milliseconds(),
		"avg_per_message_us", avgPerMessageUs,
		"status", "preparation_completed")

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
