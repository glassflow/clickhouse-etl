package stream

import (
	"context"
	"errors"
	"fmt"
	"log"
	"time"

	"github.com/nats-io/nats.go/jetstream"

	"github.com/glassflow/clickhouse-etl/glassflow-api/internal"
)

type Consumer interface {
	Next() (jetstream.Msg, error)
	Fetch(maxMsgs int, maxWait time.Duration) (jetstream.MessageBatch, error)
	FetchNoAwait(maxMsgs int) (jetstream.MessageBatch, error)
	Info(ctx context.Context) (*jetstream.ConsumerInfo, error)
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

func NewNATSConsumer(ctx context.Context, js jetstream.JetStream, cfg ConsumerConfig) (*NatsConsumer, error) {
	var (
		stream jetstream.Stream
		err    error
	)

	retryCtx, cancel := context.WithTimeout(ctx, internal.ConsumerMaxWait)
	defer cancel()

	retryDelay := internal.ConsumerInitialRetryDelay
	startTime := time.Now()

	for i := range internal.ConsumerRetries {
		if time.Since(startTime) > internal.ConsumerMaxWait {
			return nil, fmt.Errorf("timeout after %v waiting for the NATS stream %s", internal.ConsumerMaxWait, cfg.NatsStream)
		}

		stream, err = js.Stream(ctx, cfg.NatsStream)
		if err == nil {
			break
		}

		if errors.Is(err, jetstream.ErrStreamNotFound) {
			if i < internal.ConsumerRetries-1 {
				select {
				case <-time.After(retryDelay):
					log.Printf("Retrying connection to NATS to stream %s in %v...", cfg.NatsStream, retryDelay)
					// Continue with retry
				case <-retryCtx.Done():
					return nil, fmt.Errorf("context cancelled during retry delay for stream %s: %w", cfg.NatsStream, retryCtx.Err())
				}

				retryDelay = min(time.Duration(float64(retryDelay)*1.5), internal.ConsumerMaxRetryDelay)
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

func (c *NatsConsumer) Fetch(maxMsgs int, maxWait time.Duration) (jetstream.MessageBatch, error) {
	// Use the consumer's built-in Fetch method for batch retrieval
	// For batch fetching, use the requested timeout directly (don't limit to expireTimeout)
	// The expireTimeout is for individual message fetching, not batch fetching

	// Use NATS JetStream's built-in Fetch method for efficient batch retrieval
	msgBatch, err := c.Consumer.Fetch(maxMsgs, jetstream.FetchMaxWait(maxWait))
	if err != nil {
		return nil, fmt.Errorf("failed to fetch NATS messages: %w", err)
	}

	return msgBatch, nil
}

func (c *NatsConsumer) FetchNoAwait(maxMsgs int) (jetstream.MessageBatch, error) {
	msgBatch, err := c.Consumer.FetchNoWait(maxMsgs)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch NATS messages: %w", err)
	}

	return msgBatch, nil
}

func (c *NatsConsumer) Info(ctx context.Context) (*jetstream.ConsumerInfo, error) {
	consumerInfo, err := c.Consumer.Info(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to consumer info: %w", err)
	}

	return consumerInfo, nil
}
