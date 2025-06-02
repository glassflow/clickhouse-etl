package nats

import (
	"context"
	"fmt"
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

func (c *Client) DeleteStream(ctx context.Context, name string) error {
	err := c.JS.DeleteStream(ctx, name)
	if err != nil {
		return fmt.Errorf("delete stream: %w", err)
	}
	return nil
}
