package stream

import (
	"context"
	"fmt"

	"github.com/nats-io/nats.go/jetstream"
)

type PublisherConfig struct {
	Subject string `subject:"subject"`
}

type Publisher struct {
	js      jetstream.JetStream
	Subject string
}

func NewPublisher(js jetstream.JetStream, cfg PublisherConfig) *Publisher {
	pub := &Publisher{
		js:      js,
		Subject: cfg.Subject,
	}

	return pub
}

func (p *Publisher) Publish(ctx context.Context, msg []byte) error {
	_, err := p.js.Publish(ctx, p.Subject, msg)
	if err != nil {
		return fmt.Errorf("failed to publish message: %w", err)
	}

	return nil
}
