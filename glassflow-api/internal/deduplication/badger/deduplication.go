package badger

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/dgraph-io/badger/v4"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

type Deduplicator struct {
	db  *badger.DB
	ttl time.Duration
}

func NewDeduplicator(
	db *badger.DB,
	ttl time.Duration,
) *Deduplicator {
	return &Deduplicator{
		db:  db,
		ttl: ttl,
	}
}

// FilterDuplicates returns only messages that haven't been seen before (read-only check)
func (d *Deduplicator) FilterDuplicates(
	ctx context.Context,
	messages []models.Message,
) ([]models.Message, error) {
	if len(messages) == 0 {
		return nil, nil
	}

	var filtered []models.Message
	err := d.db.View(func(txn *badger.Txn) error {
		filtered = make([]models.Message, 0, len(messages))
		for _, msg := range messages {
			select {
			case <-ctx.Done():
				return ctx.Err()
			default:
			}

			msgID := msg.GetHeader("Nats-Msg-Id")
			if msgID == "" {
				filtered = append(filtered, msg)
				continue
			}

			_, err := txn.Get([]byte(msgID))
			if err != nil && !errors.Is(err, badger.ErrKeyNotFound) {
				return fmt.Errorf("failed to check key: %w", err)
			}

			// Key not found means not a duplicate
			if errors.Is(err, badger.ErrKeyNotFound) {
				filtered = append(filtered, msg)
			}
		}

		return nil
	})
	if err != nil {
		return nil, err
	}

	return filtered, nil
}

// SaveKeys marks message IDs as seen with TTL
func (d *Deduplicator) SaveKeys(
	ctx context.Context,
	messages []models.Message,
) error {
	if len(messages) == 0 {
		return nil
	}

	return d.db.Update(func(txn *badger.Txn) error {
		for _, msg := range messages {
			select {
			case <-ctx.Done():
				return ctx.Err()
			default:
			}

			msgID := msg.GetHeader("Nats-Msg-Id")
			if msgID == "" {
				continue
			}

			entry := badger.NewEntry([]byte(msgID), []byte{}).WithTTL(d.ttl)
			if err := txn.SetEntry(entry); err != nil {
				return fmt.Errorf("failed to set entry: %w", err)
			}
		}
		return nil
	})
}
