package service

import (
	"context"
	"fmt"
	"log/slog"
	"os"

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

	joinCfg      models.JoinComponentConfig
	schemaMapper schema.Mapper

	component component.Component
	c         chan error
	doneCh    chan struct{}
}

// getJoinInputStreamName returns the NATS stream name the join consumes from.
// When an explicit env var is set for a side (left/right), it is used directly.
// Otherwise it falls back to the stream ID from the pipeline config.
func getJoinInputStreamName(fallbackStreamID, envVarName string) string {
	streamName := os.Getenv(envVarName)
	if streamName != "" {
		return streamName
	}
	return fallbackStreamID
}

// getJoinOutputSubject returns the NATS subject the join publishes to.
// When GLASSFLOW_POD_INDEX and NATS_SUBJECT_PREFIX are set, subject is "NATS_SUBJECT_PREFIX.GLASSFLOW_POD_INDEX".
// Otherwise it falls back to the default subject derived from outputStreamID.
func getJoinOutputSubject(outputStreamID string) string {
	prefix := os.Getenv("NATS_SUBJECT_PREFIX")
	podIndex := os.Getenv("GLASSFLOW_POD_INDEX")
	if prefix != "" && podIndex != "" {
		return fmt.Sprintf("%s.%s", prefix, podIndex)
	}
	return models.GetNATSSubjectNameDefault(outputStreamID)
}

func getLeftRightInputStreamsFromJoinConfig(joinCfg models.JoinComponentConfig) (leftStream, rightStream string, err error) {
	if len(joinCfg.Sources) != 2 {
		return "", "", fmt.Errorf("join must have exactly 2 sources, got %d", len(joinCfg.Sources))
	}

	if joinCfg.Sources[0].Orientation == "left" {
		leftStream = joinCfg.Sources[0].StreamID
		rightStream = joinCfg.Sources[1].StreamID
	} else {
		leftStream = joinCfg.Sources[1].StreamID
		rightStream = joinCfg.Sources[0].StreamID
	}

	if leftStream == "" || rightStream == "" {
		return "", "", fmt.Errorf("both left and right streams must be specified in join sources")
	}

	return leftStream, rightStream, nil
}

func NewJoinRunner(log *slog.Logger, nc *client.NATSClient, joinCfg models.JoinComponentConfig, schemaMapper schema.Mapper) *JoinRunner {
	return &JoinRunner{
		nc:  nc,
		log: log,

		joinCfg:      joinCfg,
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

	leftInputFallback, rightInputFallback, err := getLeftRightInputStreamsFromJoinConfig(j.joinCfg)
	if err != nil {
		j.log.ErrorContext(ctx, "invalid join stream configuration", "error", err)
		return fmt.Errorf("resolve left/right join streams: %w", err)
	}

	if j.joinCfg.OutputStreamID == "" {
		return fmt.Errorf("join output stream ID cannot be empty")
	}

	leftInputStreamName := getJoinInputStreamName(leftInputFallback, "NATS_LEFT_INPUT_STREAM_PREFIX")
	rightInputStreamName := getJoinInputStreamName(rightInputFallback, "NATS_RIGHT_INPUT_STREAM_PREFIX")
	outputSubject := getJoinOutputSubject(j.joinCfg.OutputStreamID)
	j.log.InfoContext(ctx, "Join will read/write NATS resources",
		"left_input_stream", leftInputStreamName,
		"right_input_stream", rightInputStreamName,
		"output_subject", outputSubject)

	leftConsumer, err = stream.NewNATSConsumer(
		ctx,
		j.nc.JetStream(),
		jetstream.ConsumerConfig{
			Name:          j.joinCfg.NATSLeftConsumerName,
			Durable:       j.joinCfg.NATSLeftConsumerName,
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
			Name:          j.joinCfg.NATSRightConsumerName,
			Durable:       j.joinCfg.NATSRightConsumerName,
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
		leftStreamName,
		rightStreamName,
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
