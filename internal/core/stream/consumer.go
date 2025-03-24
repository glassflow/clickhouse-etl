package stream

import (
	"context"
	"fmt"
	"time"

	"github.com/nats-io/nats.go/jetstream"
)

type ConsumerConfig struct {
	NatsURL        string `json:"url"`
	NatsStream     string `json:"stream"`
	NatsConsumer   string `json:"consumer"`
	NatsSubject    string `json:"subject"`
	AckWaitSeconds int64  `json:"ack_wait" default:"60"`
}

type Consumer struct {
	Consumer jetstream.Consumer
}

func NewConsumer(ctx context.Context, js jetstream.JetStream, cfg ConsumerConfig) (*Consumer, error) {
	stream, err := js.Stream(ctx, cfg.NatsStream)
	if err != nil {
		return nil, fmt.Errorf("get stream: %w", err)
	}

	var filter string
	if len(cfg.NatsSubject) > 0 {
		filter = cfg.NatsStream + "." + cfg.NatsSubject
	}

	//nolint:exhaustruct // optional config
	consumer, err := stream.CreateOrUpdateConsumer(ctx, jetstream.ConsumerConfig{
		Name:          cfg.NatsConsumer,
		Durable:       cfg.NatsConsumer,
		AckWait:       time.Duration(cfg.AckWaitSeconds) * time.Second,
		AckPolicy:     jetstream.AckAllPolicy,
		MaxAckPending: -1,

		FilterSubject: filter,
	})
	if err != nil {
		return nil, fmt.Errorf("get or create consumer: %w", err)
	}

	return &Consumer{
		Consumer: consumer,
	}, nil
}

func (c *Consumer) Next() (jetstream.Msg, error) {
	return c.Consumer.Next(jetstream.FetchMaxWait(1000 * time.Millisecond))
}
