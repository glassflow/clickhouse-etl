package dlq

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/client"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	streampkg "github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/stream"
	"github.com/nats-io/nats.go/jetstream"
)

type Client struct {
	jetstreamClient jetstream.JetStream
}

func NewClient(natsClient *client.NATSClient) *Client {
	return &Client{
		jetstreamClient: natsClient.JetStream(),
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
		AckPolicy:     jetstream.AckExplicitPolicy,
		FilterSubject: stream + ".failed",
	}
}

func (c *Client) FetchDLQMessages(ctx context.Context, streamName string, batchSize int) ([]models.DLQMessage, error) {
	if streamName == "" {
		return nil, fmt.Errorf("stream name cannot be empty")
	}
	if batchSize <= 0 {
		return nil, fmt.Errorf("batch size must be positive")
	}
	if batchSize > internal.DLQMaxBatchSize {
		return nil, models.ErrDLQMaxBatchSize
	}

	// Check stream exists first - return immediately if not (avoids NewNATSConsumer retry loop)
	_, err := c.jetstreamClient.Stream(ctx, streamName)
	if err != nil {
		if errors.Is(err, jetstream.ErrStreamNotFound) {
			return nil, internal.ErrDLQNotExists
		}
		return nil, fmt.Errorf("get dlq stream: %w", err)
	}

	consumer, err := streampkg.NewNATSConsumer(ctx, c.jetstreamClient, c.getDurableConsumerConfig(streamName), streamName)
	if err != nil {
		if errors.Is(err, jetstream.ErrStreamNotFound) {
			return nil, internal.ErrDLQNotExists
		}
		return nil, fmt.Errorf("get message queue consumer: %w", err)
	}

	batch, err := consumer.FetchNoWait(batchSize)
	if err != nil {
		return nil, fmt.Errorf("fetch dlq message batch: %w", err)
	}

	var (
		messages = make([]jetstream.Msg, 0, batchSize)
		dlqMsgs  = make([]models.DLQMessage, 0, batchSize)
	)

	for msg := range batch.Messages() {
		var dlqMsg models.DLQMessage

		err := json.Unmarshal(msg.Data(), &dlqMsg)
		if err != nil {
			return nil, fmt.Errorf("unmarshal dlq msg: %w", err)
		}

		dlqMsgs = append(dlqMsgs, dlqMsg)
		messages = append(messages, msg)
	}

	if batch.Error() != nil {
		return nil, fmt.Errorf("dlq batch: %w", batch.Error())
	}

	// WARNING: potential data loss in case of http failure or pod destruction.
	for _, msg := range messages {
		if err := msg.Ack(); err != nil {
			return nil, fmt.Errorf("acknowledge dlq message: %w", err)
		}
	}

	if len(dlqMsgs) == 0 {
		return nil, internal.ErrNoMessagesInDLQ
	}

	return dlqMsgs, nil
}

func (c *Client) GetDLQState(ctx context.Context, streamName string) (zero models.DLQState, _ error) {
	if streamName == "" {
		return zero, fmt.Errorf("stream name cannot be empty")
	}

	stream, err := c.jetstreamClient.Stream(ctx, streamName)
	if err != nil {
		if errors.Is(err, jetstream.ErrStreamNotFound) {
			return zero, internal.ErrDLQNotExists
		}
		return zero, fmt.Errorf("get dlq stream: %w", err)
	}

	streamInfo, err := stream.Info(ctx, jetstream.WithSubjectFilter(streamName+".failed"))
	if err != nil {
		return zero, fmt.Errorf("get dlq stream info: %w", err)
	}

	consumer, err := streampkg.NewNATSConsumer(ctx, c.jetstreamClient, c.getDurableConsumerConfig(streamName), streamName)
	if err != nil {
		if errors.Is(err, jetstream.ErrStreamNotFound) {
			return zero, internal.ErrDLQNotExists
		}
		return zero, fmt.Errorf("get dlq durable consumer: %w", err)
	}

	consumerInfo, err := consumer.Info(ctx)
	if err != nil {
		return zero, fmt.Errorf("get dlq consumer info: %w", err)
	}

	return models.DLQState{
		LastReceivedAt:     &streamInfo.State.LastTime,
		LastConsumedAt:     consumerInfo.Delivered.Last,
		TotalMessages:      streamInfo.State.Msgs,
		UnconsumedMessages: consumerInfo.NumPending,
	}, nil
}

func (c *Client) PurgeDLQ(ctx context.Context, stream string) error {
	if stream == "" {
		return fmt.Errorf("stream name cannot be empty")
	}

	natsStream, err := c.jetstreamClient.Stream(ctx, stream)
	if err != nil {
		if errors.Is(err, jetstream.ErrStreamNotFound) {
			return internal.ErrDLQNotExists
		}
		return fmt.Errorf("get dlq stream: %w", err)
	}

	err = natsStream.Purge(ctx, jetstream.WithPurgeSubject(stream+".failed"))
	if err != nil {
		return fmt.Errorf("purge dlq stream: %w", err)
	}

	return nil
}
