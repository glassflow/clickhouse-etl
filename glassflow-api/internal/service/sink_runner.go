package service

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/client"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/schema"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/sink"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/stream"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

type SinkRunner struct {
	nc  *client.NATSClient
	log *slog.Logger

	operator *sink.ClickHouseSink
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

func (s *SinkRunner) Start(ctx context.Context, consumerStream, consumerSubject string, cfg models.ClickhouseConfig, schemaMapper *schema.Mapper) error {
	//nolint: exhaustruct // optional config
	consumer, err := stream.NewConsumer(ctx, s.nc.JetStream(), stream.ConsumerConfig{
		NatsStream:   consumerStream,
		NatsConsumer: "clickhouse-consumer",
		NatsSubject:  consumerSubject,
	})
	if err != nil {
		return fmt.Errorf("create clickhouse consumer: %w", err)
	}

	clickhouseSink, err := sink.NewClickHouseSink(ctx, sink.ConnectorConfig{
		Host:      cfg.Host,
		Port:      cfg.Port,
		Username:  cfg.Username,
		Secure:    cfg.Secure,
		Password:  cfg.Password,
		Database:  cfg.Database,
		TableName: cfg.Table,
	}, sink.BatchConfig{
		MaxBatchSize: cfg.MaxBatchSize,
	},
		consumer,
		schemaMapper,
		s.log,
	)
	if err != nil {
		s.log.Error("failed to create ClickHouse sink: ", slog.Any("error", err))
		return fmt.Errorf("create sink: %w", err)
	}

	s.operator = clickhouseSink

	go func() {
		clickhouseSink.Start(ctx, s.c)
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
