package stream

import (
	"context"
	"errors"
	"fmt"
	"log"
	"time"

	"github.com/nats-io/nats.go"
	"github.com/nats-io/nats.go/jetstream"
	"github.com/synadia-io/orbit.go/jetstreamext"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
)

type publishOpts struct {
	UntilAck bool
}

type PublishOpt func(*publishOpts)

type Publisher interface {
	Publish(ctx context.Context, msg []byte) error
	GetSubject() string
	PublishNatsMsg(ctx context.Context, msg *nats.Msg, opts ...PublishOpt) error
	PublishNatsMsgsAsync(ctx context.Context, msgs []*nats.Msg) ([]FailedMessage, error)
}

func WithUntilAck() PublishOpt {
	return func(opts *publishOpts) {
		opts.UntilAck = true
	}
}

type FailedMessage interface {
	GetData() []byte
	GetError() error
}

type NatsFailedMessage struct {
	Msg *nats.Msg
	Err error
}

func (fm *NatsFailedMessage) GetData() []byte {
	if fm.Msg != nil {
		return fm.Msg.Data
	}
	return nil
}

func (fm *NatsFailedMessage) GetError() error {
	return fm.Err
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
		retryDelay := internal.PublisherInitialRetryDelay
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
				log.Printf("Retrying publish to NATS subject %s in %v...", msg.Subject, retryDelay)
			}

			if time.Since(startTime) >= internal.PublisherMaxRetryWait {
				return fmt.Errorf("max retry wait exceeded: %w", err)
			}

			retryDelay = min(time.Duration(float64(retryDelay)*1.5), internal.PublisherMaxRetryDelay)
		}
	}

	return nil
}

func (p *NatsPublisher) PublishNatsMsgsAsync(ctx context.Context, msgs []*nats.Msg) ([]FailedMessage, error) {
	if msgs == nil {
		return nil, fmt.Errorf("messages cannot be nil")
	}

	if len(msgs) == 0 {
		return nil, nil
	}

	// Ensure all messages have the correct subject
	for _, msg := range msgs {
		if msg.Subject == "" {
			msg.Subject = p.Subject
		}
	}

	// Use atomic batch publishing
	ack, err := jetstreamext.PublishMsgBatch(ctx, p.js, msgs)
	if err != nil {
		// If batch publish fails, return all messages as failed
		failedMsgs := make([]FailedMessage, len(msgs))
		for i, msg := range msgs {
			failedMsgs[i] = &NatsFailedMessage{Msg: msg, Err: err}
		}
		return failedMsgs, fmt.Errorf("batch publish failed: %w", err)
	}

	// Batch publishing is atomic - either all messages succeed or none do
	// If we get here, all messages were published successfully
	if ack != nil {
		log.Printf("Batch published successfully: stream=%s, sequence=%d, batch_size=%d",
			ack.Stream, ack.Sequence, ack.BatchSize)
	}

	return nil, nil
}

func (p *NatsPublisher) GetSubject() string {
	return p.Subject
}
