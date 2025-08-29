package client

import (
	"context"
	"errors"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/nats-io/nats.go"
	"github.com/nats-io/nats.go/jetstream"
)

type NATSClientOption func(*NATSClient)

func WithMaxAge(age time.Duration) NATSClientOption {
	return func(opts *NATSClient) {
		opts.maxAge = age
	}
}

type NATSClient struct {
	nc *nats.Conn
	js jetstream.JetStream

	maxAge time.Duration
}

func NewNATSClient(ctx context.Context, url string, opts ...NATSClientOption) (*NATSClient, error) {
	var (
		nc  *nats.Conn
		err error
	)

	connCtx, cancel := context.WithTimeout(ctx, internal.NATSMaxConnectionWait)
	defer cancel()

	retryDelay := internal.NATSInitialRetryDelay

	for i := range internal.NATSConnectionRetries {
		select {
		case <-connCtx.Done():
			return nil, fmt.Errorf("timeout after %v waiting to connect to NATS at %s", internal.NATSMaxConnectionWait, url)
		default:
		}

		nc, err = nats.Connect(url, nats.Timeout(internal.NATSConnectionTimeout))
		if err == nil {
			break
		}

		if i < internal.NATSConnectionRetries-1 {
			select {
			case <-time.After(retryDelay):
				log.Printf("Retrying connection to NATS to %s in %v...", url, retryDelay)
				// Continue with retry
			case <-connCtx.Done():
				return nil, fmt.Errorf("timeout during retry delay for NATS at %s: %w", url, connCtx.Err())
			}
			// Exponential backoff
			retryDelay = min(time.Duration(float64(retryDelay)*1.5), internal.NATSMaxRetryDelay)
		}
	}
	if err != nil {
		return nil, fmt.Errorf("failed to connect to NATS: %w", err)
	}

	js, err := jetstream.New(nc)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to JetStream: %w", err)
	}

	natsClient := NATSClient{ //nolint:exhaustruct // optional config
		nc: nc,
		js: js,
	}

	for _, opt := range opts {
		opt(&natsClient)
	}

	return &natsClient, nil
}

func (n *NATSClient) CleanupOldResources(ctx context.Context) error {
	ctx, cancel := context.WithTimeout(ctx, internal.NATSCleanupTimeout)
	defer cancel()

	streamIterator := n.js.ListStreams(nats.Context(ctx))
	if err := streamIterator.Err(); err != nil {
		return fmt.Errorf("list streams error: %w", err)
	}

	for s := range streamIterator.Info() {
		name := s.Config.Name

		if !strings.Contains(name, internal.GlassflowStreamPrefix) && !strings.Contains(name, internal.DLQSuffix) {
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
