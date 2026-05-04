package stream

import (
	"context"
	"errors"
	"fmt"
	"log"
	"sync/atomic"

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
	PublishNatsMsgAsync(ctx context.Context, msg *nats.Msg, limit int) (jetstream.PubAckFuture, error)
	WaitForAsyncPublishAcks() <-chan struct{}
}

func WithUntilAck() PublishOpt {
	return func(opts *publishOpts) {
		opts.UntilAck = true
	}
}

type PublisherConfig struct {
	Subject           string `subject:"subject"`
	TotalSubjectCount int
}

type NatsPublisher struct {
	js                jetstream.JetStream
	Subject           string
	totalSubjectCount int
	counter           atomic.Int64
}

func NewNATSPublisher(js jetstream.JetStream, cfg PublisherConfig) *NatsPublisher {
	return &NatsPublisher{
		js:                js,
		Subject:           cfg.Subject,
		totalSubjectCount: cfg.TotalSubjectCount,
	}
}

func (p *NatsPublisher) selectSubject() string {
	if p.totalSubjectCount <= 1 {
		return p.Subject
	}
	n := p.counter.Add(1) - 1
	return fmt.Sprintf("%s.%d", p.Subject, n%int64(p.totalSubjectCount))
}

func (p *NatsPublisher) Publish(ctx context.Context, msg []byte) error {
	_, err := p.js.Publish(ctx, p.selectSubject(), msg)
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
		return nil
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

func (p *NatsPublisher) PublishNatsMsgAsync(ctx context.Context, msg *nats.Msg, limit int) (jetstream.PubAckFuture, error) {
	if msg == nil {
		return nil, fmt.Errorf("message cannot be nil")
	}

	if p.totalSubjectCount > 1 || msg.Subject == "" {
		msg.Subject = p.selectSubject()
	}

	throttleCtx, cancel := context.WithTimeout(ctx, internal.PublisherAsyncMaxRetryWait)
	defer cancel()

	err := p.throttlePublishBackOff(throttleCtx, limit)
	if err != nil {
		return nil, err
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

func (p *NatsPublisher) throttlePublishBackOff(ctx context.Context, limit int) error {
	err := retry.Do(
		func() error {
			if p.js.PublishAsyncPending() < limit {
				return nil
			}
			return ErrStreamMaxPendingMsgs
		},
		retry.Context(ctx),
		retry.DelayType(retry.BackOffDelay),
		retry.Delay(internal.PublisherAsyncInitialRetryDelay),
		retry.MaxDelay(internal.PublisherAsyncMaxRetryDelay),
		retry.LastErrorOnly(true),
	)
	if err != nil {
		// Distinguish caller cancellation from the throttle's own deadline
		// (the latter still means "limit reached, give up for now").
		ctxErr := ctx.Err()
		if ctxErr != nil && !errors.Is(ctxErr, context.DeadlineExceeded) {
			return ctxErr
		}
		return ErrStreamMaxPendingMsgs
	}

	return nil
}
