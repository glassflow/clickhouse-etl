package join

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strings"

	"github.com/google/uuid"
	"github.com/nats-io/nats.go/jetstream"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/configs"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/kv"
	schemav2 "github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/schema_v2"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/stream"
)

type TemporalJoinExecutor struct {
	resultsPublisher stream.Publisher
	leftSchema       *schemav2.Schema
	rightSchema      *schemav2.Schema
	cfgStore         configs.ConfigStoreInterface
	leftKVStore      kv.KeyValueStore
	rightKVStore     kv.KeyValueStore
	leftSourceName   string
	rightSourceName  string
	leftKey          string
	rightKey         string
	log              *slog.Logger
}

func NewTemporalJoinExecutor(
	resultsPublisher stream.Publisher,
	leftSchema, rightSchema *schemav2.Schema,
	cfgStore configs.ConfigStoreInterface,
	leftKVStore, rightKVStore kv.KeyValueStore,
	leftSourceName, rightSourceName, leftKey, rightKey string,
	log *slog.Logger,
) *TemporalJoinExecutor {
	return &TemporalJoinExecutor{
		resultsPublisher: resultsPublisher,
		leftSchema:       leftSchema,
		rightSchema:      rightSchema,
		cfgStore:         cfgStore,
		leftKVStore:      leftKVStore,
		rightKVStore:     rightKVStore,
		leftSourceName:   leftSourceName,
		rightSourceName:  rightSourceName,
		leftKey:          leftKey,
		rightKey:         rightKey,
		log:              log,
	}
}

func (t *TemporalJoinExecutor) storeToLeftStreamBuffer(ctx context.Context, key any, schemaVersionID string, value []byte) error {
	keys := ""
	keys, err := t.leftKVStore.GetString(ctx, key)
	if err != nil {
		if !errors.Is(err, jetstream.ErrKeyNotFound) {
			t.log.ErrorContext(ctx, "failed to get left stream data", "key", key, "error", err)
			return fmt.Errorf("failed to get left stream data: %w", err)
		}
	}

	uuidKey := uuid.New().String()
	err = t.leftKVStore.PutMessage(ctx, uuidKey, schemaVersionID, value)
	if err != nil {
		t.log.ErrorContext(ctx, "failed to store left stream data", "uuid_key", uuidKey, "error", err)
		return fmt.Errorf("failed to store left stream data: %w", err)
	}

	if keys != "" {
		keys += " "
	}

	err = t.leftKVStore.PutString(ctx, key, keys+uuidKey)
	if err != nil {
		t.log.ErrorContext(ctx, "failed to put left stream data in KV store", "key", key, "keys", keys+uuidKey, "error", err)
		return fmt.Errorf("failed to put left stream data in KV store: %w", err)
	}

	return nil
}

func (t *TemporalJoinExecutor) getFromleftStreamBuffer(ctx context.Context, key any, rightSchemaVersionID string, rightStreamData []byte) error {
	rawUUIDs, err := t.leftKVStore.GetString(ctx, key)
	if err != nil {
		if !errors.Is(err, jetstream.ErrKeyNotFound) {
			t.log.ErrorContext(ctx, "failed to get left stream data", "key", key, "error", err)
			return fmt.Errorf("failed to get left stream data: %w", err)
		}
		return nil
	}

	uuids := strings.Split(rawUUIDs, " ")
	if len(uuids) == 0 {
		t.log.DebugContext(ctx, "no left stream data found for the key", "key", fmt.Sprintf("%v", key))
		return nil
	}

	// Split the keys by space
	for _, uuidKey := range uuids {
		if uuidKey == "" {
			continue
		}
		leftSchemaVersionID, leftStreamData, err := t.leftKVStore.GetMessage(ctx, uuidKey)
		if err != nil {
			if !errors.Is(err, jetstream.ErrKeyNotFound) {
				t.log.ErrorContext(ctx, "failed to get left stream data with key", "uuid_key", uuidKey, "error", err)
				return fmt.Errorf("failed to get left stream data with key %s: %w", uuidKey, err)
			}
			continue
		}

		config, err := t.cfgStore.GetJoinConfig(ctx, t.leftSourceName, leftSchemaVersionID, t.rightSourceName, rightSchemaVersionID)
		if err != nil {
			return fmt.Errorf("failed to get join config: %w", err)
		}

		msg, err := buildJoinedMessage(
			t.resultsPublisher.GetSubject(),
			t.leftSourceName, leftStreamData,
			t.rightSourceName, rightStreamData,
			config,
		)
		if err != nil {
			return fmt.Errorf("failed to join data: %w", err)
		}

		err = t.resultsPublisher.PublishNatsMsg(ctx, msg)
		if err != nil {
			t.log.ErrorContext(ctx, "failed to publish joined data", "left_source", t.leftSourceName, "right_source", t.rightSourceName, "error", err)
			return fmt.Errorf("failed to publish joined data: %w", err)
		}

		err = t.leftKVStore.Delete(ctx, uuidKey)
		if err != nil {
			t.log.ErrorContext(ctx, "failed to delete left stream data with key", "uuid_key", uuidKey, "error", err)
			return fmt.Errorf("failed to delete left stream data with key %s: %w", uuidKey, err)
		}
	}

	err = t.leftKVStore.Delete(ctx, key)
	if err != nil {
		t.log.ErrorContext(ctx, "failed to delete key data from left KV store", "error", err, "key", fmt.Sprintf("%v", key))
	}

	return nil
}

func (t *TemporalJoinExecutor) HandleLeftStreamEvents(ctx context.Context, msg jetstream.Msg) error {
	data := msg.Data()

	leftSchemaVersionID := msg.Headers().Get(internal.SchemaVersionIDHeader)

	key, err := t.leftSchema.Get(ctx, leftSchemaVersionID, t.leftKey, data)
	if err != nil {
		t.log.ErrorContext(ctx, "failed to get join key from left stream message", "left_source", t.leftSourceName, "error", err)
		return fmt.Errorf("failed to get join key from left stream message: %w", err)
	}

	rightSchemaVersionID, rightData, err := t.rightKVStore.GetMessage(ctx, key)
	if err != nil {
		if !errors.Is(err, jetstream.ErrKeyNotFound) {
			t.log.ErrorContext(ctx, "failed to get right stream message from KV store", "key", key, "error", err)
			return fmt.Errorf("failed to get right stream message from KV store: %w", err)
		}

		// key not yet found in the right stream, store the left data
		err = t.storeToLeftStreamBuffer(ctx, key, msg.Headers().Get(internal.SchemaVersionIDHeader), data)
		if err != nil {
			t.log.ErrorContext(ctx, "failed to put left stream message in KV store", "key", key, "error", err)
			return fmt.Errorf("failed to put left stream message in KV store: %w", err)
		}

		return nil
	}

	config, err := t.cfgStore.GetJoinConfig(ctx, t.leftSourceName, leftSchemaVersionID, t.rightSourceName, rightSchemaVersionID)
	if err != nil {
		return fmt.Errorf("failed to get join config: %w", err)
	}

	outputMsg, err := buildJoinedMessage(
		t.resultsPublisher.GetSubject(),
		t.leftSourceName, data,
		t.rightSourceName, rightData,
		config,
	)
	if err != nil {
		return fmt.Errorf("failed to join data: %w", err)
	}

	err = t.resultsPublisher.PublishNatsMsg(ctx, outputMsg)
	if err != nil {
		t.log.ErrorContext(ctx, "failed to publish joined data", "error", err)
	}

	return nil
}

func (t *TemporalJoinExecutor) HandleRightStreamEvents(ctx context.Context, msg jetstream.Msg) error {
	data := msg.Data()

	schemaVersionID := msg.Headers().Get(internal.SchemaVersionIDHeader)

	key, err := t.rightSchema.Get(ctx, schemaVersionID, t.rightKey, data)
	if err != nil {
		t.log.ErrorContext(ctx, "failed to get join key from right stream message", "right_stream", t.rightSourceName, "schema_version_id", schemaVersionID, "error", err)
		return fmt.Errorf("failed to get join key from right stream message: %w", err)
	}

	err = t.rightKVStore.PutMessage(ctx, key, schemaVersionID, data)
	if err != nil {
		t.log.ErrorContext(ctx, "failed to put right stream message in KV store", "key", key, "error", err)
		return fmt.Errorf("failed to put right stream message in KV store: %w", err)
	}

	err = t.getFromleftStreamBuffer(ctx, key, schemaVersionID, data)
	if err != nil {
		t.log.ErrorContext(ctx, "failed to get left stream data from buffer", "key", key, "error", err)
		return fmt.Errorf("failed to get left stream data from buffer: %w", err)
	}

	return nil
}
