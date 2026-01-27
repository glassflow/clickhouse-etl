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

// appendRequest represents a request to append data to the batch
type appendRequest struct {
	id     uint64
	values []any
	errCh  chan error
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

	// Worker pool for parallel PrepareValuesV2 processing
	workerPoolSize   int
	workerJobChan    chan workerJob
	workerResultChan chan workerResult
	workerWg         sync.WaitGroup
	workerCtx        context.Context
	workerCancel     context.CancelFunc
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

	// Default worker pool size is 4
	workerPoolSize := 4
	// TODO: Make this configurable via sinkConfig if needed in the future

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

// startWorkerPool starts N worker goroutines to process PrepareValuesV2 in parallel
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

// worker processes messages in parallel by calling PrepareValuesV2
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
					values, err = ch.schemaMapper.PrepareValuesV2(msg.Data())
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

	ch.log.InfoContext(ctx, "All messages read from NATS, starting batch processing",
		"message_count", len(messages),
		"nats_read_duration_ms", natsReadDuration.Milliseconds(),
		"status", "messages_read")

	err := ch.sendBatch(ctx, messages, natsReadDuration)
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

func (ch *ClickHouseSink) sendBatch(ctx context.Context, messages []jetstream.Msg, natsReadDuration time.Duration) error {
	if len(messages) == 0 {
		return nil
	}

	chBatch, err := ch.createCHBatch(ctx, messages, natsReadDuration)
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
	natsReadDuration time.Duration,
) (clickhouse.Batch, error) {
	prepStartTime := time.Now()

	// Query creation
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

	// Batch creation
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

	// Parallel append: Use a channel-based approach to parallelize append requests
	// Multiple goroutines send append requests in parallel, a dedicated goroutine serializes them
	appendStartTime := time.Now()
	appendChan := make(chan appendRequest, len(messages))
	var appendErr error
	var appendErrMu sync.Mutex
	var skippedCountMu sync.Mutex
	var senderWg sync.WaitGroup

	// Start append goroutine that serializes all appends (ClickHouse batch is not thread-safe)
	appendDone := make(chan struct{})
	go func() {
		defer close(appendDone)
		for req := range appendChan {
			reqErr := resultBatch.Append(req.id, req.values...)
			req.errCh <- reqErr
			if reqErr != nil {
				if errors.Is(reqErr, clickhouse.ErrAlreadyExists) {
					skippedCountMu.Lock()
					skippedCount++
					skippedCountMu.Unlock()
				} else {
					appendErrMu.Lock()
					if appendErr == nil {
						appendErr = reqErr
					}
					appendErrMu.Unlock()
				}
			}
		}
	}()

	// Send append requests in parallel from all worker results
	// Each job result sends its append requests concurrently
	for jobID := 0; jobID < numJobs; jobID++ {
		result := results[jobID]
		senderWg.Add(1)
		go func(procMsgs []processedMessage) {
			defer senderWg.Done()
			for _, procMsg := range procMsgs {
				errCh := make(chan error, 1)
				select {
				case <-ctx.Done():
					return
				case appendChan <- appendRequest{
					id:     procMsg.metadata.Sequence.Stream,
					values: procMsg.values,
					errCh:  errCh,
				}:
					// Wait for append to complete (serialized by append goroutine)
					<-errCh // Error handling done in append goroutine
				}
			}
		}(result.processed)
	}

	// Wait for all senders to finish, then close channel to signal append goroutine to finish
	senderWg.Wait()
	close(appendChan)
	<-appendDone // Wait for append goroutine to finish processing all requests
	appendTotalTime = time.Since(appendStartTime)

	if appendErr != nil {
		return nil, fmt.Errorf("failed to append values to batch: %w", appendErr)
	}

	totalPrepDuration := time.Since(prepStartTime)

	// First log: Simple preparation complete message
	ch.log.InfoContext(ctx, "Preparation inside sink code completed, batch ready for ClickHouse",
		"message_count", len(messages),
		"status", "preparation_completed")

	// Second log: Detailed timing breakdown
	ch.log.InfoContext(ctx, "Batch preparation timing breakdown",
		"message_count", len(messages),
		"skipped_count", skippedCount,
		"nats_read_duration_ms", natsReadDuration.Milliseconds(),
		"total_prep_duration_ms", totalPrepDuration.Milliseconds(),
		"schema_mapping_total_ms", schemaMappingTotalTime.Milliseconds(),
		"append_total_ms", appendTotalTime.Milliseconds(),
		"avg_per_message_us", totalPrepDuration.Microseconds()/int64(len(messages)),
		"worker_pool_size", ch.workerPoolSize,
		"status", "timing_breakdown")

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
