package operator

import (
	"context"
	"errors"
	"fmt"
	"log/slog"

	"github.com/nats-io/nats.go/jetstream"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/kv"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/schema"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/stream"
)

type JoinOperator struct {
	leftStreamConsumer  *stream.Consumer
	rightStreamConsumer *stream.Consumer
	resultsPublisher    *stream.Publisher
	schema              *schema.Mapper
	leftKVStore         *kv.NATSKeyValueStore
	rightKVStore        *kv.NATSKeyValueStore
	leftStreamName      string
	rightStreamName     string
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
	return &JoinOperator{
		leftStreamConsumer:  leftStreamConsumer,
		rightStreamConsumer: rightStreamConsumer,
		resultsPublisher:    resultsPublisher,
		leftKVStore:         leftKVStore,
		rightKVStore:        rightKVStore,
		leftStreamName:      leftStreamName,
		rightStreamName:     rightStreamName,
		schema:              schema,
		log:                 log,
	}
}

func (j *JoinOperator) handleRightStreamEvents(ctx context.Context, msg jetstream.Msg) error {
	data := msg.Data()

	key, err := j.schema.GetJoinKey(j.rightStreamName, data)
	if err != nil {
		return fmt.Errorf("failed to get join key from right stream message %w", err)
	}

	err = j.rightKVStore.Put(ctx, key, data)
	if err != nil {
		return fmt.Errorf("failed to put right stream message in KV store %w", err)
	}

	// ack the message
	err = msg.Ack()
	if err != nil {
		return fmt.Errorf("failed to ack right stream message %w", err)
	}

	leftData, err := j.leftKVStore.Get(ctx, key)
	if err != nil {
		if !errors.Is(err, jetstream.ErrKeyNotFound) {
			j.log.Error("failed to get left stream message from KV store", slog.Any("error", err))
		}
	}

	err = j.leftKVStore.Delete(ctx, key)
	if err != nil {
		return fmt.Errorf("failed to delete left stream message from KV store %w", err)
	}

	joinedData, err := j.schema.JoinData(j.leftStreamName, leftData, j.rightStreamName, data)
	if err != nil {
		return fmt.Errorf("failed to join data %w", err)
	}

	err = j.resultsPublisher.Publish(ctx, joinedData)
	if err != nil {
		return fmt.Errorf("failed to publish joined data %w", err)
	}

	return nil
}

func (j *JoinOperator) handleLeftStreamEvents(ctx context.Context, msg jetstream.Msg) error {
	data := msg.Data()

	key, err := j.schema.GetJoinKey(j.leftStreamName, data)
	if err != nil {
		return fmt.Errorf("failed to get join key from left stream message %w", err)
	}

	rightData, err := j.rightKVStore.Get(ctx, key)
	if err != nil {
		if !errors.Is(err, jetstream.ErrKeyNotFound) {
			j.log.Error("failed to get right stream message from KV store", slog.Any("error", err))
		}

		// key not yet found in the right stream, store the left data
		err = j.leftKVStore.Put(ctx, key, data)
		if err != nil {
			return fmt.Errorf("failed to put left stream message in KV store %w", err)
		}
		err = msg.Ack()
		if err != nil {
			return fmt.Errorf("failed to ack left stream message %w", err)
		}

		return nil
	}

	joinedData, err := j.schema.JoinData(j.leftStreamName, data, j.rightStreamName, rightData)
	if err != nil {
		return fmt.Errorf("failed to join data %w", err)
	}

	err = j.resultsPublisher.Publish(ctx, joinedData)
	if err != nil {
		j.log.Error("failed to publish joined data", slog.Any("error", err))
	}

	// ack the message
	err = msg.Ack()
	if err != nil {
		return fmt.Errorf("failed to ack left stream message %w", err)
	}

	return nil
}

func (j *JoinOperator) Start(ctx context.Context) error {
	j.log.Info("Join operator started")

	err := j.leftStreamConsumer.Subscribe(func(msg jetstream.Msg) {
		err := j.handleLeftStreamEvents(ctx, msg)
		if err != nil {
			j.log.Error("failed to handle left stream event", slog.Any("error", err))
			// Stop the consumer if an error occurs
			j.Stop()
			return
		}
		err = msg.Ack()
		if err != nil {
			j.log.Error("failed to ack left stream message", slog.Any("error", err))
		}
	})
	if err != nil {
		return fmt.Errorf("failed to start left stream consumer: %w", err)
	}

	err = j.rightStreamConsumer.Subscribe(func(msg jetstream.Msg) {
		err := j.handleRightStreamEvents(ctx, msg)
		if err != nil {
			j.log.Error("failed to handle right stream event", slog.Any("error", err))
			// Stop the consumer if an error occurs
			j.Stop()
			return
		}
	})
	if err != nil {
		return fmt.Errorf("failed to start right stream consumer: %w", err)
	}

	j.log.Info("Join operator stopped")
	return nil
}

func (j *JoinOperator) Stop() {
	j.log.Info("Stopping Join operator ...")
	j.leftStreamConsumer.Unsubscribe()
	j.rightStreamConsumer.Unsubscribe()
	j.log.Info("Join operator stopped")
}
