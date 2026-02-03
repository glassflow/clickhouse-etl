package service

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/client"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/component"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/configs"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/kv"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	schemav2 "github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/schema_v2"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/stream"
	"github.com/nats-io/nats.go/jetstream"
)

type JoinRunner struct {
	log *slog.Logger
	nc  *client.NATSClient
	cfg models.PipelineConfig
	db  PipelineStore

	component component.Component
	c         chan error
	doneCh    chan struct{}
}

func NewJoinRunner(log *slog.Logger, nc *client.NATSClient, pipelineCfg models.PipelineConfig, db PipelineStore) *JoinRunner {
	return &JoinRunner{
		nc:  nc,
		log: log,
		cfg: pipelineCfg,
		db:  db,

		component: nil,
	}
}

func (j *JoinRunner) Start(ctx context.Context) error {
	j.doneCh = make(chan struct{})
	j.c = make(chan error, 1)

	var (
		leftSource  models.JoinSourceConfig
		rightSource models.JoinSourceConfig

		leftConsumer  jetstream.Consumer
		rightConsumer jetstream.Consumer
		leftBuffer    kv.KeyValueStore
		rightBuffer   kv.KeyValueStore
		err           error
	)

	if len(j.cfg.Join.Sources) != 2 {
		return fmt.Errorf("join must have exactly 2 sources")
	}

	// Determine left and right streams based on orientation
	if j.cfg.Join.Sources[0].Orientation == "left" {
		leftSource = j.cfg.Join.Sources[0]
		rightSource = j.cfg.Join.Sources[1]
	} else {
		leftSource = j.cfg.Join.Sources[1]
		rightSource = j.cfg.Join.Sources[0]
	}

	if leftSource.StreamID == "" || rightSource.StreamID == "" {
		return fmt.Errorf("both left and right streams must be specified in join sources")
	}

	// Generate output stream name for joined data
	outputStream := j.cfg.Join.OutputStreamID

	leftConsumer, err = stream.NewNATSConsumer(
		ctx,
		j.nc.JetStream(),
		jetstream.ConsumerConfig{
			Name:          j.cfg.Join.NATSLeftConsumerName,
			Durable:       j.cfg.Join.NATSLeftConsumerName,
			FilterSubject: models.GetWildcardNATSSubjectName(leftSource.StreamID),
			AckPolicy:     jetstream.AckExplicitPolicy,
			AckWait:       internal.NatsDefaultAckWait,
			MaxAckPending: -1,
		},
		leftSource.SourceID,
	)
	if err != nil {
		j.log.ErrorContext(ctx, "failed to create left consumer", "left_stream", leftSource.SourceID, "error", err)
		return fmt.Errorf("create left consumer: %w", err)
	}

	rightConsumer, err = stream.NewNATSConsumer(
		ctx,
		j.nc.JetStream(),
		jetstream.ConsumerConfig{
			Name:          j.cfg.Join.NATSRightConsumerName,
			Durable:       j.cfg.Join.NATSRightConsumerName,
			FilterSubject: models.GetWildcardNATSSubjectName(rightSource.StreamID),
			AckPolicy:     jetstream.AckExplicitPolicy,
			AckWait:       internal.NatsDefaultAckWait,
			MaxAckPending: -1,
		},
		rightSource.SourceID,
	)
	if err != nil {
		j.log.ErrorContext(ctx, "failed to create right consumer", "right_stream", rightSource.SourceID, "error", err)
		return fmt.Errorf("create right consumer: %w", err)
	}

	// Get existing KV stores (created by orchestrator)
	leftKVStore, err := j.nc.GetKeyValueStore(ctx, leftSource.SourceID)
	if err != nil {
		j.log.ErrorContext(ctx, "failed to get left stream buffer: ", "error", err)
		return fmt.Errorf("get left buffer: %w", err)
	}

	rightKVStore, err := j.nc.GetKeyValueStore(ctx, rightSource.SourceID)
	if err != nil {
		j.log.ErrorContext(ctx, "failed to get right stream buffer: ", "error", err)
		return fmt.Errorf("get right buffer: %w", err)
	}

	// Wrap the NATS KeyValue stores in our interface
	leftBuffer = &kv.NATSKeyValueStore{KVstore: leftKVStore}
	rightBuffer = &kv.NATSKeyValueStore{KVstore: rightKVStore}

	leftSchema, err := schemav2.NewSchema(j.cfg.ID, leftSource.SourceID, j.db, nil)
	if err != nil {
		j.log.ErrorContext(ctx, "failed to create left schema mapper: ", "error", err)
		return fmt.Errorf("create left schema mapper: %w", err)
	}

	rightSchema, err := schemav2.NewSchema(j.cfg.ID, rightSource.SourceID, j.db, nil)
	if err != nil {
		j.log.ErrorContext(ctx, "failed to create right schema mapper: ", "error", err)
		return fmt.Errorf("create right schema mapper: %w", err)
	}

	resultsPublisher := stream.NewNATSPublisher(j.nc.JetStream(), stream.PublisherConfig{
		Subject: models.GetNATSSubjectNameDefault(outputStream),
	})

	component, err := component.NewJoinComponent(
		j.cfg.Join,
		leftConsumer,
		rightConsumer,
		resultsPublisher,
		leftSchema,
		rightSchema,
		configs.NewConfigStore(j.db, j.cfg.ID, ""),
		leftBuffer,
		rightBuffer,
		leftSource.StreamID,
		rightSource.StreamID,
		leftSource.JoinKey,
		rightSource.JoinKey,
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
