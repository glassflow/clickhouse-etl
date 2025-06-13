package service

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/client"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/operator"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/schema"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/sink"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/stream"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

type SinkRunner struct {
	nc  *client.NATSClient
	log *slog.Logger

	operator *operator.SinkOperator
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

func (s *SinkRunner) Start(ctx context.Context, consumerStream, consumerSubject string, cfg models.ClickhouseConfig, schemaMapper schema.Mapper) error {
	//nolint: exhaustruct // optional config
	consumer, err := stream.NewNATSConsumer(ctx, s.nc.JetStream(), stream.ConsumerConfig{
		NatsStream:   consumerStream,
		NatsConsumer: "clickhouse-consumer",
		NatsSubject:  consumerSubject,
	})
	if err != nil {
		return fmt.Errorf("create clickhouse consumer: %w", err)
	}

	chClient, err := client.NewClickHouseClient(
		ctx,
		client.ClickHouseClientConfig{
			Host:      cfg.Host,
			Port:      cfg.Port,
			Username:  cfg.Username,
			Secure:    cfg.Secure,
			Password:  cfg.Password,
			Database:  cfg.Database,
			TableName: cfg.Table,
		},
	)
	if err != nil {
		return fmt.Errorf("create clickhouse client: %w", err)
	}

	sinkOperator, err := operator.NewSinkOperator(
		chClient,
		sink.ClickHouseSinkConfig{
			MaxBatchSize: cfg.MaxBatchSize,
			MaxDelayTime: cfg.MaxDelayTime,
		},
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
