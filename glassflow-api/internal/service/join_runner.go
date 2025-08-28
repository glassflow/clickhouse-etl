package service

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/client"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/component"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/kv"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/schema"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/stream"
)

type JoinRunner struct {
	log *slog.Logger
	nc  *client.NATSClient

	component component.Component
	c         chan error
	doneCh    chan struct{}
}

func NewJoinRunner(log *slog.Logger, nc *client.NATSClient) *JoinRunner {
	return &JoinRunner{
		nc:  nc,
		log: log,

		component: nil,
		c:         make(chan error, 1),
		doneCh:    make(chan struct{}),
	}
}

func (j *JoinRunner) Start(ctx context.Context, leftInputStreamName, rightInputStreamName string, outputStream string, joinCfg models.JoinComponentConfig, schemaMapper schema.Mapper) error {
	var mapper schema.JsonToClickHouseMapper

	switch sm := schemaMapper.(type) {
	case *schema.JsonToClickHouseMapper:
		mapper = *sm
	default:
		return fmt.Errorf("unsupported schema mapper")
	}

	if len(mapper.Streams) == 0 {
		return fmt.Errorf("setup joiner: length of streams must not be 0")
	}

	var (
		leftConsumer    stream.Consumer
		rightConsumer   stream.Consumer
		leftBuffer      kv.KeyValueStore
		rightBuffer     kv.KeyValueStore
		leftStreamName  string
		rightStreamName string
		err             error
	)

	leftStreamName = mapper.GetLeftStream()
	rightStreamName = mapper.GetRightStream()

	leftConsumer, err = stream.NewNATSConsumer(ctx, j.nc.JetStream(), stream.ConsumerConfig{
		NatsStream:   leftInputStreamName,
		NatsConsumer: "leftStreamConsumer",
		NatsSubject:  models.GetNATSSubjectName(leftInputStreamName),
	})
	if err != nil {
		return fmt.Errorf("create left consumer: %w", err)
	}

	rightConsumer, err = stream.NewNATSConsumer(ctx, j.nc.JetStream(), stream.ConsumerConfig{
		NatsStream:   rightInputStreamName,
		NatsConsumer: "rightStreamConsumer",
		NatsSubject:  models.GetNATSSubjectName(rightInputStreamName),
	})
	if err != nil {
		return fmt.Errorf("create right consumer: %w", err)
	}

	leftTTL, err := schemaMapper.GetLeftStreamTTL()
	if err != nil {
		return fmt.Errorf("get left stream TTL: %w", err)
	}

	leftBuffer, err = kv.NewNATSKeyValueStore(
		ctx,
		j.nc.JetStream(),
		kv.KeyValueStoreConfig{
			StoreName: leftInputStreamName,
			TTL:       leftTTL,
		},
	)

	if err != nil {
		j.log.Error("failed to create left stream buffer: ", slog.Any("error", err))
		return fmt.Errorf("create left buffer: %w", err)
	}

	rightTTL, err := schemaMapper.GetRightStreamTTL()
	if err != nil {
		return fmt.Errorf("get right stream TTL: %w", err)
	}

	rightBuffer, err = kv.NewNATSKeyValueStore(
		ctx,
		j.nc.JetStream(),
		kv.KeyValueStoreConfig{
			StoreName: rightInputStreamName,
			TTL:       rightTTL,
		})
	if err != nil {
		j.log.Error("failed to create right stream buffer: ", slog.Any("error", err))
		return fmt.Errorf("create right buffer: %w", err)
	}

	resultsPublisher := stream.NewNATSPublisher(j.nc.JetStream(), stream.PublisherConfig{
		Subject: models.GetNATSSubjectName(outputStream),
	})

	component, err := component.NewJoinComponent(
		joinCfg,
		leftConsumer,
		rightConsumer,
		resultsPublisher,
		schemaMapper,
		leftBuffer,
		rightBuffer,
		leftStreamName,
		rightStreamName,
		j.doneCh,
		j.log,
	)
	if err != nil {
		j.log.Error("failed to join: ", slog.Any("error", err))
		return fmt.Errorf("create join: %w", err)
	}

	j.component = component

	go func() {
		component.Start(ctx, j.c)

		close(j.c)

		for err := range j.c {
			j.log.Error("Error in the join component", slog.Any("error", err))
		}
	}()

	return nil
}

func (j *JoinRunner) Shutdown() {
	j.log.Info("Shutting down JoinRunner")
	if j.component != nil {
		j.component.Stop()
	}
}

// Done returns a channel that signals when the component stops by itself
func (j *JoinRunner) Done() <-chan struct{} {
	return j.doneCh
}
