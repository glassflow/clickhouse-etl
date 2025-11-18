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

type IngestorRunner struct {
	nc  *client.NATSClient
	log *slog.Logger

	topicName    string
	pipelineCfg  models.PipelineConfig
	schemaMapper schema.Mapper
	meter        *observability.Meter

	component component.Component
	c         chan error
	doneCh    chan struct{}
}

func NewIngestorRunner(log *slog.Logger, nc *client.NATSClient, topicName string, pipelineCfg models.PipelineConfig, schemaMapper schema.Mapper, meter *observability.Meter) *IngestorRunner {
	return &IngestorRunner{
		nc:  nc,
		log: log,

		topicName:    topicName,
		pipelineCfg:  pipelineCfg,
		schemaMapper: schemaMapper,
		meter:        meter,

		component: nil,
	}
}

func (i *IngestorRunner) Start(ctx context.Context) error {
	i.doneCh = make(chan struct{})
	i.c = make(chan error, 1)

	if i.topicName == "" {
		i.log.ErrorContext(ctx, "topic name cannot be empty")
		return fmt.Errorf("topic name cannot be empty")
	}

	var outputStreamID string
	for _, topic := range i.pipelineCfg.Ingestor.KafkaTopics {
		if topic.Name == i.topicName {
			outputStreamID = topic.OutputStreamID
		}
	}

	i.log.DebugContext(ctx, "Starting ingestor", "pipelineId", i.pipelineCfg.Status.PipelineID, "streamId", outputStreamID)

	if outputStreamID == "" {
		i.log.ErrorContext(ctx, "output stream name cannot be empty", "topic_name", i.topicName)
		return fmt.Errorf("output stream name cannot be empty")
	}

	streamPublisher := stream.NewNATSPublisher(
		i.nc.JetStream(),
		stream.PublisherConfig{
			Subject: models.GetNATSSubjectNameDefault(outputStreamID),
		},
	)

	dlqStreamPublisher := stream.NewNATSPublisher(
		i.nc.JetStream(),
		stream.PublisherConfig{
			Subject: models.GetDLQStreamSubjectName(i.pipelineCfg.ID),
		},
	)

	component, err := component.NewIngestorComponent(
		i.pipelineCfg,
		i.topicName,
		streamPublisher,
		dlqStreamPublisher,
		i.schemaMapper,
		i.doneCh,
		i.log,
		i.meter,
		i.nc.JetStream(),
	)
	if err != nil {
		i.log.ErrorContext(ctx, "failed to create ingestor component: ", "error", err)
		return fmt.Errorf("create ingestor: %w", err)
	}

	i.component = component

	go func() {
		component.Start(ctx, i.c)
		close(i.c)
		for err := range i.c {
			i.log.ErrorContext(ctx, "error in ingestor component", "error", err, "topic", i.topicName)
		}
	}()

	return nil
}

func (i *IngestorRunner) Shutdown() {
	i.log.Debug("Stopping ingestor", slog.String("pipelineId", i.pipelineCfg.Status.PipelineID), slog.String("topic", i.topicName))
	if i.component != nil {
		i.component.Stop(component.WithNoWait(true))
	}
}

func (i *IngestorRunner) Done() <-chan struct{} {
	return i.doneCh
}
