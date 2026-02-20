package service

import (
	"context"
	"fmt"
	"log/slog"
	"os"

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

// getIngestorOutputSubject returns the NATS subject the ingestor publishes to.
// When POD_INDEX and NATS_SUBJECT_PREFIX are set, subject is "NATS_SUBJECT_PREFIX.POD_INDEX".
// Otherwise it falls back to the default subject derived from outputStreamID.
func getIngestorOutputSubject(outputStreamID string) string {
	prefix := os.Getenv("NATS_SUBJECT_PREFIX")
	podIndex := os.Getenv("POD_INDEX")
	if prefix != "" && podIndex != "" {
		return fmt.Sprintf("%s.%s", prefix, podIndex)
	}
	return models.GetNATSSubjectNameDefault(outputStreamID)
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

	outputSubject := getIngestorOutputSubject(outputStreamID)
	i.log.InfoContext(ctx, "Ingestor will write to NATS subject", "subject", outputSubject, "pipelineId", i.pipelineCfg.Status.PipelineID, "topic", i.topicName)

	streamPublisher := stream.NewNATSPublisher(
		i.nc.JetStream(),
		stream.PublisherConfig{
			Subject: outputSubject,
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
