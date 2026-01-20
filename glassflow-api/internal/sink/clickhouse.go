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
		"max_delay_time", maxDelayTime,
		"mode", "blocking_fetch")

	defer ch.log.InfoContext(ctx, "ClickHouse sink stopped")
	defer ch.clearConn()

	ctx, cancel := context.WithCancel(ctx)
	ch.cancel = cancel
	defer cancel()

	for {
		select {
		case <-ctx.Done():
			return ch.shutdownWithTimeout()
		default:
			err := ch.fetchAndFlush(ctx, maxDelayTime)
			if err != nil {
				if errors.Is(err, models.ErrNoNewMessages) {
					continue
				}
				ch.log.ErrorContext(ctx, "failed to fetch and flush", "error", err)
			}
		}
	}
}

func (ch *ClickHouseSink) fetchAndFlush(ctx context.Context, maxWait time.Duration) error {
	messages, err := ch.fetchMessages(ctx, maxWait)
	if err != nil {
		return fmt.Errorf("fetch messages: %w", err)
	}

	// If context was cancelled during fetch, use a fresh context for flushing
	flushCtx := ctx
	if ctx.Err() != nil {
		var cancel context.CancelFunc
		flushCtx, cancel = context.WithTimeout(context.Background(), internal.SinkDefaultShutdownTimeout)
		defer cancel()
	}

	err = ch.flushEvents(flushCtx, messages)
	if err != nil {
		return fmt.Errorf("flush events: %w", err)
	}

	return nil
}

func (ch *ClickHouseSink) shutdownWithTimeout() error {
	ctx, cancel := context.WithTimeout(context.Background(), internal.SinkDefaultShutdownTimeout)
	defer cancel()
	return ch.handleShutdown(ctx)
}

func (ch *ClickHouseSink) handleShutdown(ctx context.Context) error {
	ch.log.InfoContext(ctx, "ClickHouse sink shutting down")

	messages, err := ch.fetchMessagesNoWait(ctx)
	if err != nil {
		if errors.Is(err, models.ErrNoNewMessages) {
			return nil
		}
		return fmt.Errorf("fetch pending messages: %w", err)
	}

	err = ch.flushEvents(ctx, messages)
	if err != nil {
		return fmt.Errorf("flush pending messages: %w", err)
	}

	return nil
}

func (ch *ClickHouseSink) fetchMessages(ctx context.Context, maxWait time.Duration) ([]jetstream.Msg, error) {
	msgBatch, err := ch.streamConsumer.Fetch(ch.sinkConfig.Batch.MaxBatchSize, jetstream.FetchMaxWait(maxWait))
	if err != nil {
		return nil, fmt.Errorf("failed to fetch messages: %w", err)
	}
	return ch.collectMessagesFromBatch(ctx, msgBatch)
}

func (ch *ClickHouseSink) fetchMessagesNoWait(ctx context.Context) ([]jetstream.Msg, error) {
	msgBatch, err := ch.streamConsumer.FetchNoWait(ch.sinkConfig.Batch.MaxBatchSize)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch messages: %w", err)
	}
	return ch.collectMessagesFromBatch(ctx, msgBatch)
}

func (ch *ClickHouseSink) collectMessagesFromBatch(ctx context.Context, msgBatch jetstream.MessageBatch) ([]jetstream.Msg, error) {
	messages := make([]jetstream.Msg, 0, ch.sinkConfig.Batch.MaxBatchSize)
	msgChan := msgBatch.Messages()

	for {
		select {
		case <-ctx.Done():
			// Context cancelled, return what we have
		case msg, ok := <-msgChan:
			if ok && msg != nil {
				messages = append(messages, msg)
				continue
			}
		}
		break
	}

	if len(messages) == 0 {
		return nil, models.ErrNoNewMessages
	}
	if msgBatch.Error() != nil {
		return nil, fmt.Errorf("failed to fetch messages: %w", msgBatch.Error())
	}

	ch.log.DebugContext(ctx, "Successfully fetched batch from NATS",
		"message_count", len(messages),
		"max_batch_size", ch.sinkConfig.Batch.MaxBatchSize)

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
		return nil, fmt.Errorf("failed to create batch with query %s: %w", query, err)
	}

	for _, msg := range messages {
		var metadata *jetstream.MsgMetadata
		metadata, err = msg.Metadata()
		if err != nil {
			return nil, fmt.Errorf("failed to get message metadata: %w", err)
		}

		var values []any
		if ch.streamSourceID != "" {
			values, err = ch.schemaMapper.PrepareValuesStream(ch.streamSourceID, msg.Data())
		} else {
			values, err = ch.schemaMapper.PrepareValues(msg.Data())
		}
		if err != nil {
			return nil, fmt.Errorf("failed to prepare values for message: %w", err)
		}

		err = resultBatch.Append(metadata.Sequence.Stream, values...)
		if err != nil {
			if errors.Is(err, clickhouse.ErrAlreadyExists) {
				continue
			}
			return nil, fmt.Errorf("failed to append values to batch: %w", err)
		}
	}

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
