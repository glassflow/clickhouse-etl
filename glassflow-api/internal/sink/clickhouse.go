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
	// Calculate NATS read time if we tracked the start time
	var natsReadDuration time.Duration
	ch.bufferMu.Lock()
	if !ch.lastBatchStartTime.IsZero() {
		natsReadDuration = time.Since(ch.lastBatchStartTime)
		ch.lastBatchStartTime = time.Time{} // Reset
	}
	ch.bufferMu.Unlock()

	ch.log.InfoContext(ctx, "All messages read from NATS, starting batch processing",
		"message_count", len(messages),
		"nats_read_duration_ms", natsReadDuration.Milliseconds(),
		"status", "messages_read")

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

	chBatch, err := ch.createCHBatch(ctx, messages)
	if err != nil {
		return fmt.Errorf("create CH batch: %w", err)
	}

	size := chBatch.Size()
	start := time.Now()

	// Send batch to ClickHouse
	err = chBatch.Send(ctx)
	if err != nil {
		return fmt.Errorf("send the batch: %w", err)
	}
	ch.log.InfoContext(ctx, "Data sent successfully to ClickHouse",
		"message_count", size,
		"status", "clickhouse_write_success")
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
			return fmt.Errorf("acknowledge message: %w", err)
		}
	}

	ch.log.InfoContext(ctx, "Batch processing completed successfully",
		"status", "success",
		"sent_messages", size,
	)

	return nil
}

func (ch *ClickHouseSink) createCHBatch(
	ctx context.Context,
	messages []jetstream.Msg,
) (clickhouse.Batch, error) {
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

	// Step 3: Process messages in parallel (metadata + schema mapping)
	const numWorkers = 10
	messageCount := len(messages)

	// Split messages into chunks for workers
	chunkSize := (messageCount + numWorkers - 1) / numWorkers // Ceiling division

	type processedMessage struct {
		index      int
		sequence   uint64
		values     []any
		err        error
		metadataMs int64
		schemaMs   int64
	}

	// Channel to collect processed messages
	resultsChan := make(chan processedMessage, messageCount)

	// Worker function
	worker := func(workerID int, msgChunk []jetstream.Msg, startIdx int) {
		for i, msg := range msgChunk {
			msgIdx := startIdx + i
			result := processedMessage{index: msgIdx}

			// Get metadata
			metadataStartTime := time.Now()
			metadata, err := msg.Metadata()
			if err != nil {
				result.err = fmt.Errorf("failed to get message metadata: %w", err)
				resultsChan <- result
				continue
			}
			result.sequence = metadata.Sequence.Stream
			result.metadataMs = time.Since(metadataStartTime).Milliseconds()

			// Schema mapping
			schemaStartTime := time.Now()
			var values []any
			if ch.streamSourceID != "" {
				values, err = ch.schemaMapper.PrepareValuesStream(ch.streamSourceID, msg.Data())
			} else {
				values, err = ch.schemaMapper.PrepareValues(msg.Data())
			}
			if err != nil {
				result.err = fmt.Errorf("failed to prepare values for message: %w", err)
				resultsChan <- result
				continue
			}
			result.values = values
			result.schemaMs = time.Since(schemaStartTime).Milliseconds()

			resultsChan <- result
		}
	}

	// Start workers
	var wg sync.WaitGroup
	for w := 0; w < numWorkers; w++ {
		startIdx := w * chunkSize
		endIdx := startIdx + chunkSize
		if endIdx > messageCount {
			endIdx = messageCount
		}
		if startIdx >= messageCount {
			break
		}

		wg.Add(1)
		go func(workerID int, chunk []jetstream.Msg, idx int) {
			defer wg.Done()
			worker(workerID, chunk, idx)
		}(w, messages[startIdx:endIdx], startIdx)
	}

	// Close results channel when all workers are done
	go func() {
		wg.Wait()
		close(resultsChan)
	}()

	// Collect results and maintain order
	processedResults := make([]processedMessage, messageCount)
	metadataTotalTime := time.Duration(0)
	schemaMappingTotalTime := time.Duration(0)
	collectedCount := 0

	for result := range resultsChan {
		if result.err != nil {
			return nil, fmt.Errorf("worker error at index %d: %w", result.index, result.err)
		}
		processedResults[result.index] = result
		collectedCount++
		metadataTotalTime += time.Duration(result.metadataMs) * time.Millisecond
		schemaMappingTotalTime += time.Duration(result.schemaMs) * time.Millisecond
	}

	// Verify all messages were processed
	if collectedCount != messageCount {
		return nil, fmt.Errorf("not all messages were processed: expected %d, got %d", messageCount, collectedCount)
	}

	// Step 4: Append to batch sequentially (maintains order and thread safety)
	appendTotalTime := time.Duration(0)
	skippedCount := 0

	for i, result := range processedResults {
		// Safety check: ensure result was properly collected
		if result.values == nil {
			return nil, fmt.Errorf("missing values for message at index %d", i)
		}
		appendStartTime := time.Now()
		err = resultBatch.Append(result.sequence, result.values...)
		if err != nil {
			if errors.Is(err, clickhouse.ErrAlreadyExists) {
				skippedCount++
				continue
			}
			return nil, fmt.Errorf("failed to append values to batch: %w", err)
		}
		appendTotalTime += time.Since(appendStartTime)

		// Log progress for every 10k messages
		if (i+1)%10000 == 0 {
			ch.log.DebugContext(ctx, "Preparation progress",
				"processed_messages", i+1,
				"total_messages", messageCount,
				"elapsed_ms", time.Since(prepStartTime).Milliseconds())
		}
	}

	totalPrepDuration := time.Since(prepStartTime)

	ch.log.InfoContext(ctx, "Preparation inside sink code completed, batch ready for ClickHouse",
		"message_count", len(messages),
		"skipped_count", skippedCount,
		"total_prep_duration_ms", totalPrepDuration.Milliseconds(),
		"query_creation_ms", queryDuration.Milliseconds(),
		"batch_creation_ms", batchCreateDuration.Milliseconds(),
		"metadata_total_ms", metadataTotalTime.Milliseconds(),
		"schema_mapping_total_ms", schemaMappingTotalTime.Milliseconds(),
		"append_total_ms", appendTotalTime.Milliseconds(),
		"avg_per_message_us", totalPrepDuration.Microseconds()/int64(len(messages)),
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
