package sink

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"runtime"
	"sync"
	"time"

	"github.com/avast/retry-go"

	"github.com/nats-io/nats.go/jetstream"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/batch/clickhouse"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/client"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
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
	metadata        *jetstream.MsgMetadata
	values          []any
	msg             jetstream.Msg
	schemaVersionID string
	err             error
}

type schemaBatch struct {
	batch    clickhouse.Batch
	messages []jetstream.Msg
}

// ClickHouseSink uses Consume() callback pattern
type FieldMapper interface {
	Map(data []byte, schemaVersionID string, config map[string]models.Mapping) ([]any, error)
	GetColumnNames(schemaVersionID string) ([]string, error)
}

type ConfigStore interface {
	GetSinkConfig(ctx context.Context, sourceSchemaVersion string) (map[string]models.Mapping, error)
}

type ClickHouseSink struct {
	client                *client.ClickHouseClient
	streamConsumer        jetstream.Consumer
	mapper                FieldMapper
	cfgStore              ConfigStore
	cancel                context.CancelFunc
	shutdownOnce          sync.Once
	sinkConfig            models.SinkComponentConfig
	clickhouseQueryConfig models.ClickhouseQueryConfig
	streamSourceID        string
	log                   *slog.Logger
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
}

func NewClickHouseSink(
	sinkConfig models.SinkComponentConfig,
	streamConsumer jetstream.Consumer,
	mapper FieldMapper,
	cfgStore ConfigStore,
	log *slog.Logger,
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
	workerPoolSize := runtime.GOMAXPROCS(0) - 2 // leave 2 for the main thread, IO, etc
	if workerPoolSize < 1 {
		workerPoolSize = 1
	}

	return &ClickHouseSink{
		client:                clickhouseClient,
		streamConsumer:        streamConsumer,
		mapper:                mapper,
		cfgStore:              cfgStore,
		sinkConfig:            sinkConfig,
		log:                   log,
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
	ch.log.InfoContext(ctx, "ClickHouse sink started",
		"max_batch_size", ch.maxBatchSize,
		"max_delay_time", ch.maxDelayTime,
		"worker_pool_size", ch.workerPoolSize)

	defer ch.log.InfoContext(ctx, "ClickHouse sink stopped")
	defer ch.clearConn()

	ctx, cancel := context.WithCancel(ctx)
	ch.cancel = cancel
	defer cancel()

	// Initialize and start a worker pool
	ch.workerCtx, ch.workerCancel = context.WithCancel(context.Background())
	ch.workerJobChan = make(chan workerJob, ch.workerPoolSize)
	ch.workerResultChan = make(chan workerResult, ch.workerPoolSize)
	ch.startWorkerPool()
	defer ch.stopWorkerPool()

	// Create a ticker for time-based flushing
	ch.bufferFlushTicker = time.NewTicker(ch.maxDelayTime)
	defer ch.bufferFlushTicker.Stop()
	go ch.flushTickerLoop(ctx)

	// Message handler
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

	// Durable pull consumer
	cc, err := ch.streamConsumer.Consume(
		messageHandler,
		jetstream.PullMaxMessages(ch.maxBatchSize*ch.workerPoolSize), // Pull in batches
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
	for range ch.workerPoolSize {
		ch.workerWg.Add(1)
		go ch.worker()
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

// worker processes messages in parallel by calling PrepareValues
func (ch *ClickHouseSink) worker() {
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

			// Cache config per schema version to avoid repeated GetSinkConfig calls
			workerConfigsCache := make(map[string]map[string]models.Mapping, 1)

			for _, msg := range job.messages {
				// Get metadata
				metadata, err := msg.Metadata()
				if err != nil {
					processed = append(processed, processedMessage{
						msg: msg,
						err: fmt.Errorf("failed to get message metadata: %w", err),
					})
					continue
				}

				// Schema mapping
				var values []any
				schemaVersionID := msg.Headers().Get(internal.SchemaVersionIDHeader)
				if schemaVersionID == "" {
					processed = append(processed, processedMessage{
						msg: msg,
						err: fmt.Errorf("message is missing schema version header: %s", internal.SchemaVersionIDHeader),
					})
					continue
				}

				mappingConfig, ok := workerConfigsCache[schemaVersionID]
				if !ok {
					mappingConfig, err = ch.cfgStore.GetSinkConfig(ch.workerCtx, schemaVersionID)
					if err != nil {
						processed = append(processed, processedMessage{
							msg: msg,
							err: fmt.Errorf("failed to get sink config for schema version %s: %w", schemaVersionID, err),
						})
						continue
					}
					workerConfigsCache[schemaVersionID] = mappingConfig
				}

				values, err = ch.mapper.Map(msg.Data(), schemaVersionID, mappingConfig)
				if err != nil {
					processed = append(processed, processedMessage{
						msg: msg,
						err: fmt.Errorf("failed to prepare values for message: %w", err),
					})
					continue
				}

				processed = append(processed, processedMessage{
					metadata:        metadata,
					values:          values,
					msg:             msg,
					schemaVersionID: schemaVersionID,
					err:             nil,
				})
			}

			// Send a result back to the parent routine
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
	if err != nil {
		ch.log.ErrorContext(ctx, "failed to send batch to ClickHouse", "error", err)
		dlqFlushErr := ch.flushFailedBatch(ctx, messages, err)
		if dlqFlushErr != nil {
			return fmt.Errorf("failed to flush bad batch to DLQ after send error: %w", dlqFlushErr)
		}
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
	var totalBytes int64
	for _, msg := range messages {
		totalBytes += int64(len(msg.Data()))
	}

	observability.RecordBytesProcessed(ctx, "sink", "in", totalBytes)

	batchesBySchema, err := ch.createCHBatches(ctx, messages)
	if err != nil {
		return fmt.Errorf("create CH batches: %w", err)
	}

	var allErr error
	totalSent := 0

	for schemaVersionID, schemaData := range batchesBySchema {
		size := schemaData.batch.Size()
		if size == 0 {
			continue
		}

		start := time.Now()
		err = schemaData.batch.Send(ctx)
		if err != nil {
			ch.log.ErrorContext(ctx, "failed to send schema batch, writing to dlq",
				"schema_version_id", schemaVersionID,
				"error", err,
				"batch_size", len(schemaData.messages))

			flushErr := ch.flushFailedBatch(ctx, schemaData.messages, err)
			if flushErr != nil {
				allErr = errors.Join(allErr, fmt.Errorf("schema %s flush bad batch: %w", schemaVersionID, flushErr))
			}
			continue
		}

		if err = ch.ackMessages(schemaData.messages); err != nil {
			allErr = errors.Join(allErr, fmt.Errorf("schema %s acknowledge messages: %w", schemaVersionID, err))
			continue
		}

		totalSent += size
		ch.log.DebugContext(ctx, "Data sent successfully to ClickHouse",
			"schema_version_id", schemaVersionID,
			"message_count", size)

		observability.RecordClickHouseWrite(ctx, "sink", int64(size))

		duration := time.Since(start).Seconds()
		if duration > 0 {
			rate := float64(size) / duration
			observability.RecordSinkRate(ctx, "sink", rate)
		}

		observability.RecordBytesProcessed(ctx, "sink", "out", totalBytes)
	}

	if allErr != nil {
		return allErr
	}

	ch.log.InfoContext(ctx, "Batches processing completed successfully",
		"status", "success",
		"sent_messages", totalSent,
	)

	return nil
}

func (ch *ClickHouseSink) ackMessages(messages []jetstream.Msg) error {
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

	return nil
}

func (ch *ClickHouseSink) createCHBatches(
	ctx context.Context,
	messages []jetstream.Msg,
) (map[string]*schemaBatch, error) {
	prepStartTime := time.Now()

	batches := make(map[string]*schemaBatch)

	// Step 3: Process messages using worker pool (metadata + schema mapping + append)
	schemaMappingStartTime := time.Now()
	skippedCount := 0

	if len(messages) == 0 {
		return batches, nil
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
	collectCtx := ctx
	if _, ok := ctx.Deadline(); !ok {
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

	failedMsgs := make([]jetstream.Msg, 0)

	schemaMappingTotalTime := time.Since(schemaMappingStartTime)

	// Process results in order and append to batch
	appendedBySchema := make(map[string][]*processedMessage)
	for jobID := 0; jobID < numJobs; jobID++ {
		result := results[jobID]
		for _, procMsg := range result.processed {
			// If there was an error during processing, push to DLQ and skip
			if procMsg.err != nil {
				dlqErr := ch.pushMsgToDLQ(ctx, procMsg.msg.Data(), procMsg.err)
				if dlqErr != nil {
					return nil, fmt.Errorf("failed to push bad message to DLQ: %w", dlqErr)
				}

				failedMsgs = append(failedMsgs, procMsg.msg)
				skippedCount++
				continue
			}

			// Append to batch for the corresponding schema version
			batchedData, exists := batches[procMsg.schemaVersionID]
			if !exists {
				batch, err := ch.createBatchForSchemaVersion(ctx, procMsg.schemaVersionID)
				if err != nil {
					return nil, fmt.Errorf("failed to create batch for schema version %s: %w", procMsg.schemaVersionID, err)
				}

				batchedData = &schemaBatch{
					batch:    batch,
					messages: make([]jetstream.Msg, 0),
				}
				batches[procMsg.schemaVersionID] = batchedData
			}

			err := batchedData.batch.Append(procMsg.metadata.Sequence.Stream, procMsg.values...)
			if err != nil {
				if !errors.Is(err, clickhouse.ErrAlreadyExists) {
					ch.log.Warn("Failed to append message to batch, pushing to DLQ",
						slog.Any("error", err))

					dlqErr := ch.pushMsgToDLQ(ctx, procMsg.msg.Data(), err)
					if dlqErr != nil {
						return nil, fmt.Errorf("failed to push bad message to DLQ: %w", dlqErr)
					}

					// try to recreate the batch and replay appended messages to avoid losing the whole batch due to one bad message
					batch, err := ch.createBatchForSchemaVersion(ctx, procMsg.schemaVersionID)
					if err != nil {
						return nil, fmt.Errorf("failed to recreate CH batch after append error: %w", err)
					}
					batchedData.batch = batch

					for _, appended := range appendedBySchema[procMsg.schemaVersionID] {
						err = batchedData.batch.Append(appended.metadata.Sequence.Stream, appended.values...)
						if err != nil {
							return nil, fmt.Errorf("failed to replay CH batch after append error: %w", err)
						}
					}
				}
				failedMsgs = append(failedMsgs, procMsg.msg)
				skippedCount++
				continue
			}
			appendedBySchema[procMsg.schemaVersionID] = append(appendedBySchema[procMsg.schemaVersionID], &procMsg)
			batchedData.messages = append(batchedData.messages, procMsg.msg)
		}
	}

	// Acknowledge failed messages during processing of the consumed messages batch
	if len(failedMsgs) > 0 {
		ch.log.WarnContext(ctx, "Some messages failed during batch preparation and were pushed to DLQ",
			"failed_message_count", len(failedMsgs),
			"skipped_count", skippedCount)
		err := ch.ackMessages(failedMsgs)
		if err != nil {
			return nil, fmt.Errorf("acknowledge failed messages: %w", err)
		}
	}

	totalPrepDuration := time.Since(prepStartTime)

	// Record processing time metrics
	observability.RecordProcessingDurationWithStage(ctx, "sink", "schema_mapping", schemaMappingTotalTime.Seconds())
	observability.RecordProcessingDurationWithStage(ctx, "sink", "total_preparation", totalPrepDuration.Seconds())
	if len(messages) > 0 {
		avgPerMessage := totalPrepDuration.Seconds() / float64(len(messages))
		observability.RecordProcessingDurationWithStage(ctx, "sink", "per_message", avgPerMessage)
	}

	ch.log.InfoContext(ctx, "Batch preparation completed",
		"message_count", len(messages),
		"skipped_count", skippedCount,
		"total_prep_duration_ms", totalPrepDuration.Milliseconds(),
		"schema_mapping_total_ms", schemaMappingTotalTime.Milliseconds())

	return batches, nil
}

func (ch *ClickHouseSink) createBatchForSchemaVersion(ctx context.Context, schemaVersionID string) (clickhouse.Batch, error) {
	columns, err := ch.mapper.GetColumnNames(schemaVersionID)
	if err != nil {
		return nil, fmt.Errorf("failed to get column names for schema version %s: %w", schemaVersionID, err)
	}
	query := fmt.Sprintf(
		"INSERT INTO %s.%s (%s)",
		quoteIdentifier(ch.client.GetDatabase()),
		quoteIdentifier(ch.client.GetTableName()),
		quoteIdentifiers(columns),
	)
	batch, err := clickhouse.NewClickHouseBatch(ctx, ch.client, query)
	if err != nil {
		return nil, fmt.Errorf("failed to create batch for schema version %s: %w", schemaVersionID, err)
	}

	return batch, nil
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
	observability.RecordDLQWrite(ctx, "sink", 1)

	return nil
}
