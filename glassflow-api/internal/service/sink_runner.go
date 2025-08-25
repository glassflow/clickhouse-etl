package service

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/client"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/operator"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/schema"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/stream"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

type SinkRunner struct {
	nc  *client.NATSClient
	log *slog.Logger

	operator operator.Operator
	c        chan error
}

func NewSinkRunner(log *slog.Logger, nc *client.NATSClient) *SinkRunner {
	return &SinkRunner{
		nc:  nc,
		log: log,

		operator: nil,
		c:        make(chan error, 1),
	}
}

func (s *SinkRunner) Start(ctx context.Context, inputNatsStream string, cfg models.SinkOperatorConfig, schemaMapper schema.Mapper) error {
	//nolint: exhaustruct // optional config
	consumer, err := stream.NewNATSConsumer(ctx, s.nc.JetStream(), stream.ConsumerConfig{
		NatsStream:   inputNatsStream,
		NatsConsumer: "clickhouse-consumer",
		NatsSubject:  models.GetNATSSubjectName(inputNatsStream),
	})
	if err != nil {
		return fmt.Errorf("create clickhouse consumer: %w", err)
	}

	sinkOperator, err := operator.NewSinkOperator(
		cfg,
		consumer,
		schemaMapper,
		s.log,
	)
	if err != nil {
		s.log.Error("failed to create ClickHouse sink: ", slog.Any("error", err))
		return fmt.Errorf("create sink: %w", err)
	}

	s.operator = sinkOperator

	go func() {
		sinkOperator.Start(ctx, s.c)
		close(s.c)
		for err := range s.c {
			s.log.Error("Error in sink operator", slog.Any("error", err))
		}
	}()

	return nil
}

func (s *SinkRunner) Shutdown() {
	if s.operator != nil {
		s.operator.Stop()
	}
}
