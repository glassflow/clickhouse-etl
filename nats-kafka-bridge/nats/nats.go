package nats

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
	NatsReconnectsForever = -1
	GlassflowStreamPrefix = "gf-stream"
)

type Client struct {
	con *nats.Conn
	JS  jetstream.JetStream

	StreamMaxAge time.Duration
}

func NewClient(url string, maxAge time.Duration) (*Client, error) {
	natsCon, err := nats.Connect(url,
		nats.MaxReconnects(NatsReconnectsForever),
	)
	if err != nil {
		return nil, fmt.Errorf("nats connect: %w", err)
	}

	natsJs, err := jetstream.New(natsCon)
	if err != nil {
		return nil, fmt.Errorf("jet stream: %w", err)
	}

	return &Client{
		con: natsCon,
		JS:  natsJs,

		StreamMaxAge: maxAge,
	}, nil
}

func (c *Client) Close() {
	c.con.Close()
}

func (c *Client) createOrUpdateStream(ctx context.Context, name, subject string, dedupWindow time.Duration) error {
	//nolint:exhaustruct // readability
	_, err := c.JS.CreateOrUpdateStream(ctx, jetstream.StreamConfig{
		Name:       name,
		Subjects:   []string{subject},
		Storage:    jetstream.FileStorage,
		Duplicates: dedupWindow,

		Retention: jetstream.LimitsPolicy,
		MaxAge:    c.StreamMaxAge,
		Discard:   jetstream.DiscardOld,
	})
	if err != nil {
		return fmt.Errorf("cannot create nats stream: %w", err)
	}

	return nil
}

func (c *Client) DeleteStream(ctx context.Context, name string) error {
	err := c.JS.DeleteStream(ctx, name)
	if err != nil {
		return fmt.Errorf("delete stream: %w", err)
	}
	return nil
}

func SetupNATS(ctx context.Context, url string, stream, subject string, maxAge, dedupWindow time.Duration) error {
	c, err := NewClient(url, maxAge)
	if err != nil {
		return fmt.Errorf("nats client: %w", err)
	}

	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	//nolint: contextcheck // wrong linting error, already inherited
	streamIterator := c.JS.ListStreams(nats.Context(ctx))
	if err := streamIterator.Err(); err != nil {
		return fmt.Errorf("list streams error: %w", err)
	}

	for s := range streamIterator.Info() {
		name := s.Config.Name

		if !strings.HasPrefix(name, GlassflowStreamPrefix) {
			continue
		}

		err := c.JS.DeleteStream(ctx, name)
		if err != nil {
			if errors.Is(err, jetstream.ErrStreamNotFound) {
				continue
			}
			return fmt.Errorf("delete stream: %w", err)
		}
	}

	err = c.createOrUpdateStream(ctx, stream, subject, dedupWindow)
	if err != nil {
		return fmt.Errorf("create nats stream: %w", err)
	}

	return nil
}
