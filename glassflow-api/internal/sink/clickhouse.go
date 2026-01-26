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

type ClickHouseSink struct {
	client                *client.ChGoClient
	streamConsumer        jetstream.Consumer
	schemaMapper          schema.Mapper
	columnarMapper        schema.ColumnarMapper // Columnar mapper for optimized path
	cancel                context.CancelFunc
	shutdownOnce          sync.Once
	sinkConfig            models.SinkComponentConfig
	clickhouseQueryConfig models.ClickhouseQueryConfig
	streamSourceID        string
	log                   *slog.Logger
	meter                 *observability.Meter
	dlqPublisher          stream.Publisher
	batchPool             *sync.Pool // Pool for reusing ColumnarBatch instances
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
	clickhouseClient, err := client.NewChGoClient(context.Background(), sinkConfig.ClickHouseConnectionParams)
	if err != nil {
		return nil, fmt.Errorf("failed to create clickhouse client: %w", err)
	}

	if sinkConfig.Batch.MaxBatchSize <= 0 {
		return nil, fmt.Errorf("invalid max batch size, should be > 0: %d", sinkConfig.Batch.MaxBatchSize)
	}

	// Check if mapper implements ColumnarMapper interface
	// JsonToClickHouseMapper implements ColumnarMapper
	var columnarMapper schema.ColumnarMapper
	jsonMapper, isJsonMapper := schemaMapper.(*schema.JsonToClickHouseMapper)
	if isJsonMapper {
		columnarMapper = jsonMapper
		// Log mapper state for debugging
		log.Debug("Mapper initialized", "stream_count", len(jsonMapper.Streams), "streamSourceID", streamSourceID)
	}

	// Create batch pool for reusing ColumnarBatch instances
	// We'll initialize it lazily in createColumnarBatch when we have column info
	var batchPool *sync.Pool
	if isJsonMapper {
		// We'll set up the pool in createColumnarBatch on first use
		batchPool = &sync.Pool{}
	}

	return &ClickHouseSink{
		client:                clickhouseClient,
		streamConsumer:        streamConsumer,
		schemaMapper:          schemaMapper,
		columnarMapper:        columnarMapper,
		sinkConfig:            sinkConfig,
		log:                   log,
		meter:                 meter,
		dlqPublisher:          dlqPublisher,
		clickhouseQueryConfig: clickhouseQueryConfig,
		streamSourceID:        streamSourceID,
		batchPool:             batchPool,
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
	msgBatch, err := ch.streamConsumer.FetchNoWait(ch.sinkConfig.Batch.MaxBatchSize)
	if err != nil {
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
		return nil, fmt.Errorf("failed to fetch messages: %w", msgBatch.Error())
	}

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

	chBatch, err := ch.createCHBatch(ctx, messages)
	if err != nil {
		return fmt.Errorf("create CH batch: %w", err)
	}

	// Return columnar batch to pool after use
	if columnarBatch, ok := chBatch.(*clickhouse.ColumnarBatch); ok {
		defer ch.batchPool.Put(columnarBatch)
	}

	size := chBatch.Size()
	start := time.Now()

	// Send batch to ClickHouse
	err = chBatch.Send(ctx)
	if err != nil {
		return fmt.Errorf("send the batch: %w", err)
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
	lastMsg := messages[len(messages)-1]
	err = retry.Do(
		func() error {
			err = lastMsg.Ack()
			return err
		},
		retry.Attempts(3),
		retry.DelayType(retry.FixedDelay),
	)
	if err != nil {
		return fmt.Errorf("acknowledge messages: %w", err)
	}

	mdata, err := lastMsg.Metadata()
	if err != nil {
		ch.log.ErrorContext(ctx, "failed to get message metadata", "error", err)
	} else {
		ch.log.DebugContext(ctx, "Message acked by JetStream", "stream", mdata.Sequence.Stream)
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
	// Use columnar approach if ColumnarMapper is available
	if ch.columnarMapper != nil {
		return ch.createColumnarBatch(ctx, messages)
	}

	// Fallback to old row-oriented approach (should not happen in normal operation)
	return ch.createRowOrientedBatch(ctx, messages)
}

// createColumnarBatch creates a batch using the columnar approach for optimal performance.
func (ch *ClickHouseSink) createColumnarBatch(
	ctx context.Context,
	messages []jetstream.Msg,
) (clickhouse.Batch, error) {
	// Performance tracking
	prepStart := time.Now()
	var schemaFetchDuration, batchCreationDuration, metadataTotalDuration, appendTotalDuration time.Duration
	skippedCount := 0

	// Get column names and types
	var columnNames []string
	var columnTypes []string
	streamName := ch.streamSourceID

	// Get column types from mapper
	jsonMapper, ok := ch.schemaMapper.(*schema.JsonToClickHouseMapper)
	if !ok {
		return nil, fmt.Errorf("mapper is not JsonToClickHouseMapper, cannot get column types")
	}

	// If streamName is empty, determine it from the mapper (should be single stream)
	if streamName == "" {
		streamCount := len(jsonMapper.Streams)

		// For single stream scenarios, get the stream name from mapper
		if streamCount == 1 {
			for name := range jsonMapper.Streams {
				streamName = name
				break
			}
		} else if streamCount > 1 {
			// List all stream names for debugging
			streamNames := make([]string, 0, len(jsonMapper.Streams))
			for name := range jsonMapper.Streams {
				streamNames = append(streamNames, name)
			}
			return nil, fmt.Errorf("multiple streams found %v (count: %d) but streamSourceID is empty, cannot determine which stream to use", streamNames, streamCount)
		} else {
			return nil, fmt.Errorf("no streams defined in mapper")
		}
	}

	// Get column names for the determined stream
	if streamName != "" {
		columnNames = ch.schemaMapper.GetOrderedColumnsStream(streamName)
	} else {
		// Fallback: get all columns (should not happen in normal operation)
		columnNames = ch.schemaMapper.GetOrderedColumns()
	}

	// Query actual table schema to get real column types
	// This matches the old clickhouse-go behavior where the driver used the table's actual types
	schemaFetchStart := time.Now()
	tableSchema, err := ch.client.GetTableSchema(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get table schema: %w", err)
	}
	schemaFetchDuration = time.Since(schemaFetchStart)

	// Build map of actual column types from table schema
	actualColumnTypes := make(map[string]string)
	for _, col := range tableSchema {
		actualColumnTypes[col.Name] = col.Type
	}

	// Build columnTypes using actual table types (not mapper types)
	columnTypes = make([]string, 0, len(columnNames))
	for _, colName := range columnNames {
		if colType, ok := actualColumnTypes[colName]; ok {
			columnTypes = append(columnTypes, colType)
		} else {
			return nil, fmt.Errorf("column %s not found in table schema", colName)
		}
	}

	// Initialize batch pool on first use with the correct schema
	if ch.batchPool.New == nil {
		// Capture columnNames and columnTypes for pool
		names := make([]string, len(columnNames))
		types := make([]string, len(columnTypes))
		copy(names, columnNames)
		copy(types, columnTypes)

		ch.batchPool.New = func() any {
			b, err := clickhouse.NewColumnarBatch(ch.client, names, types)
			if err != nil {
				// If batch creation fails, return nil and handle in caller
				return nil
			}
			return b
		}
	}

	// Get or create batch from pool
	batchCreationStart := time.Now()
	var batch *clickhouse.ColumnarBatch
	pooled := ch.batchPool.Get()
	if pooled != nil {
		if cb, ok := pooled.(*clickhouse.ColumnarBatch); ok && cb != nil {
			batch = cb
			batch.Reset()
		}
	}

	// Create new batch if pool didn't return one (shouldn't happen after first init)
	if batch == nil {
		var err error
		batch, err = clickhouse.NewColumnarBatch(ch.client, columnNames, columnTypes)
		if err != nil {
			return nil, fmt.Errorf("failed to create columnar batch: %w", err)
		}
	}
	batchCreationDuration = time.Since(batchCreationStart)

	// Append messages to batch
	for _, msg := range messages {
		metadataStart := time.Now()
		metadata, err := msg.Metadata()
		if err != nil {
			return nil, fmt.Errorf("failed to get message metadata: %w", err)
		}
		metadataTotalDuration += time.Since(metadataStart)

		// Check for duplicates
		if batch.HasID(metadata.Sequence.Stream) {
			skippedCount++
			continue
		}
		batch.AddID(metadata.Sequence.Stream)

		// Append directly to columns - no []any allocation
		// Use the same streamName we used to get columns
		appendStart := time.Now()
		if err := ch.columnarMapper.AppendToColumns(streamName, msg.Data(), batch); err != nil {
			// Return batch to pool on error
			ch.batchPool.Put(batch)
			return nil, fmt.Errorf("failed to append to columns: %w", err)
		}
		appendTotalDuration += time.Since(appendStart)
	}

	// Log performance metrics
	totalPrepDuration := time.Since(prepStart)
	messageCount := len(messages)
	avgPerMessageUs := int64(0)
	if messageCount > 0 {
		avgPerMessageUs = totalPrepDuration.Microseconds() / int64(messageCount)
	}

	ch.log.InfoContext(ctx, "Batch preparation completed",
		"message_count", messageCount,
		"skipped_count", skippedCount,
		"total_prep_duration_ms", totalPrepDuration.Milliseconds(),
		"schema_fetch_ms", schemaFetchDuration.Milliseconds(),
		"batch_creation_ms", batchCreationDuration.Milliseconds(),
		"metadata_total_ms", metadataTotalDuration.Milliseconds(),
		"append_total_ms", appendTotalDuration.Milliseconds(),
		"avg_per_message_us", avgPerMessageUs,
		"status", "preparation_completed",
	)

	return batch, nil
}

// createRowOrientedBatch creates a batch using the old row-oriented approach (fallback).
func (ch *ClickHouseSink) createRowOrientedBatch(
	ctx context.Context,
	messages []jetstream.Msg,
) (clickhouse.Batch, error) {
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

	// For row-oriented batch, we'd need the old client interface
	// This is a fallback that shouldn't normally be used
	return nil, fmt.Errorf("row-oriented batch creation not supported with ChGoClient, use ColumnarMapper")
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
