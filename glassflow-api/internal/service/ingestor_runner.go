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

type IngestorRunner struct {
	nc  *client.NATSClient
	log *slog.Logger

	component component.Component
	c         chan error
	doneCh    chan struct{}
}

func NewIngestorRunner(log *slog.Logger, nc *client.NATSClient) *IngestorRunner {
	return &IngestorRunner{
		nc:  nc,
		log: log,

		component: nil,
		c:         make(chan error, 1),
		doneCh:    make(chan struct{}),
	}
}

func (i *IngestorRunner) Start(ctx context.Context, topicName string, pipelineCfg models.PipelineConfig, schemaMapper schema.Mapper) error {
	if topicName == "" {
		return fmt.Errorf("topic name cannot be empty")
	}

	var outputStreamID string
	for _, topic := range pipelineCfg.Ingestor.KafkaTopics {
		if topic.Name == topicName {
			outputStreamID = topic.OutputStreamID
		}
	}

	if outputStreamID == "" {
		return fmt.Errorf("output stream name cannot be empty")
	}

	streamPublisher := stream.NewNATSPublisher(
		i.nc.JetStream(),
		stream.PublisherConfig{
			Subject: models.GetNATSSubjectName(outputStreamID),
		},
	)

	dlqStreamPublisher := stream.NewNATSPublisher(
		i.nc.JetStream(),
		stream.PublisherConfig{
			Subject: models.GetDLQStreamSubjectName(pipelineCfg.ID),
		},
	)

	component, err := component.NewIngestorComponent(
		pipelineCfg.Ingestor,
		topicName,
		streamPublisher,
		dlqStreamPublisher,
		schemaMapper,
		i.doneCh,
		i.log,
	)
	if err != nil {
		i.log.Error("failed to create ingestor component: ", slog.Any("error", err))
		return fmt.Errorf("create ingestor: %w", err)
	}

	i.component = component

	go func() {
		component.Start(ctx, i.c)
		close(i.c)
		for err := range i.c {
			i.log.Error("error in ingestor component", slog.Any("error", err), slog.String("topic", topicName))
		}
	}()

	return nil
}

func (i *IngestorRunner) Shutdown() {
	if i.component != nil {
		i.component.Stop()
	}
}

func (i *IngestorRunner) Done() <-chan struct{} {
	return i.doneCh
}
