package kv

import (
	"context"
	"fmt"
	"time"

	"github.com/nats-io/nats.go/jetstream"
)

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

func (k *NATSKeyValueStore) Put(ctx context.Context, key any, value []byte) error {
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

func (k *NATSKeyValueStore) Get(ctx context.Context, key any) ([]byte, error) {
	item, err := k.KVstore.Get(ctx, fmt.Sprintf("%v", key))
	if err != nil {
		return nil, fmt.Errorf("failed to get value from KeyValue store: %w", err)
	}
	return item.Value(), nil
}

func (k *NATSKeyValueStore) Delete(ctx context.Context, key any) error {
	err := k.KVstore.Delete(ctx, fmt.Sprintf("%v", key))
	if err != nil {
		return fmt.Errorf("failed to delete value from KeyValue store: %w", err)
	}
	return nil
}
