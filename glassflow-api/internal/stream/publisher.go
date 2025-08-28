package stream

import (
	"context"
	"errors"
	"fmt"
	"log"
	"time"

	"github.com/nats-io/nats.go"
	"github.com/nats-io/nats.go/jetstream"
)

const (
	initialRetryDelay = 1 * time.Second
	maxRetryDelay     = 10 * time.Second
	maxRetryWait      = 5 * time.Minute
)

type publishOpts struct {
	UntilAck bool
}

type PublishOpt func(*publishOpts)

type Publisher interface {
	Publish(ctx context.Context, msg []byte) error
	GetSubject() string
	PublishNatsMsg(ctx context.Context, msg *nats.Msg, opts ...PublishOpt) error
}

func WithUntilAck() PublishOpt {
	return func(opts *publishOpts) {
		opts.UntilAck = true
	}
}

type PublisherConfig struct {
	Subject string `subject:"subject"`
}

type NatsPublisher struct {
	js      jetstream.JetStream
	Subject string
}

func NewNATSPublisher(js jetstream.JetStream, cfg PublisherConfig) *NatsPublisher {
	pub := &NatsPublisher{
		js:      js,
		Subject: cfg.Subject,
	}

	return pub
}

func (p *NatsPublisher) Publish(ctx context.Context, msg []byte) error {
	_, err := p.js.Publish(ctx, p.Subject, msg)
	if err != nil {
		return fmt.Errorf("failed to publish message: %w", err)
	}

	return nil
}

func (p *NatsPublisher) PublishNatsMsg(ctx context.Context, msg *nats.Msg, opts ...PublishOpt) error {
	if msg == nil {
		return fmt.Errorf("message cannot be nil")
	}

	options := &publishOpts{
		UntilAck: false,
	}

	for _, opt := range opts {
		opt(options)
	}

	if !options.UntilAck {
		_, err := p.js.PublishMsg(ctx, msg)
		if err != nil {
			return fmt.Errorf("failed to publish message: %w", err)
		}
	} else {
		retryDelay := initialRetryDelay
		startTime := time.Now()
		for {
			_, err := p.js.PublishMsg(ctx, msg)
			if err == nil {
				break
			}

			if errors.Is(err, nats.ErrConnectionClosed) {
				return fmt.Errorf("connection error: %w", err)
			}

			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(retryDelay):
				log.Printf("Retrying publish to NATS subject %s in %v...", p.Subject, retryDelay)
			}

			if time.Since(startTime) >= maxRetryWait {
				return fmt.Errorf("max retry wait exceeded: %w", err)
			}

			retryDelay = min(time.Duration(float64(retryDelay)*1.5), maxRetryDelay)
		}
	}

	return nil
}

func (p *NatsPublisher) GetSubject() string {
	return p.Subject
}
