package badger

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/dgraph-io/badger/v4"
	"github.com/nats-io/nats.go"
)

type Deduplicator struct {
	db  *badger.DB
	ttl time.Duration
}

func NewDeduplicator(db *badger.DB, ttl time.Duration) *Deduplicator {
	return &Deduplicator{
		db:  db,
		ttl: ttl,
	}
}

// Deduplicate filters out messages that have already been seen
func (d *Deduplicator) Deduplicate(
	ctx context.Context,
	messages []*nats.Msg,
	sendBatch func(ctx context.Context, messages []*nats.Msg) error,
) error {
	if len(messages) == 0 {
		return nil
	}

	err := d.db.Update(func(txn *badger.Txn) error {
		deduplicatedMessages, err := d.deduplicateMessages(ctx, txn, messages)
		if err != nil {
			return fmt.Errorf("deduplicate messages: %w", err)
		}

		err = sendBatch(ctx, deduplicatedMessages)
		if err != nil {
			return fmt.Errorf("send batch: %w", err)
		}

		return nil
	})
	if err != nil {
		return fmt.Errorf("deduplication transaction failed: %w", err)
	}

	return nil
}

func (d *Deduplicator) deduplicateMessages(
	ctx context.Context,
	txn *badger.Txn,
	messages []*nats.Msg,
) ([]*nats.Msg, error) {
	deduplicatedMessages := make([]*nats.Msg, 0, len(messages))
	for _, msg := range messages {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		default:
		}

		// Get the Nats-Msg-Id header set by the ingestor
		msgID := msg.Header.Get("Nats-Msg-Id")
		if msgID == "" {
			deduplicatedMessages = append(deduplicatedMessages, msg)
			continue
		}

		key := []byte(msgID)

		_, err := txn.Get(key)
		if err != nil && !errors.Is(err, badger.ErrKeyNotFound) {
			return nil, fmt.Errorf("failed to check key existence: %w", err)
		}

		// If key exists (no error), it's a duplicate - skip it
		if err == nil {
			continue
		}

		deduplicatedMessages = append(deduplicatedMessages, msg)

		entry := badger.NewEntry(key, []byte{1}).WithTTL(d.ttl)
		if err := txn.SetEntry(entry); err != nil {
			return nil, fmt.Errorf("failed to set entry: %w", err)
		}
	}

	return deduplicatedMessages, nil
}
