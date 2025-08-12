package sink

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"sync"
	"time"

	"github.com/nats-io/nats.go"
	"github.com/nats-io/nats.go/jetstream"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/batch"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/client"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/schema"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/stream"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
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
}

func NewClickHouseSink(sinkCfg models.SinkOperatorConfig, streamCon stream.Consumer, schemaMapper schema.Mapper, log *slog.Logger) (*ClickHouseSink, error) {
	maxDelayTime := time.Duration(60) * time.Second
	if sinkCfg.Batch.MaxDelayTime.Duration() > 0 {
		maxDelayTime = sinkCfg.Batch.MaxDelayTime.Duration()
	}

	client, err := client.NewClickHouseClient(context.Background(), sinkCfg.ClickHouseConnectionParams)
	if err != nil {
		return nil, fmt.Errorf("failed to create clickhouse client: %w", err)
	}

	if sinkCfg.Batch.MaxBatchSize <= 0 {
		return nil, fmt.Errorf("max batch size must be greater than 0")
	}

	query := fmt.Sprintf("INSERT INTO %s.%s (%s)", client.GetDatabase(), client.GetTableName(), strings.Join(schemaMapper.GetOrderedColumns(), ", "))

	log.Debug("Insert query", slog.String("query", query))

	batch, err := batch.NewClickHouseBatch(context.Background(), client, query)
	if err != nil {
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
	}, nil
}

func (ch *ClickHouseSink) sendBatchAndAck(ctx context.Context) error {
	if ch.lastMsg == nil || ch.batch.Size() == 0 {
		ch.log.Debug("No messages to send")
		return nil
	}

	err := ch.batch.Send(ctx)
	if err != nil {
		return fmt.Errorf("failed to send the batch: %w", err)
	}
	ch.log.Debug("Batch sent to clickhouse")

	err = ch.lastMsg.Ack()
	if err != nil {
		return fmt.Errorf("failed to ack message: %w", err)
	}

	mdata, err := ch.lastMsg.Metadata()
	if err != nil {
		ch.log.Error("failed to get message metadata", slog.Any("error", err))
	} else {
		ch.log.Info("Message acked by JetStream", slog.Any("stream", mdata.Sequence.Stream))
	}

	ch.lastMsg = nil

	return nil
}

func (ch *ClickHouseSink) handleMsg(ctx context.Context, msg jetstream.Msg) error {
	mdata, err := msg.Metadata()
	if err != nil {
		return fmt.Errorf("failed to get message metadata: %w", err)
	}

	values, err := ch.schemaMapper.PrepareValues(msg.Data())
	if err != nil {
		return fmt.Errorf("failed to map data for ClickHouse: %w", err)
	}

	err = ch.batch.Append(mdata.Sequence.Stream, values...)
	if err != nil {
		return fmt.Errorf("failed to append values to the batch: %w", err)
	}

	ch.lastMsg = msg

	if ch.batch.Size() >= ch.maxBatchSize {
		err := ch.sendBatchAndAck(ctx)
		if err != nil {
			return fmt.Errorf("failed to send the batch and ack: %w", err)
		}
	}

	return nil
}

func (ch *ClickHouseSink) getMsg(ctx context.Context) error {
	msg, err := ch.streamCon.Next()
	switch {
	case errors.Is(err, nats.ErrTimeout):
		if ch.isClosed {
			ch.isInputDrained = true
		}
		return nil
	case err != nil:
		return fmt.Errorf("failed to get next message: %w", err)
	}

	err = ch.handleMsg(ctx, msg)
	if err != nil {
		if errors.Is(err, batch.ErrAlreadyExists) {
			return nil
		}
		return fmt.Errorf("failed to handle message: %w", err)
	}

	return nil
}

func (ch *ClickHouseSink) Start(ctx context.Context) error {
	ch.log.Info("ClickHouse sink started")
	defer ch.log.Info("ClickHouse sink stopped")
	defer ch.clearConn()

	ch.timer = time.NewTimer(ch.maxDelayTime)

	for {
		select {
		case <-ch.timer.C:
			err := ch.sendBatchAndAck(ctx)
			if err != nil {
				ch.log.Error("error on exporting data", slog.Any("error", err))
			}
			ch.timer.Reset(ch.maxDelayTime)
		default:
			err := ch.getMsg(ctx)
			if err != nil {
				ch.log.Error("error on exporting data", slog.Any("error", err))
				continue
			}
			if ch.isClosed && ch.isInputDrained {
				err := ch.sendBatchAndAck(ctx)
				if err != nil {
					return fmt.Errorf("failed to send the batch and ack: %w", err)
				}
				return nil
			}
		}
	}
}

func (ch *ClickHouseSink) clearConn() {
	err := ch.client.Close()
	if err != nil {
		ch.log.Error("failed to close ClickHouse client connection", slog.Any("error", err))
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
