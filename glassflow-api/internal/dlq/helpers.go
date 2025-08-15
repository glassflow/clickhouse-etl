package dlq

import (
	"context"
	"fmt"

	"github.com/nats-io/nats.go/jetstream"
)

// JetStreamClient abstracts the JetStream interface for testability
type JetStreamClient interface {
	Stream(ctx context.Context, name string) (StreamClient, error)
}

// StreamClient abstracts the Stream interface for testability
type StreamClient interface {
	CreateOrUpdateConsumer(ctx context.Context, cfg jetstream.ConsumerConfig) (ConsumerClient, error)
	Info(ctx context.Context, opts ...jetstream.StreamInfoOpt) (*jetstream.StreamInfo, error)
}

// ConsumerClient abstracts the Consumer interface for testability
type ConsumerClient interface {
	FetchNoWait(maxMsgs int) (MessageBatch, error)
	Info(ctx context.Context) (*jetstream.ConsumerInfo, error)
}

// MessageBatch abstracts the message batch interface for testability
type MessageBatch interface {
	Messages() <-chan jetstream.Msg
	Error() error
}

// JetStreamAdapter adapts the real JetStream to our interface
type JetStreamAdapter struct {
	js jetstream.JetStream
}

func NewJetStreamAdapter(js jetstream.JetStream) *JetStreamAdapter {
	return &JetStreamAdapter{js: js}
}

func (j *JetStreamAdapter) Stream(ctx context.Context, name string) (StreamClient, error) {
	stream, err := j.js.Stream(ctx, name)
	if err != nil {
		return nil, fmt.Errorf("error getting stream: %w", err)
	}
	return &StreamAdapter{stream: stream}, nil
}

// StreamAdapter adapts the real Stream to our interface
type StreamAdapter struct {
	stream jetstream.Stream
}

func (s *StreamAdapter) CreateOrUpdateConsumer(ctx context.Context, cfg jetstream.ConsumerConfig) (ConsumerClient, error) {
	consumer, err := s.stream.CreateOrUpdateConsumer(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("error on create stream consumer: %w", err)
	}
	return &ConsumerAdapter{consumer: consumer}, nil
}

func (s *StreamAdapter) Info(ctx context.Context, opts ...jetstream.StreamInfoOpt) (*jetstream.StreamInfo, error) {
	streamInfo, err := s.stream.Info(ctx, opts...)
	if err != nil {
		return nil, fmt.Errorf("error getting stream info: %w", err)
	}
	return streamInfo, nil
}

// ConsumerAdapter adapts the real Consumer to our interface
type ConsumerAdapter struct {
	consumer jetstream.Consumer
}

func (c *ConsumerAdapter) FetchNoWait(maxMsgs int) (MessageBatch, error) {
	batch, err := c.consumer.FetchNoWait(maxMsgs)
	if err != nil {
		return nil, fmt.Errorf("error on fetch batch of messages: %w", err)
	}
	return &MessageBatchAdapter{batch: batch}, nil
}

func (c *ConsumerAdapter) Info(ctx context.Context) (*jetstream.ConsumerInfo, error) {
	consumerInfo, err := c.consumer.Info(ctx)
	if err != nil {
		return nil, fmt.Errorf("error getting consumer info: %w", err)
	}
	return consumerInfo, nil
}

// MessageBatchAdapter adapts the real MessageBatch to our interface
type MessageBatchAdapter struct {
	batch jetstream.MessageBatch
}

func (m *MessageBatchAdapter) Messages() <-chan jetstream.Msg {
	return m.batch.Messages()
}

func (m *MessageBatchAdapter) Error() error {
	err := m.batch.Error()
	if err != nil {
		return fmt.Errorf("error in message batch: %w", err)
	}
	return nil
}
