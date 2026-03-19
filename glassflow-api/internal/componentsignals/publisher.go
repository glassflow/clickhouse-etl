package componentsignals

import (
	"context"
	"fmt"

	"github.com/nats-io/nats.go/jetstream"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/client"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

type ComponentSignalPublisher struct {
	js      jetstream.JetStream
	subject string
}

func NewPublisher(nc *client.NATSClient) (*ComponentSignalPublisher, error) {
	if nc == nil {
		return nil, fmt.Errorf("nats client cannot be nil")
	}

	return &ComponentSignalPublisher{
		js:      nc.JetStream(),
		subject: models.GetComponentSignalsSubject(),
	}, nil
}

func (p *ComponentSignalPublisher) SendSignal(ctx context.Context, msg models.ComponentSignal) error {
	data, err := msg.ToJSON()
	if err != nil {
		return fmt.Errorf("failed to marshal message: %w", err)
	}

	_, err = p.js.Publish(ctx, p.subject, data)
	if err != nil {
		return fmt.Errorf("failed to publish to subject %s: %w", p.subject, err)
	}

	return nil
}

func (p *ComponentSignalPublisher) GetSubject() string {
	return p.subject
}
