package join

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strings"

	"github.com/google/uuid"
	"github.com/nats-io/nats.go/jetstream"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/kv"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/schema"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/stream"
)

type TemporalJoinExecutor struct {
	resultsPublisher stream.Publisher
	leftKVStore      kv.KeyValueStore
	rightKVStore     kv.KeyValueStore
	leftStreamName   string
	rightStreamName  string
	schema           schema.Mapper
	log              *slog.Logger
}

func NewTemporalJoinExecutor(
	resultsPublisher stream.Publisher,
	schema schema.Mapper,
	leftKVStore, rightKVStore kv.KeyValueStore,
	leftStreamName, rightStreamName string,
	log *slog.Logger,
) *TemporalJoinExecutor {
	return &TemporalJoinExecutor{
		resultsPublisher: resultsPublisher,
		leftKVStore:      leftKVStore,
		rightKVStore:     rightKVStore,
		leftStreamName:   leftStreamName,
		rightStreamName:  rightStreamName,
		schema:           schema,
		log:              log,
	}
}

func (t *TemporalJoinExecutor) storeToLeftStreamBuffer(ctx context.Context, key any, value []byte) error {
	keys := ""
	byteKeys, err := t.leftKVStore.Get(ctx, key)
	if err != nil {
		if !errors.Is(err, jetstream.ErrKeyNotFound) {
			return fmt.Errorf("failed to get left stream data: %w", err)
		}
	} else {
		keys = string(byteKeys)
	}

	uuidKey := uuid.New().String()
	err = t.leftKVStore.Put(ctx, uuidKey, value)
	if err != nil {
		return fmt.Errorf("failed to store left stream data: %w", err)
	}

	if keys != "" {
		keys += " "
	}

	err = t.leftKVStore.PutString(ctx, key, keys+uuidKey)
	if err != nil {
		return fmt.Errorf("failed to put left stream data in KV store: %w", err)
	}

	return nil
}

func (t *TemporalJoinExecutor) getFromleftStreamBuffer(ctx context.Context, key any, rightStreamData []byte) error {
	rawUUIDs, err := t.leftKVStore.Get(ctx, key)
	if err != nil {
		if !errors.Is(err, jetstream.ErrKeyNotFound) {
			return fmt.Errorf("failed to get left stream data: %w", err)
		}
		return nil
	}

	uuids := strings.Split(string(rawUUIDs), " ")
	if len(uuids) == 0 {
		t.log.Debug("no left stream data found for the key", slog.String("key", fmt.Sprintf("%v", key)))
		return nil
	}

	// Split the keys by space
	for _, uuidKey := range uuids {
		if uuidKey == "" {
			continue
		}
		leftStreamData, err := t.leftKVStore.Get(ctx, uuidKey)
		if err != nil {
			if !errors.Is(err, jetstream.ErrKeyNotFound) {
				return fmt.Errorf("failed to get left stream data with key %s: %w", uuidKey, err)
			}
			continue
		}

		joinedData, err := t.schema.JoinData(t.leftStreamName, leftStreamData, t.rightStreamName, rightStreamData)
		if err != nil {
			return fmt.Errorf("failed to join data: %w", err)
		}

		err = t.resultsPublisher.Publish(ctx, joinedData)
		if err != nil {
			return fmt.Errorf("failed to publish joined data: %w", err)
		}

		err = t.leftKVStore.Delete(ctx, uuidKey)
		if err != nil {
			return fmt.Errorf("failed to delete left stream data with key %s: %w", uuidKey, err)
		}
	}

	err = t.leftKVStore.Delete(ctx, key)
	if err != nil {
		t.log.Error("failed to delete key data from left KV store", slog.Any("error", err), slog.String("key", fmt.Sprintf("%v", key)))
	}

	return nil
}

func (t *TemporalJoinExecutor) HandleLeftStreamEvents(ctx context.Context, msg jetstream.Msg) error {
	data := msg.Data()
	key, err := t.schema.GetJoinKey(t.leftStreamName, data)
	if err != nil {
		return fmt.Errorf("failed to get join key from left stream message: %w", err)
	}

	rightData, err := t.rightKVStore.Get(ctx, key)
	if err != nil {
		if !errors.Is(err, jetstream.ErrKeyNotFound) {
			return fmt.Errorf("failed to get right stream message from KV store: %w", err)
		}

		// key not yet found in the right stream, store the left data
		err = t.storeToLeftStreamBuffer(ctx, key, data)
		if err != nil {
			return fmt.Errorf("failed to put left stream message in KV store: %w", err)
		}

		return nil
	}

	joinedData, err := t.schema.JoinData(t.leftStreamName, data, t.rightStreamName, rightData)
	if err != nil {
		return fmt.Errorf("failed to join data: %w", err)
	}

	err = t.resultsPublisher.Publish(ctx, joinedData)
	if err != nil {
		t.log.Error("failed to publish joined data", slog.Any("error", err))
	}

	return nil
}

func (t *TemporalJoinExecutor) HandleRightStreamEvents(ctx context.Context, msg jetstream.Msg) error {
	data := msg.Data()

	key, err := t.schema.GetJoinKey(t.rightStreamName, data)
	if err != nil {
		return fmt.Errorf("failed to get join key from right stream message: %w", err)
	}

	err = t.rightKVStore.Put(ctx, key, data)
	if err != nil {
		return fmt.Errorf("failed to put right stream message in KV store: %w", err)
	}

	err = t.getFromleftStreamBuffer(ctx, key, data)
	if err != nil {
		return fmt.Errorf("failed to get left stream data from buffer: %w", err)
	}

	return nil
}
