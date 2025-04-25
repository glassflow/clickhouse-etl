package testutils

import (
	"context"
	"fmt"
	"net"
	"time"

	"github.com/ClickHouse/clickhouse-go/v2"
	"github.com/docker/go-connections/nat"
	"github.com/nats-io/nats.go"
	"github.com/testcontainers/testcontainers-go"
	chContainer "github.com/testcontainers/testcontainers-go/modules/clickhouse"
	"github.com/testcontainers/testcontainers-go/wait"
)

const (
	NATSContainerImage = "nats:latest"
	NATSPort           = "4222/tcp"

	ClickHouseContainerImage = "clickhouse/clickhouse-server:23.3.8.21-alpine"
	ClickHousePort           = "9000/tcp"
)

type Container interface {
	Start(context.Context)
	Stop(context.Context)
	GetURI() string
	GetPort() (string, error)
	GetConnection() (any, error)
}

// NATSContainer wraps a NATS testcontainer
type NATSContainer struct {
	container testcontainers.Container
	uri       string
}

func StartNATSContainer(ctx context.Context) (*NATSContainer, error) {
	req := testcontainers.ContainerRequest{ //nolint:exhaustruct // optional config
		Image:        NATSContainerImage,
		ExposedPorts: []string{NATSPort},
		Cmd:          []string{"-js"},
		WaitingFor: wait.ForAll(
			wait.ForLog("Server is ready"),
		),
	}

	container, err := testcontainers.GenericContainer(ctx,
		testcontainers.GenericContainerRequest{ //nolint:exhaustruct // optional config
			ContainerRequest: req,
			Started:          true,
		})
	if err != nil {
		return nil, fmt.Errorf("failed to start NATS container %w", err)
	}

	// Get mapped port
	mappedPort, err := container.MappedPort(ctx, nat.Port(NATSPort))
	if err != nil {
		return nil, fmt.Errorf("failed to get mapped port of NATS container %w", err)
	}

	// Build connection URI
	uri := net.JoinHostPort("127.0.0.1", mappedPort.Port())

	time.Sleep(3 * time.Second) // Delay before NATS will start

	return &NATSContainer{
		container: container,
		uri:       uri,
	}, nil
}

// GetURI returns the NATS URI
func (n *NATSContainer) GetURI() string {
	return n.uri
}

// GetConnection returns a NATS connection
func (n *NATSContainer) GetConnection() (zero *nats.Conn, _ error) {
	conn, err := nats.Connect(n.uri)
	if err != nil {
		return zero, fmt.Errorf("failed to connect to NATS %w", err)
	}
	return conn, nil
}

// Stop stops the container
func (n *NATSContainer) Stop(ctx context.Context) error {
	err := n.container.Terminate(ctx)
	if err != nil {
		return fmt.Errorf("failed to stop NATS container %w", err)
	}

	return nil
}

// ClickHouseContainer wraps a ClickHouse testcontainer
type ClickHouseContainer struct {
	container *chContainer.ClickHouseContainer
}

// StartClickHouseContainer starts a ClickHouse container
func StartClickHouseContainer(ctx context.Context) (*ClickHouseContainer, error) {
	container, err := chContainer.Run(
		ctx,
		ClickHouseContainerImage,
		testcontainers.WithWaitStrategy(
			wait.ForLog("Saved preprocessed configuration"),
		),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to start ClickHouse container %w", err)
	}

	time.Sleep(5 * time.Second) // Delay before ClickHouse will start

	return &ClickHouseContainer{
		container: container,
	}, nil
}

func (c *ClickHouseContainer) GetPort() (string, error) {
	port, err := c.container.MappedPort(context.Background(), nat.Port(ClickHousePort))
	if err != nil {
		return "", fmt.Errorf("failed to get mapped port of ClickHouse container %w", err)
	}
	return port.Port(), nil
}

// GetConnection returns a ClickHouse connection
func (c *ClickHouseContainer) GetConnection() (zero clickhouse.Conn, _ error) {
	port, err := c.container.MappedPort(context.Background(), nat.Port(ClickHousePort))
	if err != nil {
		return zero, fmt.Errorf("failed to get mapped port of ClickHouse container %w", err)
	}

	conn, err := clickhouse.Open(
		&clickhouse.Options{ //nolint:exhaustruct // optional config
			Addr: []string{"localhost:" + port.Port()},
			Auth: clickhouse.Auth{
				Database: c.container.DbName,
				Username: c.container.User,
				Password: c.container.Password,
			},
		},
	)
	if err != nil {
		return zero, fmt.Errorf("failed to connect to ClickHouse %w", err)
	}

	return conn, nil
}

func (c *ClickHouseContainer) GetDefaultDBName() string {
	return c.container.DbName
}

// Stop stops the container
func (c *ClickHouseContainer) Stop(ctx context.Context) error {
	err := c.container.Terminate(ctx)
	if err != nil {
		return fmt.Errorf("failed to stop ClickHouse container %w", err)
	}

	return nil
}
