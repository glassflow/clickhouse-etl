package service

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/client"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/component"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/kv"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/schema"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/stream"
	"github.com/nats-io/nats.go/jetstream"
)

type JoinRunner struct {
	log *slog.Logger
	nc  *client.NATSClient

	leftInputStreamName  string
	rightInputStreamName string
	outputStream         string
	joinCfg              models.JoinComponentConfig
	schemaMapper         schema.Mapper

	component component.Component
	c         chan error
	doneCh    chan struct{}
}

func NewJoinRunner(log *slog.Logger, nc *client.NATSClient, leftInputStreamName, rightInputStreamName string, outputStream string, joinCfg models.JoinComponentConfig, schemaMapper schema.Mapper) *JoinRunner {
	return &JoinRunner{
		nc:  nc,
		log: log,

		leftInputStreamName:  leftInputStreamName,
		rightInputStreamName: rightInputStreamName,
		outputStream:         outputStream,
		joinCfg:              joinCfg,
		schemaMapper:         schemaMapper,

		component: nil,
	}
}

func (j *JoinRunner) Start(ctx context.Context) error {
	var mapper schema.JsonToClickHouseMapper

	j.doneCh = make(chan struct{})
	j.c = make(chan error, 1)

	switch sm := j.schemaMapper.(type) {
	case *schema.JsonToClickHouseMapper:
		mapper = *sm
	default:
		j.log.ErrorContext(ctx, "unsupported schema mapper")
		return fmt.Errorf("unsupported schema mapper")
	}

	if len(mapper.Streams) == 0 {
		j.log.ErrorContext(ctx, "setup joiner: length of streams must not be 0")
		return fmt.Errorf("setup joiner: length of streams must not be 0")
	}

	var (
		leftConsumer    jetstream.Consumer
		rightConsumer   jetstream.Consumer
		leftBuffer      kv.KeyValueStore
		rightBuffer     kv.KeyValueStore
		leftStreamName  string
		rightStreamName string
		err             error
	)

	leftStreamName = mapper.GetLeftStream()
	rightStreamName = mapper.GetRightStream()

	leftConsumer, err = stream.NewNATSConsumer(
		ctx,
		j.nc.JetStream(),
		jetstream.ConsumerConfig{
			Name:          j.joinCfg.NATSLeftConsumerName,
			Durable:       j.joinCfg.NATSLeftConsumerName,
			FilterSubject: models.GetWildcardNATSSubjectName(j.leftInputStreamName),
			AckPolicy:     jetstream.AckAllPolicy,
			AckWait:       internal.NatsDefaultAckWait,
			MaxAckPending: -1,
		},
		j.leftInputStreamName,
	)
	if err != nil {
		j.log.ErrorContext(ctx, "failed to create left consumer", "left_stream", j.leftInputStreamName, "error", err)
		return fmt.Errorf("create left consumer: %w", err)
	}

	rightConsumer, err = stream.NewNATSConsumer(
		ctx,
		j.nc.JetStream(),
		jetstream.ConsumerConfig{
			Name:          j.joinCfg.NATSRightConsumerName,
			Durable:       j.joinCfg.NATSRightConsumerName,
			FilterSubject: models.GetWildcardNATSSubjectName(j.rightInputStreamName),
			AckPolicy:     jetstream.AckAllPolicy,
			AckWait:       internal.NatsDefaultAckWait,
			MaxAckPending: -1,
		},
		j.rightInputStreamName,
	)
	if err != nil {
		j.log.ErrorContext(ctx, "failed to create right consumer", "right_stream", j.rightInputStreamName, "error", err)
		return fmt.Errorf("create right consumer: %w", err)
	}

	// Get existing KV stores (created by orchestrator)
	leftKVStore, err := j.nc.GetKeyValueStore(ctx, j.leftInputStreamName)
	if err != nil {
		j.log.ErrorContext(ctx, "failed to get left stream buffer: ", "error", err)
		return fmt.Errorf("get left buffer: %w", err)
	}

	rightKVStore, err := j.nc.GetKeyValueStore(ctx, j.rightInputStreamName)
	if err != nil {
		j.log.ErrorContext(ctx, "failed to get right stream buffer: ", "error", err)
		return fmt.Errorf("get right buffer: %w", err)
	}

	// Wrap the NATS KeyValue stores in our interface
	leftBuffer = &kv.NATSKeyValueStore{KVstore: leftKVStore}
	rightBuffer = &kv.NATSKeyValueStore{KVstore: rightKVStore}

	resultsPublisher := stream.NewNATSPublisher(j.nc.JetStream(), stream.PublisherConfig{
		Subject: models.GetNATSSubjectNameDefault(j.outputStream),
	})

	component, err := component.NewJoinComponent(
		j.joinCfg,
		leftConsumer,
		rightConsumer,
		resultsPublisher,
		j.schemaMapper,
		leftBuffer,
		rightBuffer,
		leftStreamName,
		rightStreamName,
		j.doneCh,
		j.log,
	)
	if err != nil {
		j.log.ErrorContext(ctx, "failed to join: ", "error", err)
		return fmt.Errorf("create join: %w", err)
	}

	j.component = component

	go func() {
		component.Start(ctx, j.c)

		close(j.c)

		for err := range j.c {
			j.log.ErrorContext(ctx, "Error in the join component", "error", err)
		}
	}()

	return nil
}

func (j *JoinRunner) Shutdown() {
	j.log.Info("Shutting down JoinRunner")
	if j.component != nil {
		j.component.Stop(component.WithNoWait(true))
	}
}

// Done returns a channel that signals when the component stops by itself
func (j *JoinRunner) Done() <-chan struct{} {
	return j.doneCh
}
