package service

import (
	"context"
	"fmt"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

type DLQ interface {
	ConsumeDLQ(ctx context.Context, pid string, batchSize models.DLQBatchSize) ([]models.DLQMessage, error)
	GetDLQState(ctx context.Context, pid string) (zero models.DLQState, _ error)
}

type DLQClient interface {
	FetchDLQMessages(ctx context.Context, stream string, batchSize int) ([]models.DLQMessage, error)
	GetDLQState(ctx context.Context, stream string) (models.DLQState, error)
}

type DLQImpl struct {
	client DLQClient
}

func NewDLQImpl(dlqClient DLQClient) *DLQImpl {
	return &DLQImpl{dlqClient}
}

var (
	ErrDLQNotExists    = fmt.Errorf("dlq does not exist")
	ErrNoMessagesInDLQ = fmt.Errorf("no content")
)

// WARNING: bad design choice since the api request can fail and the
// acknowledged messages will be lost. Only a dirty solution for now,
// must be changed to a streaming API in future
func (d *DLQImpl) ConsumeDLQ(ctx context.Context, pid string, batchSize models.DLQBatchSize) ([]models.DLQMessage, error) {
	dlqStream := models.GetDLQStreamName(pid)

	batch, err := d.client.FetchDLQMessages(ctx, dlqStream, batchSize.Int)
	if err != nil {
		return nil, fmt.Errorf("consume dlq: %w", err)
	}

	if len(batch) == 0 {
		return nil, ErrNoMessagesInDLQ
	}

	return batch, nil
}

func (d *DLQImpl) GetDLQState(ctx context.Context, pid string) (zero models.DLQState, _ error) {
	dlqStream := models.GetDLQStreamName(pid)

	state, err := d.client.GetDLQState(ctx, dlqStream)
	if err != nil {
		return zero, fmt.Errorf("get dlq state: %w", err)
	}

	return state, nil
}
