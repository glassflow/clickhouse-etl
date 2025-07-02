package storage

import (
	"context"
	"fmt"

	"github.com/nats-io/nats.go/jetstream"
)

type Storage struct {
	kv jetstream.KeyValue
}

func New(ctx context.Context, store string, js jetstream.JetStream) (*Storage, error) {
	//nolint: exhaustruct // optional config
	cfg := jetstream.KeyValueConfig{
		Bucket:      store,
		Description: "Store for all glassflow pipelines",
		Replicas:    0,
		Compression: true,
	}

	kv, err := js.CreateOrUpdateKeyValue(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("create pipeline store: %w", err)
	}

	return &Storage{kv}, nil
}
