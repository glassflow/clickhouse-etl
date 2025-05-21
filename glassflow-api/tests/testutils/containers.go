package testutils

import (
	"context"
	"fmt"
	"math"
	"net"
	"strconv"
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

	KafkaContainerImage = "confluentinc/confluent-local:7.5.0"
	KafkaPort           = "9093/tcp"

	starterScript = "/usr/sbin/testcontainers_start.sh"

	// starterScript {
	starterScriptContent = `#!/bin/bash
source /etc/confluent/docker/bash-config
export KAFKA_ADVERTISED_LISTENERS=PLAINTEXT://%s:%d,BROKER://%s:9092
echo Starting Kafka KRaft mode
sed -i '/KAFKA_ZOOKEEPER_CONNECT/d' /etc/confluent/docker/configure
echo 'kafka-storage format --ignore-formatted -t "$(kafka-storage random-uuid)" -c /etc/kafka/kafka.properties' >> /etc/confluent/docker/configure
echo '' > /etc/confluent/docker/ensure
/etc/confluent/docker/configure
/etc/confluent/docker/launch`
	// }
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

type KafkaContainer struct {
	container testcontainers.Container
	uri       string
}

func StartKafkaContainer(ctx context.Context) (*KafkaContainer, error) {
	clusterID := "test-cluster"

	req := testcontainers.ContainerRequest{ //nolint:exhaustruct // necessary fields only
		Image:        KafkaContainerImage,
		ExposedPorts: []string{string(KafkaPort)},
		Env: map[string]string{
			// envVars {
			"KAFKA_LISTENERS":                                "PLAINTEXT://0.0.0.0:9093,BROKER://0.0.0.0:9092,CONTROLLER://0.0.0.0:9094",
			"KAFKA_REST_BOOTSTRAP_SERVERS":                   "PLAINTEXT://0.0.0.0:9093,BROKER://0.0.0.0:9092,CONTROLLER://0.0.0.0:9094",
			"KAFKA_LISTENER_SECURITY_PROTOCOL_MAP":           "BROKER:PLAINTEXT,PLAINTEXT:PLAINTEXT,CONTROLLER:PLAINTEXT",
			"KAFKA_INTER_BROKER_LISTENER_NAME":               "BROKER",
			"KAFKA_BROKER_ID":                                "1",
			"KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR":         "1",
			"KAFKA_OFFSETS_TOPIC_NUM_PARTITIONS":             "1",
			"KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR": "1",
			"KAFKA_TRANSACTION_STATE_LOG_MIN_ISR":            "1",
			"KAFKA_LOG_FLUSH_INTERVAL_MESSAGES":              strconv.Itoa(math.MaxInt),
			"KAFKA_GROUP_INITIAL_REBALANCE_DELAY_MS":         "0",
			"KAFKA_NODE_ID":                                  "1",
			"KAFKA_PROCESS_ROLES":                            "broker,controller",
			"KAFKA_CONTROLLER_LISTENER_NAMES":                "CONTROLLER",
			"CLUSTER_ID":                                     clusterID,
			// }
		},
		Entrypoint: []string{"sh"},
		Cmd:        []string{"-c", "while [ ! -f " + starterScript + " ]; do sleep 0.1; done; bash " + starterScript},
		LifecycleHooks: []testcontainers.ContainerLifecycleHooks{
			{
				PostStarts: []testcontainers.ContainerHook{
					func(ctx context.Context, c testcontainers.Container) error {
						hostname := "localhost"

						port, err := c.MappedPort(ctx, KafkaPort)
						if err != nil {
							return fmt.Errorf("failed to get mapped port of Kafka container: %w", err)
						}

						scriptContent := fmt.Sprintf(starterScriptContent, hostname, port.Int(), hostname)

						return c.CopyToContainer(ctx, []byte(scriptContent), starterScript, 0o755)
					},
					func(ctx context.Context, c testcontainers.Container) error {
						return wait.ForLog(".*Transitioning from RECOVERY to RUNNING.*").AsRegexp().WaitUntilReady(ctx, c)
					},
				},
			},
		},
	}

	genericContainerReq := testcontainers.GenericContainerRequest{ //nolint:exhaustruct // optional config
		ContainerRequest: req,
		Started:          true,
	}

	configureControllerQuorumVoters(&genericContainerReq)

	container, err := testcontainers.GenericContainer(ctx, genericContainerReq)
	if err != nil {
		return nil, fmt.Errorf("failed to start Kafka container %w", err)
	}

	port, err := container.MappedPort(ctx, nat.Port(KafkaPort))
	if err != nil {
		return nil, fmt.Errorf("failed to get mapped port of Kafka container %w", err)
	}

	return &KafkaContainer{
		container: container,
		uri:       "localhost:" + port.Port(),
	}, nil
}

func configureControllerQuorumVoters(req *testcontainers.GenericContainerRequest) {
	if req.Env == nil {
		req.Env = map[string]string{}
	}

	if req.Env["KAFKA_CONTROLLER_QUORUM_VOTERS"] == "" {
		host := "localhost"
		if len(req.Networks) > 0 {
			nw := req.Networks[0]
			if len(req.NetworkAliases[nw]) > 0 {
				host = req.NetworkAliases[nw][0]
			}
		}

		req.Env["KAFKA_CONTROLLER_QUORUM_VOTERS"] = fmt.Sprintf("1@%s:9094", host)
	}
	// }
}

// GetURI returns the Kafka URI
func (k *KafkaContainer) GetURI() string {
	return k.uri
}

func (k *KafkaContainer) Stop(ctx context.Context) error {
	err := k.container.Terminate(ctx)
	if err != nil {
		return fmt.Errorf("failed to stop Kafka container %w", err)
	}
	return nil
}
