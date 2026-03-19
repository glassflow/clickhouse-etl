package clickhouse

import (
	"context"
	"errors"
	"fmt"

	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/client"
)

var ErrAlreadyExists = errors.New("already exists")

type Batch interface {
	Reload(ctx context.Context) error
	Size() int
	Append(id uint64, data ...any) error
	Send(ctx context.Context) error
}

type ClickHouseBatch struct {
	client       client.DatabaseClient
	query        string
	currentBatch driver.Batch
	cache        map[uint64]struct{}
}

func NewClickHouseBatch(ctx context.Context, chClient client.DatabaseClient, query string) (Batch, error) {
	b := &ClickHouseBatch{
		client:       chClient,
		query:        query,
		currentBatch: nil,
		cache:        make(map[uint64]struct{}),
	}

	err := b.Reload(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to reload batch: %w", err)
	}

	return b, nil
}

func (b *ClickHouseBatch) Reload(ctx context.Context) error {
	batch, err := b.client.PrepareBatch(ctx, b.query)
	if err != nil {
		return fmt.Errorf("failed to create batch: %w", err)
	}

	b.currentBatch = batch

	return nil
}

func (b *ClickHouseBatch) Size() int {
	return len(b.cache)
}

func (b *ClickHouseBatch) Append(id uint64, data ...any) (err error) {
	if _, ok := b.cache[id]; ok {
		return ErrAlreadyExists //nolint:wrapcheck //custom error usage
	}

	b.cache[id] = struct{}{}
	defer func() {
		if recovered := recover(); recovered != nil {
			delete(b.cache, id)
			err = fmt.Errorf("append failed: %v", recovered)
		}
	}()

	err = b.currentBatch.Append(data...)
	if err != nil {
		delete(b.cache, id)
		return fmt.Errorf("append failed: %w", err)
	}

	return nil
}

func (b *ClickHouseBatch) Send(ctx context.Context) error {
	err := b.currentBatch.Send()
	if err != nil {
		return fmt.Errorf("failed to send the batch: %w", err)
	}

	err = b.Reload(ctx)
	if err != nil {
		return fmt.Errorf("failed to reload the batch: %w", err)
	}
	clear(b.cache)

	return nil
}
