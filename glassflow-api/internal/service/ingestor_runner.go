package service

import (
	"context"
	"fmt"
	"log/slog"
	"sync"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/client"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/operator"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/schema"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/stream"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

type IngestorRunner struct {
	nc  *client.NATSClient
	log *slog.Logger

	running map[string]operator.Operator
	wg      sync.WaitGroup
}

func NewIngestorRunner(log *slog.Logger, nc *client.NATSClient) *IngestorRunner {
	return &IngestorRunner{
		nc:  nc,
		log: log,

		running: make(map[string]operator.Operator),
		wg:      sync.WaitGroup{},
	}
}

func (i *IngestorRunner) Start(ctx context.Context, topicName string, natsStreamName string, pipelineCfg models.PipelineConfig, schemaMapper schema.Mapper) error {
	if topicName == "" {
		return fmt.Errorf("topic name cannot be empty")
	}

	streamPublisher := stream.NewNATSPublisher(
		i.nc.JetStream(),
		stream.PublisherConfig{
			Subject: natsStreamName + ".input",
		},
	)

	dlqStreamPublisher := stream.NewNATSPublisher(
		i.nc.JetStream(),
		stream.PublisherConfig{
			Subject: models.GetDLQStreamSubjectName(pipelineCfg.ID),
		},
	)

	ingestorOperator, err := operator.NewIngestorOperator(
		pipelineCfg.Ingestor,
		topicName,
		streamPublisher,
		dlqStreamPublisher,
		schemaMapper,
		i.log,
	)
	if err != nil {
		i.log.Error("failed to create ingestor operator: ", slog.Any("error", err))
		return fmt.Errorf("create ingestor: %w", err)
	}

	i.running[topicName] = ingestorOperator

	i.wg.Add(1)

	go func() {
		defer i.wg.Done()

		errCh := make(chan error, 1)
		ingestorOperator.Start(ctx, errCh)
		close(errCh)
		for err := range errCh {
			i.log.Error("error in ingestor operator", slog.Any("error", err), slog.String("topic", topicName))
		}
	}()

	return nil
}

func (i *IngestorRunner) Shutdown() {
	if len(i.running) == 0 {
		i.log.Info("No ingestor operators running, nothing to shutdown")
		return
	}

	for name, op := range i.running {
		i.log.Info("Shutting down ingestor operator", slog.String("name", name))
		op.Stop(operator.WithNoWait(true))
		delete(i.running, name)
	}

	i.wg.Wait()

	i.log.Info("Ingestor runner shutdown complete")
}
