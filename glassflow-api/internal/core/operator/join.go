package operator

import (
	"context"
	"fmt"
	"log/slog"
	"sync"

	"github.com/nats-io/nats.go/jetstream"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/kv"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/schema"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/stream"
)

type JoinExecutor interface {
	HandleLeftStreamEvents(context.Context, jetstream.Msg) error
	HandleRightStreamEvents(context.Context, jetstream.Msg) error
}

type JoinOperator struct {
	leftStreamConsumer  *stream.Consumer
	rightStreamConsumer *stream.Consumer
	exector             JoinExecutor
	mu                  sync.Mutex
	handleMu            sync.Mutex
	isClosed            bool
	log                 *slog.Logger
}

func NewJoinOperator(
	leftStreamConsumer, rightStreamConsumer *stream.Consumer,
	resultsPublisher *stream.Publisher,
	schema *schema.Mapper,
	leftKVStore, rightKVStore *kv.NATSKeyValueStore,
	leftStreamName, rightStreamName string,
	log *slog.Logger,
) *JoinOperator {
	executor := NewTemporalJoinExecutor(
		resultsPublisher,
		schema,
		leftKVStore, rightKVStore,
		leftStreamName, rightStreamName,
		log,
	)
	return &JoinOperator{
		leftStreamConsumer:  leftStreamConsumer,
		rightStreamConsumer: rightStreamConsumer,
		exector:             executor,
		mu:                  sync.Mutex{},
		handleMu:            sync.Mutex{},
		isClosed:            false,
		log:                 log,
	}
}

func (j *JoinOperator) Start(ctx context.Context, errChan chan<- error) {
	j.log.Info("Join operator started")

	err := j.leftStreamConsumer.Subscribe(func(msg jetstream.Msg) {
		j.handleMu.Lock()
		defer j.handleMu.Unlock()
		err := j.exector.HandleLeftStreamEvents(ctx, msg)
		if err != nil {
			j.log.Error("failed to handle left stream event", slog.Any("error", err))
			return
		}
		err = msg.Ack()
		if err != nil {
			j.log.Error("failed to ack left stream message", slog.Any("error", err))
		}
	})
	if err != nil {
		errChan <- fmt.Errorf("failed to start left stream consumer: %w", err)
		return
	}

	err = j.rightStreamConsumer.Subscribe(func(msg jetstream.Msg) {
		j.handleMu.Lock()
		defer j.handleMu.Unlock()
		err := j.exector.HandleRightStreamEvents(ctx, msg)
		if err != nil {
			j.log.Error("failed to handle right stream event", slog.Any("error", err))
			return
		}
		err = msg.Ack()
		if err != nil {
			j.log.Error("failed to ack right stream message", slog.Any("error", err))
		}
	})
	if err != nil {
		errChan <- fmt.Errorf("failed to start right stream consumer: %w", err)
	}
}

func (j *JoinOperator) Stop() {
	j.mu.Lock()
	defer j.mu.Unlock()
	if j.isClosed {
		j.log.Debug("Join operator is already stopped.")
		return
	}

	j.log.Info("Stopping Join operator ...")
	j.leftStreamConsumer.Unsubscribe()
	j.rightStreamConsumer.Unsubscribe()
	j.isClosed = true
	j.log.Debug("Join operator stopped")
}
