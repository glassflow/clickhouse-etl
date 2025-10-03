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

	inputNatsStream string
	sinkCfg         models.SinkComponentConfig
	schemaMapper    schema.Mapper
	meter           *observability.Meter

	component component.Component
	c         chan error
	doneCh    chan struct{}
}

func NewSinkRunner(log *slog.Logger, nc *client.NATSClient, inputNatsStream string, sinkCfg models.SinkComponentConfig, schemaMapper schema.Mapper, meter *observability.Meter) *SinkRunner {
	return &SinkRunner{
		nc:  nc,
		log: log,

		inputNatsStream: inputNatsStream,
		sinkCfg:         sinkCfg,
		schemaMapper:    schemaMapper,
		meter:           meter,

		component: nil,
	}
}

func (s *SinkRunner) Start(ctx context.Context) error {
	s.doneCh = make(chan struct{})
	s.c = make(chan error, 1)

	//nolint: exhaustruct // optional config
	consumer, err := stream.NewNATSConsumer(ctx, s.nc.JetStream(), stream.ConsumerConfig{
		NatsStream:   s.inputNatsStream,
		NatsConsumer: s.sinkCfg.NATSConsumerName,
		NatsSubject:  models.GetWildcardNATSSubjectName(s.inputNatsStream),
	})
	if err != nil {
		s.log.ErrorContext(ctx, "failed to create clickhouse consumer", "error", err)
		return fmt.Errorf("create clickhouse consumer: %w", err)
	}

	sinkComponent, err := component.NewSinkComponent(
		s.sinkCfg,
		consumer,
		s.schemaMapper,
		s.doneCh,
		s.log,
		s.meter,
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
