package stream

import (
	"context"
	"errors"
	"fmt"
	"log"

	"github.com/avast/retry-go"
	"github.com/nats-io/nats.go"
	"github.com/nats-io/nats.go/jetstream"

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
	PublishNatsMsgAsync(msg *nats.Msg) (jetstream.PubAckFuture, error)
	WaitForAsyncPublishAcks() <-chan struct{}
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

type FailedMessage struct {
	Msg *nats.Msg
	Err error
}

func (fm *FailedMessage) GetData() []byte {
	if fm.Msg != nil {
		return fm.Msg.Data
	}
	return nil
}

func (fm *FailedMessage) GetError() error {
	return fm.Err
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
	}

	ctxMax, cancel := context.WithTimeout(ctx, internal.PublisherSyncMaxRetryWait)
	defer cancel()

	err := retry.Do(
		func() error {
			_, err := p.js.PublishMsg(ctxMax, msg)
			if err != nil {
				if errors.Is(err, nats.ErrConnectionClosed) {
					return retry.Unrecoverable(fmt.Errorf("connection error: %w", err))
				}
				return fmt.Errorf("failed to publish message: %w", err)
			}
			return nil
		},
		retry.Context(ctxMax),
		retry.Delay(internal.PublisherSyncInitialRetryDelay),
		retry.MaxDelay(internal.PublisherSyncMaxRetryDelay),
		retry.DelayType(retry.BackOffDelay),
		retry.LastErrorOnly(true),
		retry.OnRetry(func(n uint, err error) {
			log.Printf("Retrying publish to NATS subject %s (attempt %d): %v", msg.Subject, n+1, err)
		}),
	)
	if err != nil {
		if errors.Is(err, context.DeadlineExceeded) {
			return fmt.Errorf("max retry wait exceeded: %w", err)
		}
		return fmt.Errorf("failed to publish message: %w", err)
	}

	return nil
}

func (p *NatsPublisher) PublishNatsMsgAsync(msg *nats.Msg) (jetstream.PubAckFuture, error) {
	if msg == nil {
		return nil, fmt.Errorf("message cannot be nil")
	}

	ctx, cancel := context.WithTimeout(context.Background(), internal.PublisherAsyncMaxRetryWait)
	defer cancel()

	err := p.throttlePublishBackOff(ctx)
	if err != nil {
		return nil, fmt.Errorf("throttle publish backoff: %w", err)
	}

	futAck, err := p.js.PublishMsgAsync(msg)
	if err != nil {
		return nil, fmt.Errorf("failed to publish message async: %w", err)
	}

	return futAck, nil
}

func (p *NatsPublisher) WaitForAsyncPublishAcks() <-chan struct{} {
	return p.js.PublishAsyncComplete()
}

func (p *NatsPublisher) GetSubject() string {
	return p.Subject
}

func (p *NatsPublisher) throttlePublishBackOff(ctx context.Context) error {
	err := retry.Do(
		func() error {
			currentAsyncPendingMsgs := p.js.PublishAsyncPending()
			if currentAsyncPendingMsgs < internal.PublisherMaxPendingAcks {
				return nil
			}
			return fmt.Errorf("max in-flight messages reached: %d", currentAsyncPendingMsgs)
		},
		retry.Context(ctx),
		retry.DelayType(retry.BackOffDelay),
		retry.Delay(internal.PublisherAsyncInitialRetryDelay),
		retry.MaxDelay(internal.PublisherAsyncMaxRetryDelay),
	)
	if err != nil {
		return fmt.Errorf("throttling failed %w", err)
	}

	return nil
}
