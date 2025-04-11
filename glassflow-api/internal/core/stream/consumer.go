package stream

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/nats-io/nats.go/jetstream"
)

type ConsumerConfig struct {
	NatsStream     string `json:"stream"`
	NatsConsumer   string `json:"consumer"`
	NatsSubject    string `json:"subject"`
	AckWaitSeconds int64  `json:"ack_wait" default:"60"`
}

type Consumer struct {
	Consumer   jetstream.Consumer
	consumeCtx jetstream.ConsumeContext
}

const (
	ConsumerRetries      = 4
	ConsumerRetryBackoff = 10 * time.Millisecond
)

func NewConsumer(ctx context.Context, js jetstream.JetStream, cfg ConsumerConfig) (*Consumer, error) {
	var (
		stream jetstream.Stream
		err    error
	)

	for range ConsumerRetries {
		stream, err = js.Stream(ctx, cfg.NatsStream)
		if err != nil {
			if errors.Is(err, jetstream.ErrStreamNotFound) {
				time.Sleep(ConsumerRetryBackoff)
				continue
			}
			return nil, fmt.Errorf("get stream: %w", err)
		}
		break
	}
	if err != nil {
		return nil, fmt.Errorf("get stream: %w", err)
	}

	var filter string
	if len(cfg.NatsSubject) > 0 {
		filter = cfg.NatsSubject
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
		Consumer:   consumer,
		consumeCtx: nil,
	}, nil
}

func (c *Consumer) Next() (jetstream.Msg, error) {
	return c.Consumer.Next(jetstream.FetchMaxWait(1000 * time.Millisecond)) //nolint:wrapcheck // no need to wrap
}

func (c *Consumer) Subscribe(msgHandlerFunc func(jetstream.Msg)) error {
	ctx, err := c.Consumer.Consume(msgHandlerFunc)
	if err != nil {
		return fmt.Errorf("subscribe: %w", err)
	}

	c.consumeCtx = ctx

	return nil
}

func (c *Consumer) Unsubscribe() {
	if c.consumeCtx != nil {
		c.consumeCtx.Stop()
	}
}
