package client

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/nats-io/nats.go"
	"github.com/nats-io/nats.go/jetstream"
)

const (
	GlassflowStreamPrefix = "gf-stream"
	NATSCleanupTimeout    = 5 * time.Second
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

func (n *NATSClient) CleanupOldResources() error {
	ctx, cancel := context.WithTimeout(context.Background(), NATSCleanupTimeout)
	defer cancel()

	streamIterator := n.js.ListStreams(nats.Context(ctx))
	if err := streamIterator.Err(); err != nil {
		return fmt.Errorf("list streams error: %w", err)
	}

	for s := range streamIterator.Info() {
		name := s.Config.Name

		if !strings.Contains(name, GlassflowStreamPrefix) {
			continue
		}

		err := n.js.DeleteStream(ctx, name)
		if err != nil {
			if errors.Is(err, jetstream.ErrStreamNotFound) {
				continue
			}
			return fmt.Errorf("delete stream: %w", err)
		}
	}

	return nil
}

func (n *NATSClient) CreateOrUpdateStream(ctx context.Context, name, subject string, dedupWindow time.Duration) error {
	//nolint:exhaustruct // readability
	sc := jetstream.StreamConfig{
		Name:     name,
		Subjects: []string{subject},
		Storage:  jetstream.FileStorage,

		Retention: jetstream.LimitsPolicy,
		MaxAge:    n.maxAge,
		Discard:   jetstream.DiscardOld,
	}

	if dedupWindow > 0 {
		sc.Duplicates = dedupWindow
	}

	_, err := n.JetStream().CreateOrUpdateStream(ctx, sc)
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
