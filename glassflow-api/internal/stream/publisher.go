package stream

import (
	"context"
	"errors"
	"fmt"
	"log"
	"time"

	"github.com/nats-io/nats.go"
	"github.com/nats-io/nats.go/jetstream"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
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

func (p *NatsPublisher) terminatePendingMessages(futures []jetstream.PubAckFuture) error {
	for _, future := range futures {
		msg := future.Msg()
		err := msg.Term()
		if err != nil {
			return fmt.Errorf("failed to terminate message: %w", err)
		}
	}
	return nil
}

func (p *NatsPublisher) PublishNatsMsgsAsync(ctx context.Context, msgs []*nats.Msg) ([]FailedMessage, error) {
	if msgs == nil {
		return nil, fmt.Errorf("messages cannot be nil")
	}

	futures := make([]jetstream.PubAckFuture, 0, len(msgs))
	failedMsgs := make([]FailedMessage, 0)

	for _, msg := range msgs {
		future, err := p.js.PublishMsgAsync(msg)
		if err != nil {
			failedMsgs = append(failedMsgs, &NatsFailedMessage{Msg: msg, Err: err})
			continue
		}
		futures = append(futures, future)
	}

	select {
	case <-ctx.Done():
		// TODO: review and try to find more graceful way to handle that
		err := p.terminatePendingMessages(futures)
		if err != nil {
			return nil, fmt.Errorf("failed to terminate pending messages: %w", err)
		}
		return nil, ctx.Err()
	case <-p.js.PublishAsyncComplete():
		// All messages have been processed
	}

	for _, future := range futures {
		select {
		case <-future.Ok():
			// Message published successfully
			continue
		case err := <-future.Err():
			failedMsgs = append(failedMsgs, &NatsFailedMessage{Msg: future.Msg(), Err: err})
		case <-ctx.Done():
			return nil, ctx.Err()
		}
	}

	if len(failedMsgs) > 0 {
		return failedMsgs, models.ErrAsyncBatchFailed
	}

	return failedMsgs, nil
}

func (p *NatsPublisher) GetSubject() string {
	return p.Subject
}
