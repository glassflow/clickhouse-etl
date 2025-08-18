package stream

import (
	"context"
	"errors"
	"fmt"
	"log"
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
	ConsumerRetries           = 10
	ConsumerInitialRetryDelay = 1 * time.Second
	ConsumerMaxRetryDelay     = 10 * time.Second
	ConsumerMaxWait           = 30 * time.Second
)

func NewNATSConsumer(ctx context.Context, js jetstream.JetStream, cfg ConsumerConfig) (*NatsConsumer, error) {
	var (
		stream jetstream.Stream
		err    error
	)

	retryCtx, cancel := context.WithTimeout(ctx, ConsumerMaxWait)
	defer cancel()

	retryDelay := ConsumerInitialRetryDelay
	startTime := time.Now()

	for i := range ConsumerRetries {
		if time.Since(startTime) > ConsumerMaxWait {
			return nil, fmt.Errorf("timeout after %v waiting for the NATS stream %s", ConsumerMaxWait, cfg.NatsStream)
		}

		stream, err = js.Stream(ctx, cfg.NatsStream)
		if err == nil {
			break
		}

		if errors.Is(err, jetstream.ErrStreamNotFound) {
			if i < ConsumerRetries-1 {
				select {
				case <-time.After(retryDelay):
					log.Printf("Retrying connection to NATS to stream %s in %v...", cfg.NatsStream, retryDelay) // DELETEME
					// Continue with retry
				case <-retryCtx.Done():
					return nil, fmt.Errorf("context cancelled during retry delay for stream %s: %w", cfg.NatsStream, retryCtx.Err())
				}

				retryDelay = min(time.Duration(float64(retryDelay)*1.5), ConsumerMaxRetryDelay)
			}
			continue
		}

		return nil, fmt.Errorf("get stream %s: %w", cfg.NatsStream, err)
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
