package stream

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/nats-io/nats.go/jetstream"
)

type Consumer interface {
	Next() (jetstream.Msg, error)
}

type ConsumerConfig struct {
	NatsStream    string
	NatsConsumer  string
	NatsSubject   string
	AckWait       time.Duration
	ExpireTimeout time.Duration
}

type NatsConsumer struct {
	Consumer      jetstream.Consumer
	expireTimeout time.Duration
}

const (
	ConsumerRetries      = 5
	ConsumerRetryBackoff = 30 * time.Millisecond
)

func NewNATSConsumer(ctx context.Context, js jetstream.JetStream, cfg ConsumerConfig) (*NatsConsumer, error) {
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
			return nil, fmt.Errorf("get stream %s: %w", cfg.NatsStream, err)
		}
		break
	}
	if err != nil {
		return nil, fmt.Errorf("get stream %s: %w", cfg.NatsStream, err)
	}

	var filter string
	if len(cfg.NatsSubject) > 0 {
		filter = cfg.NatsSubject
	}

	ackWait := time.Duration(60) * time.Second
	if cfg.AckWait > 0 {
		ackWait = cfg.AckWait
	}

	expireTimeout := time.Duration(1) * time.Second
	if cfg.ExpireTimeout > 0 {
		expireTimeout = cfg.ExpireTimeout
	}

	//nolint:exhaustruct // optional config
	consumer, err := stream.CreateOrUpdateConsumer(ctx, jetstream.ConsumerConfig{
		Name:          cfg.NatsConsumer,
		Durable:       cfg.NatsConsumer,
		AckWait:       ackWait,
		AckPolicy:     jetstream.AckAllPolicy,
		MaxAckPending: -1,

		FilterSubject: filter,
	})
	if err != nil {
		return nil, fmt.Errorf("get or create consumer: %w", err)
	}

	return &NatsConsumer{
		Consumer:      consumer,
		expireTimeout: expireTimeout,
	}, nil
}

func (c *NatsConsumer) Next() (jetstream.Msg, error) {
	return c.Consumer.Next(jetstream.FetchMaxWait(c.expireTimeout)) //nolint:wrapcheck // no need to wrap
}
