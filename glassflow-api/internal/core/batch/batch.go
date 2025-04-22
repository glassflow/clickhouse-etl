package batch

import (
	"context"
	"errors"
	"fmt"

	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
)

var ErrAlreadyExists = errors.New("already exists")

type DBClient interface {
	PrepareBatch(ctx context.Context, query string) (driver.Batch, error)
}

type Batch struct {
	client       DBClient
	query        string
	currentBatch driver.Batch
	cache        map[uint64]struct{}
}

func New(ctx context.Context, chClient DBClient, query string) (*Batch, error) {
	b := &Batch{
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

func (b *Batch) Reload(ctx context.Context) error {
	batch, err := b.client.PrepareBatch(ctx, b.query)
	if err != nil {
		return fmt.Errorf("failed to create batch: %w", err)
	}

	b.currentBatch = batch

	return nil
}

func (b *Batch) Size() int {
	return len(b.cache)
}

func (b *Batch) Append(id uint64, data ...any) error {
	if _, ok := b.cache[id]; ok {
		return ErrAlreadyExists //nolint:wrapcheck //custom error usage
	}

	b.cache[id] = struct{}{}

	err := b.currentBatch.Append(data...)
	if err != nil {
		return fmt.Errorf("append failed: %w", err)
	}

	return nil
}

func (b *Batch) Send(ctx context.Context) error {
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
