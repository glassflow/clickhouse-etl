package service

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/client"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/component"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/schema"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/stream"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/pkg/observability"
)

type SinkRunner struct {
	nc  *client.NATSClient
	log *slog.Logger

	pipelineCfg  models.PipelineConfig
	schemaMapper schema.Mapper
	meter        *observability.Meter
	dlqPublisher stream.Publisher

	component component.Component
	c         chan error
	doneCh    chan struct{}
}

func NewSinkRunner(
	log *slog.Logger,
	nc *client.NATSClient,
	pipelineCfg models.PipelineConfig,
	schemaMapper schema.Mapper,
	meter *observability.Meter,
) *SinkRunner {
	return &SinkRunner{
		nc:  nc,
		log: log,

		pipelineCfg:  pipelineCfg,
		schemaMapper: schemaMapper,
		meter:        meter,

		component: nil,
	}
}

func (s *SinkRunner) Start(ctx context.Context) error {
	s.doneCh = make(chan struct{})
	s.c = make(chan error, 1)

	//nolint: exhaustruct // optional config
	consumer, err := stream.NewNATSConsumer(ctx, s.nc.JetStream(), stream.ConsumerConfig{
		NatsStream:   s.pipelineCfg.Sink.StreamID,
		NatsConsumer: s.pipelineCfg.Sink.NATSConsumerName,
		NatsSubject:  models.GetWildcardNATSSubjectName(s.pipelineCfg.Sink.StreamID),
	})
	if err != nil {
		s.log.ErrorContext(ctx, "failed to create clickhouse consumer", "error", err)
		return fmt.Errorf("create clickhouse consumer: %w", err)
	}

	dlqStreamPublisher := stream.NewNATSPublisher(
		s.nc.JetStream(),
		stream.PublisherConfig{
			Subject: models.GetDLQStreamSubjectName(s.pipelineCfg.ID),
		},
	)

	sinkComponent, err := component.NewSinkComponent(
		s.pipelineCfg.Sink,
		consumer,
		s.schemaMapper,
		s.doneCh,
		s.log,
		s.meter,
		dlqStreamPublisher,
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
