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
)

type SinkRunner struct {
	nc  *client.NATSClient
	log *slog.Logger

	component component.Component
	c         chan error
}

func NewSinkRunner(log *slog.Logger, nc *client.NATSClient) *SinkRunner {
	return &SinkRunner{
		nc:  nc,
		log: log,

		component: nil,
		c:         make(chan error, 1),
	}
}

func (s *SinkRunner) Start(ctx context.Context, inputNatsStream string, sinkCfg models.SinkComponentConfig, schemaMapper schema.Mapper) error {
	//nolint: exhaustruct // optional config
	consumer, err := stream.NewNATSConsumer(ctx, s.nc.JetStream(), stream.ConsumerConfig{
		NatsStream:   inputNatsStream,
		NatsConsumer: "clickhouse-consumer",
		NatsSubject:  models.GetNATSSubjectName(inputNatsStream),
	})
	if err != nil {
		return fmt.Errorf("create clickhouse consumer: %w", err)
	}

	SinkComponent, err := component.NewSinkComponent(
		sinkCfg,
		consumer,
		schemaMapper,
		s.log,
	)
	if err != nil {
		s.log.Error("failed to create ClickHouse sink: ", slog.Any("error", err))
		return fmt.Errorf("create sink: %w", err)
	}

	s.component = SinkComponent

	go func() {
		SinkComponent.Start(ctx, s.c)
		close(s.c)
		for err := range s.c {
			s.log.Error("Error in the sink component", slog.Any("error", err))
		}
	}()

	return nil
}

func (s *SinkRunner) Shutdown() {
	if s.component != nil {
		s.component.Stop()
	}
}
