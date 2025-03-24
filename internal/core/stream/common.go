package stream

import (
	"fmt"

	"github.com/nats-io/nats.go"
	"github.com/nats-io/nats.go/jetstream"
)

type NATSConnWrapper struct {
	nc *nats.Conn
	js jetstream.JetStream
}

func NewNATSWrapper(url string) (*NATSConnWrapper, error) {
	nc, err := nats.Connect(url)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to NATS: %w", err)
	}

	js, err := jetstream.New(nc)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to JetStream: %w", err)
	}

	return &NATSConnWrapper{
		nc: nc,
		js: js,
	}, nil
}

func (n *NATSConnWrapper) JetStream() jetstream.JetStream {
	return n.js
}

func (n *NATSConnWrapper) Close() error {
	n.nc.Close()
	return nil
}
