package kv

import (
	"context"
	"encoding/binary"
	"fmt"
	"strconv"
	"time"

	"github.com/nats-io/nats.go/jetstream"
)

type KeyValueStore interface {
	PutString(ctx context.Context, key any, value string) error
	PutMessage(ctx context.Context, key any, schemaVersionID string, data []byte) error
	GetString(ctx context.Context, key any) (string, error)
	GetMessage(ctx context.Context, key any) (schemaVersionID string, data []byte, err error)
	Delete(ctx context.Context, key any) error
}

type KeyValueStoreConfig struct {
	StoreName string
	TTL       time.Duration
}

type NATSKeyValueStore struct {
	KVstore jetstream.KeyValue
}

func NewNATSKeyValueStore(ctx context.Context, js jetstream.JetStream, cfg KeyValueStoreConfig) (*NATSKeyValueStore, error) {
	kv, err := js.CreateOrUpdateKeyValue(ctx, jetstream.KeyValueConfig{ //nolint:exhaustruct // optional config
		Bucket: cfg.StoreName,
		TTL:    cfg.TTL,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get KeyValue store: %w", err)
	}

	return &NATSKeyValueStore{
		KVstore: kv,
	}, nil
}

func (k *NATSKeyValueStore) put(ctx context.Context, key any, value []byte) error {
	_, err := k.KVstore.Put(ctx, fmt.Sprintf("%v", key), value)
	if err != nil {
		return fmt.Errorf("failed to put value in KeyValue store: %w", err)
	}

	return nil
}

func (k *NATSKeyValueStore) PutString(ctx context.Context, key any, value string) error {
	_, err := k.KVstore.PutString(ctx, fmt.Sprintf("%v", key), value)
	if err != nil {
		return fmt.Errorf("failed to put string in KeyValue store: %w", err)
	}

	return nil
}

// PutMessage stores data with schema version prefix using wire format: [0x00][4-byte version][data]
func (k *NATSKeyValueStore) PutMessage(ctx context.Context, key any, schemaVersionID string, data []byte) error {
	version, err := strconv.Atoi(schemaVersionID)
	if err != nil {
		return fmt.Errorf("invalid schema version ID %q: %w", schemaVersionID, err)
	}

	value := make([]byte, 5+len(data))
	value[0] = 0x00 // magic byte
	binary.BigEndian.PutUint32(value[1:5], uint32(version))
	copy(value[5:], data)

	return k.put(ctx, key, value)
}

func (k *NATSKeyValueStore) get(ctx context.Context, key any) ([]byte, error) {
	item, err := k.KVstore.Get(ctx, fmt.Sprintf("%v", key))
	if err != nil {
		return nil, fmt.Errorf("failed to get value from KeyValue store: %w", err)
	}

	return item.Value(), nil
}

func (k *NATSKeyValueStore) GetString(ctx context.Context, key any) (string, error) {
	value, err := k.get(ctx, key)
	if err != nil {
		return "", err
	}

	return string(value), nil
}

// GetMessage retrieves data with schema version from wire format: [0x00][4-byte version][data]
func (k *NATSKeyValueStore) GetMessage(ctx context.Context, key any) (schemaVersionID string, data []byte, err error) {
	value, err := k.get(ctx, key)
	if err != nil {
		return "", nil, err
	}

	if len(value) < 5 {
		return "", nil, fmt.Errorf("invalid stored message: too short")
	}

	if value[0] != 0x00 {
		return "", nil, fmt.Errorf("invalid magic byte: expected 0x00, got 0x%02x", value[0])
	}

	version := int(binary.BigEndian.Uint32(value[1:5]))
	schemaVersionID = strconv.Itoa(version)
	data = value[5:]

	return schemaVersionID, data, nil
}

func (k *NATSKeyValueStore) Delete(ctx context.Context, key any) error {
	err := k.KVstore.Delete(ctx, fmt.Sprintf("%v", key))
	if err != nil {
		return fmt.Errorf("failed to delete value from KeyValue store: %w", err)
	}

	return nil
}
