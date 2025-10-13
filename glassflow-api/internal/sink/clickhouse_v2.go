package sink

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"sync"
	"time"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/batch"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/client"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/schema"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/stream"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/pkg/observability"
	"github.com/nats-io/nats.go/jetstream"
)

type ClickHouseSinkV2 struct {
	client                *client.ClickHouseClient
	messages              []jetstream.Msg
	mu                    sync.Mutex
	streamConsumer        stream.Consumer
	schemaMapper          schema.Mapper
	cancel                context.CancelFunc
	shutdownOnce          sync.Once
	sinkConfig            models.SinkComponentConfig
	clickhouseQueryConfig models.ClickhouseQueryConfig
	log                   *slog.Logger
	meter                 *observability.Meter
	dlqPublisher          stream.Publisher
}

func NewClickHouseSinkV2(
	sinkConfig models.SinkComponentConfig,
	streamConsumer stream.Consumer,
	schemaMapper schema.Mapper,
	log *slog.Logger,
	meter *observability.Meter,
	dlqPublisher stream.Publisher,
	clickhouseQueryConfig models.ClickhouseQueryConfig,
) (*ClickHouseSinkV2, error) {
	clickhouseClient, err := client.NewClickHouseClient(context.Background(), sinkConfig.ClickHouseConnectionParams)
	if err != nil {
		log.Error("failed to create clickhouse client", "error", err)
		return nil, fmt.Errorf("failed to create clickhouse client: %w", err)
	}

	if sinkConfig.Batch.MaxBatchSize <= 0 {
		log.Error("invalid max batch size", "max_batch_size", sinkConfig.Batch.MaxBatchSize)
		return nil, fmt.Errorf("max batch size must be greater than 0")
	}

	return &ClickHouseSinkV2{
		client:                clickhouseClient,
		streamConsumer:        streamConsumer,
		schemaMapper:          schemaMapper,
		sinkConfig:            sinkConfig,
		log:                   log,
		meter:                 meter,
		dlqPublisher:          dlqPublisher,
		clickhouseQueryConfig: clickhouseQueryConfig,
	}, nil
}

func (ch *ClickHouseSinkV2) Start(ctx context.Context) error {
	maxDelayTime := time.Second * 60
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
			shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer shutdownCancel()
			return ch.handleShutdown(shutdownCtx)
		case <-ticker.C:
			ch.flushEventsOnTimerTick(ctx)
		default:
			err := ch.fetchAndFlush(ctx)
			if err != nil {
				if errors.Is(err, models.ErrNoNewMessages) {
					time.Sleep(internal.FetchRetryDelay)
					err = nil
					continue
				}
				ch.log.ErrorContext(ctx, "fetchAndFlush", "error", err)
			}
		}
	}
}

func (ch *ClickHouseSinkV2) fetchAndFlush(ctx context.Context) error {
	ch.mu.Lock()
	defer ch.mu.Unlock()

	messages, err := ch.fetchMessages(ctx)
	if err != nil {
		return fmt.Errorf("fetch messages: %w", err)
	}

	ch.messages = append(ch.messages, messages...)

	if len(ch.messages) < ch.sinkConfig.Batch.MaxBatchSize {
		return nil
	}

	err = ch.flushEvents(ctx)
	if err != nil {
		return fmt.Errorf("send events: %w", err)
	}

	return nil
}

// shutdown handles the shutdown logic
func (ch *ClickHouseSinkV2) handleShutdown(ctx context.Context) error {
	ch.mu.Lock()
	defer ch.mu.Unlock()

	ch.log.InfoContext(ctx, "ClickHouse sink shutting down")
	return ch.flushEvents(ctx)
}

func (ch *ClickHouseSinkV2) fetchMessages(ctx context.Context) ([]jetstream.Msg, error) {
	msgBatch, err := ch.streamConsumer.FetchNoAwait(ch.sinkConfig.Batch.MaxBatchSize)
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

func (ch *ClickHouseSinkV2) flushEvents(ctx context.Context) error {
	if len(ch.messages) == 0 {
		return nil
	}

	chBatch, err := ch.createCHBatch(ctx, ch.messages)
	if err != nil {
		return fmt.Errorf("create CH batch: %w", err)
	}

	err = ch.sendBatch(ctx, chBatch)
	if err == nil {
		ch.messages = nil
		return nil
	}
	ch.log.Error("failed to send CH batch, trying async write", "error", err)
	lastProcessedIndex, err := ch.flushBadBatch(ctx, ch.messages)
	if err != nil {
		return fmt.Errorf("flush bad batch: %w", err)
	}
	if lastProcessedIndex >= 0 {
		ch.messages = ch.messages[lastProcessedIndex+1:]
	}

	return nil
}

// Bad batch contains at least one event that failed to insert.
// Try to insert messages one-by-one. If an insert fails, write it to the DLQ.
func (ch *ClickHouseSinkV2) flushBadBatch(
	ctx context.Context,
	messages []jetstream.Msg,
) (int, error) {
	query := fmt.Sprintf(
		"INSERT INTO %s.%s (%s) VALUES (%s)",
		ch.client.GetDatabase(),
		ch.client.GetTableName(),
		strings.Join(ch.schemaMapper.GetOrderedColumns(), ", "),
		strings.TrimSuffix(strings.Repeat("?, ", len(ch.schemaMapper.GetOrderedColumns())), ", "),
	)

	lastProcessedIndex := -1
	for i, msg := range messages {
		values, err := ch.schemaMapper.PrepareValues(msg.Data())
		if err != nil {
			return -1, fmt.Errorf("failed to map data for ClickHouse: %w", err)
		}

		err = ch.client.AsyncInsert(
			ctx,
			query,
			ch.clickhouseQueryConfig.WaitForAsyncInsert,
			values...,
		)
		if err != nil {
			dlqErr := ch.pushMsgToDLQ(ctx, msg.Data(), err)
			if dlqErr != nil {
				return -1, fmt.Errorf("failed to push message to DLQ: %w", dlqErr)
			}
		}

		err = msg.Ack()
		if err != nil {
			return -1, fmt.Errorf("failed to acknowledge message: %w", err)
		}

		lastProcessedIndex = i
	}

	return lastProcessedIndex, nil
}

func (ch *ClickHouseSinkV2) sendBatch(ctx context.Context, chBatch batch.Batch) error {
	if chBatch.Size() == 0 {
		return nil
	}

	size := chBatch.Size()
	start := time.Now()

	// Send batch to ClickHouse
	err := chBatch.Send(ctx)
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
	lastMsg := ch.messages[len(ch.messages)-1]
	err = lastMsg.Ack()
	if err != nil {
		ch.log.ErrorContext(ctx, "failed to acknowledge messages", "batch_size", size, "error", err)
		return fmt.Errorf("failed to acknowledge messages: %w", err)
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

func (ch *ClickHouseSinkV2) createCHBatch(
	ctx context.Context,
	messages []jetstream.Msg,
) (batch.Batch, error) {
	query := fmt.Sprintf(
		"INSERT INTO %s.%s (%s)",
		ch.client.GetDatabase(),
		ch.client.GetTableName(),
		strings.Join(ch.schemaMapper.GetOrderedColumns(), ", "),
	)

	ch.log.Debug("Insert query", "query", query)

	resultBatch, err := batch.NewClickHouseBatch(ctx, ch.client, query)
	if err != nil {
		return nil, fmt.Errorf("failed to create batch with query %s: %w", query, err)
	}

	for _, msg := range messages {
		var metadata *jetstream.MsgMetadata
		metadata, err = msg.Metadata()
		if err != nil {
			ch.log.ErrorContext(ctx, "failed to get message metadata", "error", err)
		}

		values, err := ch.schemaMapper.PrepareValues(msg.Data())
		if err != nil {
			return nil, fmt.Errorf("failed to prepare values for message: %w", err)
		}

		err = resultBatch.Append(metadata.Sequence.Stream, values...)
		if err != nil {
			if errors.Is(err, batch.ErrAlreadyExists) {
				continue
			}
			return nil, fmt.Errorf("failed to append values to batch: %w", err)
		}
	}

	return resultBatch, nil
}

func (ch *ClickHouseSinkV2) flushEventsOnTimerTick(ctx context.Context) {
	ch.mu.Lock()
	defer ch.mu.Unlock()
	if len(ch.messages) == 0 {
		return
	}
	ch.log.DebugContext(ctx, "Timer-based batch flush triggered",
		"current_batch_size", len(ch.messages),
		"timer_interval", ch.sinkConfig.Batch.MaxDelayTime)

	err := ch.flushEvents(ctx)
	if err != nil {
		ch.log.ErrorContext(ctx, "error on exporting data", "error", err)
	}
}

func (ch *ClickHouseSinkV2) clearConn() {
	err := ch.client.Close()
	if err != nil {
		ch.log.Error("failed to close ClickHouse client connection", "error", err)
	} else {
		ch.log.Debug("ClickHouse client connection closed")
	}
}

func (ch *ClickHouseSinkV2) Stop(noWait bool) {
	ch.shutdownOnce.Do(func() {
		if ch.cancel != nil {
			ch.cancel()
		}
		ch.log.Debug("Stop signal sent", "no_wait", noWait)
	})
}

func (ch *ClickHouseSinkV2) pushMsgToDLQ(ctx context.Context, orgMsg []byte, err error) error {
	ch.log.Error("Pushing message to DLQ", slog.Any("error", err))

	data, err := models.NewDLQMessage(internal.RoleSink, err.Error(), orgMsg).ToJSON()
	if err != nil {
		ch.log.Error("Failed to convert DLQ message to JSON", slog.Any("error", err))
		return fmt.Errorf("failed to convert DLQ message to JSON: %w", err)
	}

	err = ch.dlqPublisher.Publish(ctx, data)
	if err != nil {
		ch.log.Error("Failed to publish message to DLQ", slog.Any("error", err))
		return fmt.Errorf("failed to publish to DLQ: %w", err)
	}

	// Record DLQ write metric
	if ch.meter != nil {
		ch.meter.RecordDLQWrite(ctx, 1)
	}

	return nil
}
