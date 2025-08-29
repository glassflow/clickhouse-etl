package dlq

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/client"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/service"
	"github.com/nats-io/nats.go/jetstream"
)

type Client struct {
	js JetStreamClient
}

func NewClient(natsClient *client.NATSClient) *Client {
	return &Client{
		js: NewJetStreamAdapter(natsClient.JetStream()),
	}
}

// create common config for a durable consumer per pipeline
// as consumer to get State info must be the same as the one
// that actually consumes
func (c *Client) getDurableConsumerConfig(stream string) jetstream.ConsumerConfig {
	//nolint: exhaustruct // optional config
	return jetstream.ConsumerConfig{
		Name:          stream + "-consumer",
		Durable:       stream + "-consumer",
		AckPolicy:     jetstream.AckAllPolicy,
		FilterSubject: stream + ".failed",
	}
}

func (c *Client) FetchDLQMessages(ctx context.Context, stream string, batchSize int) ([]models.DLQMessage, error) {
	if stream == "" {
		return nil, fmt.Errorf("stream name cannot be empty")
	}
	if batchSize <= 0 {
		return nil, fmt.Errorf("batch size must be positive")
	}
	if batchSize > internal.DLQMaxBatchSize {
		return nil, models.ErrDLQMaxBatchSize
	}

	s, err := c.js.Stream(ctx, stream)
	if err != nil {
		if errors.Is(err, jetstream.ErrStreamNotFound) {
			return nil, service.ErrDLQNotExists
		}
		return nil, fmt.Errorf("get dlq stream: %w", err)
	}

	dc, err := s.CreateOrUpdateConsumer(ctx, c.getDurableConsumerConfig(stream))
	if err != nil {
		return nil, fmt.Errorf("get message queue consumer: %w", err)
	}

	batch, err := dc.FetchNoWait(batchSize)
	if err != nil {
		return nil, fmt.Errorf("fetch dlq message batch: %w", err)
	}

	var (
		lastMsg jetstream.Msg
		dlqMsgs = make([]models.DLQMessage, 0, batchSize)
	)

	for msg := range batch.Messages() {
		var dlqMsg models.DLQMessage

		err := json.Unmarshal(msg.Data(), &dlqMsg)
		if err != nil {
			return nil, fmt.Errorf("unmarshal dlq msg: %w", err)
		}

		dlqMsgs = append(dlqMsgs, dlqMsg)
		lastMsg = msg
	}

	if batch.Error() != nil {
		return nil, fmt.Errorf("dlq batch: %w", batch.Error())
	}

	// WARNING: potential data loss in case of http failure or pod destruction.
	if lastMsg != nil {
		err := lastMsg.Ack()
		if err != nil {
			return nil, fmt.Errorf("acknowledge all consumed dlq messages: %w", err)
		}
	}

	return dlqMsgs, nil
}

func (c *Client) GetDLQState(ctx context.Context, stream string) (zero models.DLQState, _ error) {
	if stream == "" {
		return zero, fmt.Errorf("stream name cannot be empty")
	}

	s, err := c.js.Stream(ctx, stream)
	if err != nil {
		if errors.Is(err, jetstream.ErrStreamNotFound) {
			return zero, service.ErrDLQNotExists
		}
		return zero, fmt.Errorf("get dlq stream: %w", err)
	}

	sInfo, err := s.Info(ctx, jetstream.WithSubjectFilter(stream+".failed"))
	if err != nil {
		return zero, fmt.Errorf("get dlq stream info: %w", err)
	}

	dc, err := s.CreateOrUpdateConsumer(ctx, c.getDurableConsumerConfig(stream))
	if err != nil {
		return zero, fmt.Errorf("get dlq durable consumer: %w", err)
	}

	dcInfo, err := dc.Info(ctx)
	if err != nil {
		return zero, fmt.Errorf("get dlq consumer info: %w", err)
	}

	return models.DLQState{
		LastReceivedAt:     &sInfo.State.LastTime,
		LastConsumedAt:     dcInfo.Delivered.Last,
		TotalMessages:      sInfo.State.Msgs,
		UnconsumedMessages: dcInfo.NumPending,
	}, nil
}
