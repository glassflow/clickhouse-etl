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
	log        *slog.Logger
	nc         *client.NATSClient
	pipelineID string

	joinCfg      models.JoinComponentConfig
	schemaMapper schema.Mapper

	component component.Component
	c         chan error
	doneCh    chan struct{}
}

func NewJoinRunner(log *slog.Logger, nc *client.NATSClient, pipelineConfig models.PipelineConfig, schemaMapper schema.Mapper) *JoinRunner {
	return &JoinRunner{
		nc:         nc,
		log:        log,
		pipelineID: pipelineConfig.ID,

		joinCfg:      pipelineConfig.Join,
		schemaMapper: schemaMapper,

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
		leftConsumer  jetstream.Consumer
		rightConsumer jetstream.Consumer
		leftBuffer    kv.KeyValueStore
		rightBuffer   kv.KeyValueStore
		err           error
	)

	leftInputStreamName, err := getJoinLeftInputStreamName()
	if err != nil {
		j.log.ErrorContext(ctx, "failed to resolve join left input stream", "error", err)
		return fmt.Errorf("resolve join left input stream: %w", err)
	}

	rightInputStreamName, err := getJoinRightInputStreamName()
	if err != nil {
		j.log.ErrorContext(ctx, "failed to resolve join right input stream", "error", err)
		return fmt.Errorf("resolve join right input stream: %w", err)
	}

	outputSubject, err := getJoinOutputSubject()
	if err != nil {
		j.log.ErrorContext(ctx, "failed to resolve join output subject", "error", err)
		return fmt.Errorf("resolve join output subject: %w", err)
	}

	// Mapper stream names are schema source IDs and are required for join-key extraction.
	leftSourceID := mapper.GetLeftStream()
	rightSourceID := mapper.GetRightStream()
	if leftSourceID == "" || rightSourceID == "" {
		return fmt.Errorf("join mapper stream names are required; got left=%q right=%q", leftSourceID, rightSourceID)
	}

	j.log.InfoContext(ctx, "Join will read/write NATS resources",
		"left_input_stream", leftInputStreamName,
		"right_input_stream", rightInputStreamName,
		"output_subject", outputSubject,
		"left_source", leftSourceID,
		"right_source", rightSourceID,
	)

	leftConsumer, err = stream.NewNATSConsumer(
		ctx,
		j.nc.JetStream(),
		jetstream.ConsumerConfig{
			Name:          models.GetNATSJoinLeftConsumerName(j.pipelineID),
			Durable:       models.GetNATSJoinLeftConsumerName(j.pipelineID),
			FilterSubject: models.GetWildcardNATSSubjectName(leftInputStreamName),
			AckPolicy:     jetstream.AckExplicitPolicy,
			AckWait:       internal.NatsDefaultAckWait,
			MaxAckPending: -1,
		},
		leftInputStreamName,
	)
	if err != nil {
		j.log.ErrorContext(ctx, "failed to create left consumer", "left_stream", leftInputStreamName, "error", err)
		return fmt.Errorf("create left consumer: %w", err)
	}

	rightConsumer, err = stream.NewNATSConsumer(
		ctx,
		j.nc.JetStream(),
		jetstream.ConsumerConfig{
			Name:          models.GetNATSJoinRightConsumerName(j.pipelineID),
			Durable:       models.GetNATSJoinRightConsumerName(j.pipelineID),
			FilterSubject: models.GetWildcardNATSSubjectName(rightInputStreamName),
			AckPolicy:     jetstream.AckExplicitPolicy,
			AckWait:       internal.NatsDefaultAckWait,
			MaxAckPending: -1,
		},
		rightInputStreamName,
	)
	if err != nil {
		j.log.ErrorContext(ctx, "failed to create right consumer", "right_stream", rightInputStreamName, "error", err)
		return fmt.Errorf("create right consumer: %w", err)
	}

	// Get existing KV stores (created by orchestrator)
	leftKVStore, err := j.nc.GetKeyValueStore(ctx, leftInputStreamName)
	if err != nil {
		j.log.ErrorContext(ctx, "failed to get left stream buffer: ", "error", err)
		return fmt.Errorf("get left buffer: %w", err)
	}

	rightKVStore, err := j.nc.GetKeyValueStore(ctx, rightInputStreamName)
	if err != nil {
		j.log.ErrorContext(ctx, "failed to get right stream buffer: ", "error", err)
		return fmt.Errorf("get right buffer: %w", err)
	}

	// Wrap the NATS KeyValue stores in our interface
	leftBuffer = &kv.NATSKeyValueStore{KVstore: leftKVStore}
	rightBuffer = &kv.NATSKeyValueStore{KVstore: rightKVStore}

	resultsPublisher := stream.NewNATSPublisher(j.nc.JetStream(), stream.PublisherConfig{
		Subject: outputSubject,
	})

	jComponent, err := component.NewJoinComponent(
		j.joinCfg,
		leftConsumer,
		rightConsumer,
		resultsPublisher,
		j.schemaMapper,
		leftBuffer,
		rightBuffer,
		leftSourceID,
		rightSourceID,
		j.doneCh,
		j.log,
	)
	if err != nil {
		j.log.ErrorContext(ctx, "failed to join: ", "error", err)
		return fmt.Errorf("create join: %w", err)
	}

	j.component = jComponent

	go func() {
		jComponent.Start(ctx, j.c)

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

// getJoinInputStreamName returns the NATS stream name the join consumes from.
func getJoinLeftInputStreamName() (string, error) {
	return models.GetRequiredEnvVar("NATS_LEFT_INPUT_STREAM_PREFIX")
}
func getJoinRightInputStreamName() (string, error) {
	return models.GetRequiredEnvVar("NATS_RIGHT_INPUT_STREAM_PREFIX")
}

// getJoinOutputSubject returns the NATS subject the join publishes to
func getJoinOutputSubject() (string, error) {
	prefix, err := models.GetRequiredEnvVar("NATS_SUBJECT_PREFIX")
	if err != nil {
		return "", err
	}

	podIndex, err := models.GetRequiredEnvVar("GLASSFLOW_POD_INDEX")
	if err != nil {
		return "", err
	}

	return fmt.Sprintf("%s.%s", prefix, podIndex), nil
}
