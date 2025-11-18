package ingestor

import (
	"context"
	"errors"
	"fmt"
	"hash/fnv"
	"time"

	"github.com/nats-io/nats.go"
	"github.com/nats-io/nats.go/jetstream"
)

const (
	numOfBuckets = 1024
)

func getBucket(id string, numBuckets int) int {
	h := fnv.New32a()
	h.Write([]byte(id))
	return int(h.Sum32() % uint32(numBuckets))
}

func (k *KafkaMsgProcessor) Duplicate(
	ctx context.Context,
	msgData []byte,
	dedupKey string,
) (bool, error) {
	keyValue, err := k.schemaMapper.GetKey(k.topic.Name, dedupKey, msgData)
	if err != nil {
		return false, fmt.Errorf("failed to get deduplication key: %w", err)
	}

	if keyValue == nil {
		return false, fmt.Errorf("deduplication key is nil for topic %s", k.topic.Name)
	}

	strKey := fmt.Sprintf("%v", keyValue)
	bucketName := fmt.Sprintf("%s_%d", k.topic.Name, getBucket(strKey, numOfBuckets)) // Fixed

	var kv jetstream.KeyValue
	kv, err = k.js.KeyValue(ctx, bucketName)
	if err != nil {
		if !errors.Is(err, nats.ErrBucketNotFound) {
			return false, fmt.Errorf("failed to get key-value bucket: %w", err)
		}

		kv, err = k.js.CreateKeyValue(ctx, jetstream.KeyValueConfig{
			Bucket: bucketName,
			TTL:    time.Hour * 24,
		})
		if err != nil {
			return false, fmt.Errorf("failed to create deduplication kv: %w", err)
		}
	}

	_, err = kv.Get(ctx, strKey)
	if err != nil {
		if !errors.Is(err, jetstream.ErrKeyNotFound) {
			return false, fmt.Errorf("failed to get deduplication key: %w", err)
		}

		// Key doesn't exist - write it
		_, err = kv.Put(ctx, strKey, []byte{})
		if err != nil {
			return false, fmt.Errorf("failed to put deduplication key: %w", err)
		}

		return false, nil // Not a duplicate
	}

	return true, nil
}
