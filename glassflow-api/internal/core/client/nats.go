package client

import (
	"context"
	"fmt"
	"time"

	"github.com/nats-io/nats.go"
	"github.com/nats-io/nats.go/jetstream"
)

type NATSClient struct {
	nc *nats.Conn
	js jetstream.JetStream

	maxAge time.Duration
}

func NewNATSWrapper(url string, streamAge time.Duration) (*NATSClient, error) {
	nc, err := nats.Connect(url)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to NATS: %w", err)
	}

	js, err := jetstream.New(nc)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to JetStream: %w", err)
	}

	return &NATSClient{
		nc: nc,
		js: js,

		maxAge: streamAge,
	}, nil
}

func (n *NATSClient) CreateOrUpdateStream(ctx context.Context, name, subject string) error {
	//nolint:exhaustruct // readability
	_, err := n.JetStream().CreateOrUpdateStream(ctx, jetstream.StreamConfig{
		Name:     name,
		Subjects: []string{subject},
		Storage:  jetstream.FileStorage,

		Retention: jetstream.LimitsPolicy,
		MaxAge:    n.maxAge,
		Discard:   jetstream.DiscardOld,
	})
	if err != nil {
		return fmt.Errorf("cannot create nats stream: %w", err)
	}

	return nil
}

func (n *NATSClient) JetStream() jetstream.JetStream {
	return n.js
}

func (n *NATSClient) Close() error {
	n.nc.Close()
	return nil
}
