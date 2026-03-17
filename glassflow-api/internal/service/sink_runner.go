package service

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/nats-io/nats.go/jetstream"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/client"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/component"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/configs"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/mapper"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/stream"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/pkg/observability"
)

type SinkRunner struct {
	nc  *client.NATSClient
	log *slog.Logger

	pipelineCfg models.PipelineConfig
	db          PipelineStore
	meter       *observability.Meter

	component component.Component
	c         chan error
	doneCh    chan struct{}
}

// getSinkInputStreamNameFromEnv returns the NATS stream name the sink consumes from.
func getSinkInputStreamNameFromEnv() (string, error) {
	prefix, err := models.GetRequiredEnvVar("NATS_INPUT_STREAM_PREFIX")
	if err != nil {
		return "", err
	}
	podIndex, err := models.GetRequiredEnvVar("GLASSFLOW_POD_INDEX")
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%s_%s", prefix, podIndex), nil
}

// getSinkConsumerNameFromEnv returns sink consumer durable name derived from operator pipeline ID.
func getSinkConsumerNameFromEnv() (string, error) {
	pipelineID, err := models.GetRequiredEnvVar("GLASSFLOW_OTEL_PIPELINE_ID")
	if err != nil {
		return "", err
	}
	return models.GetNATSSinkConsumerName(pipelineID), nil
}

func NewSinkRunner(
	log *slog.Logger,
	nc *client.NATSClient,
	pipelineCfg models.PipelineConfig,
	db PipelineStore,
	meter *observability.Meter,
) *SinkRunner {
	return &SinkRunner{
		nc:  nc,
		log: log,

		pipelineCfg: pipelineCfg,
		db:          db,
		meter:       meter,

		component: nil,
	}
}

func (s *SinkRunner) Start(ctx context.Context) error {
	s.doneCh = make(chan struct{})
	s.c = make(chan error, 1)

	maxBatchSize := s.pipelineCfg.Sink.Batch.MaxBatchSize
	maxAckPending := maxBatchSize * 4

	s.log.InfoContext(ctx, "Setting MaxAckPending limit",
		"max_ack_pending", maxAckPending,
		"max_batch_size", maxBatchSize)

	inputStreamName, err := getSinkInputStreamNameFromEnv()
	if err != nil {
		return fmt.Errorf("resolve sink input stream from env: %w", err)
	}
	consumerName, err := getSinkConsumerNameFromEnv()
	if err != nil {
		return fmt.Errorf("resolve sink consumer name from env: %w", err)
	}
	s.log.InfoContext(ctx, "Sink will read from NATS stream", "stream", inputStreamName, "pipelineId", s.pipelineCfg.Status.PipelineID)

	dlqSubject := models.GetDLQStreamSubjectName(s.pipelineCfg.ID)
	s.log.InfoContext(ctx, "Sink will write failed events to DLQ subject",
		"dlq_subject", dlqSubject,
		"pipelineId", s.pipelineCfg.Status.PipelineID,
	)

	consumer, err := stream.NewNATSConsumer(
		ctx,
		s.nc.JetStream(),
		jetstream.ConsumerConfig{
			Name:          consumerName,
			Durable:       consumerName,
			AckPolicy:     jetstream.AckExplicitPolicy,
			AckWait:       internal.NatsDefaultAckWait,
			MaxAckPending: maxAckPending,
		},
		inputStreamName,
	)
	if err != nil {
		s.log.ErrorContext(ctx, "failed to create NATS sink consumer", "error", err)
		return fmt.Errorf("create NATS sink consumer: %w", err)
	}

	dlqStreamPublisher := stream.NewNATSPublisher(
		s.nc.JetStream(),
		stream.PublisherConfig{
			Subject: dlqSubject,
		},
	)

	var streamSourceID string
	if s.pipelineCfg.StatelessTransformation.Enabled {
		streamSourceID = s.pipelineCfg.StatelessTransformation.ID
	}

	sinkComponent, err := component.NewSinkComponent(
		s.pipelineCfg.Sink,
		consumer,
		mapper.NewKafkaToClickHouseMapper(),
		configs.NewConfigStore(s.db, s.pipelineCfg.ID, s.pipelineCfg.Sink.SourceID),
		s.doneCh,
		s.log,
		s.meter,
		dlqStreamPublisher,
		streamSourceID,
	)
	if err != nil {
		s.log.ErrorContext(ctx, "failed to create ClickHouse sink: ", "error", err)
		return fmt.Errorf("create sink: %w", err)
	}

	s.component = sinkComponent

	go func() {
		sinkComponent.Start(ctx, s.c)
		close(s.c)
		for err := range s.c {
			s.log.ErrorContext(ctx, "Error in the sink component", "error", err)
		}
	}()

	return nil
}

func (s *SinkRunner) Shutdown() {
	if s.component != nil {
		s.component.Stop(component.WithNoWait(true))
	}
}

// Done returns a channel that signals when the component stops by itself
func (s *SinkRunner) Done() <-chan struct{} {
	return s.doneCh
}
