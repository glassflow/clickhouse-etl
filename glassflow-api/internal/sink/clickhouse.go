package sink

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"runtime"
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

// workerJob represents a chunk of messages to be processed by a worker
type workerJob struct {
	messages       []jetstream.Msg
	jobID          int
	streamSourceID string
}

// workerResult contains the processed results from a worker
type workerResult struct {
	jobID     int
	processed []processedMessage
	err       error
}

// processedMessage contains the metadata and values for a processed message
type processedMessage struct {
	metadata *jetstream.MsgMetadata
	values   []any
	msg      jetstream.Msg
}

// sendItem is a prepared batch and its messages, queued for the writer goroutine to send.
type sendItem struct {
	batch    clickhouse.Batch
	messages []jetstream.Msg
}

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

	// Worker pool for parallel PrepareValues processing
	workerPoolSize   int
	workerJobChan    chan workerJob
	workerResultChan chan workerResult
	workerWg         sync.WaitGroup
	workerCtx        context.Context
	workerCancel     context.CancelFunc

	// Pipelining: writer goroutine sends batches so the handler can return immediately
	sendChan chan sendItem
	writerWg sync.WaitGroup

	// createCHBatchMu serializes createCHBatch so worker pool results are not mixed across concurrent batches
	createCHBatchMu sync.Mutex
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

	// Set worker pool size to GOMAXPROCS
	workerPoolSize := runtime.GOMAXPROCS(0) - 2
	if workerPoolSize < 1 {
		workerPoolSize = 1
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
		workerPoolSize:        workerPoolSize,
	}, nil
}

func (ch *ClickHouseSink) Start(ctx context.Context) error {
	ch.log.InfoContext(ctx, "ClickHouse sink started with callback-based consumption",
		"max_batch_size", ch.maxBatchSize,
		"max_delay_time", ch.maxDelayTime,
		"worker_pool_size", ch.workerPoolSize,
		"mode", "callback_consume_pattern")

	defer ch.log.InfoContext(ctx, "ClickHouse sink stopped")
	defer ch.clearConn()

	ctx, cancel := context.WithCancel(ctx)
	ch.cancel = cancel
	defer cancel()

	// Initialize and start worker pool
	// Use Background context so workers stay alive during shutdown processing
	ch.workerCtx, ch.workerCancel = context.WithCancel(context.Background())
	ch.workerJobChan = make(chan workerJob, ch.workerPoolSize)
	ch.workerResultChan = make(chan workerResult, ch.workerPoolSize)
	ch.startWorkerPool()
	defer ch.stopWorkerPool()

	// Pipelining: bounded channel so handler returns after prepare; writer sends in background
	const sendQueueCap = 2
	ch.sendChan = make(chan sendItem, sendQueueCap)
	ch.writerWg.Add(1)
	go ch.writeLoop()
	defer ch.stopWriter()

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

		// Track batch start time
		if wasEmpty {
			ch.bufferMu.Lock()
			ch.lastBatchStartTime = time.Now()
			ch.bufferMu.Unlock()
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

// startWorkerPool starts N worker goroutines to process PrepareValues in parallel
func (ch *ClickHouseSink) startWorkerPool() {
	ch.log.Info("Starting worker pool", "worker_count", ch.workerPoolSize)
	for i := 0; i < ch.workerPoolSize; i++ {
		ch.workerWg.Add(1)
		go ch.worker(i)
	}
}

// stopWorkerPool gracefully shuts down the worker pool
func (ch *ClickHouseSink) stopWorkerPool() {
	if ch.workerCancel == nil {
		return
	}
	ch.workerCancel()
	if ch.workerJobChan != nil {
		close(ch.workerJobChan)
	}
	ch.workerWg.Wait()
	if ch.workerResultChan != nil {
		close(ch.workerResultChan)
	}
	ch.log.Info("Worker pool stopped")
}

// writeWorkerID identifies the single writer goroutine (0). Used in logs to trace which worker writes each batch.
const writeWorkerID = 0

// writeLoop runs in a dedicated goroutine; receives prepared batches and sends them to ClickHouse.
// This allows the message handler to return immediately after prepare (pipelining).
func (ch *ClickHouseSink) writeLoop() {
	defer ch.writerWg.Done()
	ctx := context.Background()
	for item := range ch.sendChan {
		ch.log.Debug("writer received batch from queue",
			"write_worker_id", writeWorkerID,
			"batch_size", item.batch.Size())
		ch.executeSend(ctx, item)
	}
	ch.log.Debug("Write loop exited", "write_worker_id", writeWorkerID)
}

// stopWriter closes the send channel and waits for the writer to drain and exit.
func (ch *ClickHouseSink) stopWriter() {
	if ch.sendChan == nil {
		return
	}
	close(ch.sendChan)
	ch.writerWg.Wait()
	ch.sendChan = nil
	ch.log.Info("Writer stopped")
}

// executeSend sends one batch to ClickHouse, then acks messages or pushes to DLQ on failure.
func (ch *ClickHouseSink) executeSend(ctx context.Context, item sendItem) {
	size := item.batch.Size()
	start := time.Now()

	ch.log.InfoContext(ctx, "writer sending batch to ClickHouse",
		"write_worker_id", writeWorkerID,
		"batch_size", size)

	err := item.batch.Send(ctx)
	if err != nil {
		ch.log.Error("writer failed to send batch to ClickHouse, writing to DLQ",
			"write_worker_id", writeWorkerID,
			"batch_size", size,
			"error", err)
		err = ch.flushFailedBatch(ctx, item.messages, err)
		if err != nil {
			ch.log.Error("failed to flush batch to DLQ", "error", err)
		}
		return
	}

	ch.log.InfoContext(ctx, "writer completed batch write to ClickHouse",
		"write_worker_id", writeWorkerID,
		"message_count", size,
		"duration_ms", time.Since(start).Milliseconds())

	if ch.meter != nil {
		ch.meter.RecordClickHouseWrite(ctx, int64(size))
		duration := time.Since(start).Seconds()
		if duration > 0 {
			ch.meter.RecordSinkRate(ctx, float64(size)/duration)
		}
	}

	for _, msg := range item.messages {
		err = retry.Do(
			func() error { return msg.Ack() },
			retry.Attempts(3),
			retry.DelayType(retry.FixedDelay),
		)
		if err != nil {
			ch.log.Error("acknowledge message failed", "error", err)
			return
		}
	}
}

// worker processes messages in parallel by calling PrepareValues
func (ch *ClickHouseSink) worker(workerID int) {
	defer ch.workerWg.Done()

	for {
		select {
		case <-ch.workerCtx.Done():
			return
		case job, ok := <-ch.workerJobChan:
			if !ok {
				return
			}

			processed := make([]processedMessage, 0, len(job.messages))
			var jobErr error

			for _, msg := range job.messages {
				// Get metadata
				metadata, err := msg.Metadata()
				if err != nil {
					jobErr = fmt.Errorf("failed to get message metadata: %w", err)
					break
				}

				// Schema mapping - this is the parallelized part
				var values []any
				if job.streamSourceID != "" {
					values, err = ch.schemaMapper.PrepareValuesStream(job.streamSourceID, msg.Data())
				} else {
					values, err = ch.schemaMapper.PrepareValues(msg.Data())
				}
				if err != nil {
					jobErr = fmt.Errorf("failed to prepare values for message: %w", err)
					break
				}

				processed = append(processed, processedMessage{
					metadata: metadata,
					values:   values,
					msg:      msg,
				})
			}

			// Send result back to main thread
			ch.workerResultChan <- workerResult{
				jobID:     job.jobID,
				processed: processed,
				err:       jobErr,
			}
		}
	}
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

	ch.log.InfoContext(ctx, "Starting batch processing",
		"message_count", len(messages),
		"nats_read_duration_ms", natsReadDuration.Milliseconds())

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

// sendBatch prepares the batch and enqueues it for the writer goroutine (pipelining).
// It returns immediately after enqueue so the handler can keep consuming; Send and ack happen in writeLoop.
func (ch *ClickHouseSink) sendBatch(ctx context.Context, messages []jetstream.Msg) error {
	if len(messages) == 0 {
		return nil
	}

	chBatch, err := ch.createCHBatch(ctx, messages)
	if err != nil {
		return fmt.Errorf("create CH batch: %w", err)
	}

	// Enqueue for writer; backpressure when channel is full (cap 2)
	select {
	case <-ctx.Done():
		return ctx.Err()
	case ch.sendChan <- sendItem{batch: chBatch, messages: messages}:
		ch.log.Debug("enqueued batch for writer",
			"batch_size", chBatch.Size(),
			"queue_cap", cap(ch.sendChan))
	}
	return nil
}

func (ch *ClickHouseSink) createCHBatch(
	ctx context.Context,
	messages []jetstream.Msg,
) (clickhouse.Batch, error) {
	ch.createCHBatchMu.Lock()
	defer ch.createCHBatchMu.Unlock()

	prepStartTime := time.Now()

	// Step 1: Query creation
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
	// Step 2: Batch creation
	resultBatch, err := clickhouse.NewClickHouseBatch(ctx, ch.client, query)
	if err != nil {
		return nil, fmt.Errorf("failed to create batch with query %s: %w", query, err)
	}

	// Step 3: Process messages using worker pool (metadata + schema mapping + append)
	schemaMappingStartTime := time.Now()
	appendTotalTime := time.Duration(0)
	skippedCount := 0

	if len(messages) == 0 {
		return resultBatch, nil
	}

	// Split messages into chunks for parallel processing
	chunkSize := len(messages) / ch.workerPoolSize
	if chunkSize == 0 {
		chunkSize = 1
	}

	// Send jobs to workers
	numJobs := 0
	for i := 0; i < len(messages); i += chunkSize {
		end := i + chunkSize
		if end > len(messages) {
			end = len(messages)
		}

		job := workerJob{
			messages:       messages[i:end],
			jobID:          numJobs,
			streamSourceID: ch.streamSourceID,
		}

		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case ch.workerJobChan <- job:
			numJobs++
		}
	}

	// Collect results from workers
	// Use a timeout to ensure we don't wait forever, but allow enough time for processing
	collectCtx := ctx
	if _, ok := ctx.Deadline(); !ok {
		// If no deadline, set a reasonable timeout for result collection
		var cancel context.CancelFunc
		collectCtx, cancel = context.WithTimeout(ctx, 30*time.Second)
		defer cancel()
	}

	results := make(map[int]workerResult, numJobs)
	for i := 0; i < numJobs; i++ {
		select {
		case <-collectCtx.Done():
			return nil, fmt.Errorf("timeout waiting for worker results: %w", collectCtx.Err())
		case result := <-ch.workerResultChan:
			if result.err != nil {
				return nil, fmt.Errorf("worker job %d failed: %w", result.jobID, result.err)
			}
			results[result.jobID] = result
		}
	}

	schemaMappingTotalTime := time.Since(schemaMappingStartTime)

	// Process results in order and append to batch
	for jobID := 0; jobID < numJobs; jobID++ {
		result := results[jobID]
		for _, procMsg := range result.processed {
			// Append to batch
			appendStartTime := time.Now()
			err = resultBatch.Append(procMsg.metadata.Sequence.Stream, procMsg.values...)
			if err != nil {
				if errors.Is(err, clickhouse.ErrAlreadyExists) {
					skippedCount++
					continue
				}
				return nil, fmt.Errorf("failed to append values to batch: %w", err)
			}
			appendTotalTime += time.Since(appendStartTime)
		}
	}

	totalPrepDuration := time.Since(prepStartTime)

	// Record processing time metrics
	if ch.meter != nil {
		ch.meter.RecordProcessingDurationWithStage(ctx, schemaMappingTotalTime.Seconds(), "schema_mapping")
		ch.meter.RecordProcessingDurationWithStage(ctx, totalPrepDuration.Seconds(), "total_preparation")
		if len(messages) > 0 {
			avgPerMessage := totalPrepDuration.Seconds() / float64(len(messages))
			ch.meter.RecordProcessingDurationWithStage(ctx, avgPerMessage, "per_message")
		}
	}

	ch.log.InfoContext(ctx, "Batch preparation completed",
		"message_count", len(messages),
		"skipped_count", skippedCount,
		"total_prep_duration_ms", totalPrepDuration.Milliseconds(),
		"schema_mapping_total_ms", schemaMappingTotalTime.Milliseconds())

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
