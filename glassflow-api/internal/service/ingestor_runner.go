package service

import (
	"context"
	"fmt"
	"log/slog"
	"strings"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/client"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/component"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/componentsignals"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	sr "github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/schema_registry"
	schemav2 "github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/schema_v2"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/stream"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/pkg/observability"
)

type IngestorRunner struct {
	nc  *client.NATSClient
	log *slog.Logger

	topicName   string
	pipelineCfg models.PipelineConfig
	db          PipelineStore
	runtimeCfg  models.IngestorRuntimeConfig
	meter       *observability.Meter

	component component.Component
	c         chan error
	doneCh    chan struct{}
}

func NewIngestorRunner(
	log *slog.Logger,
	nc *client.NATSClient,
	topicName string,
	pipelineCfg models.PipelineConfig,
	db PipelineStore,
	runtimeCfg models.IngestorRuntimeConfig,
	meter *observability.Meter,
) *IngestorRunner {
	return &IngestorRunner{
		nc:  nc,
		log: log,

		topicName:   topicName,
		pipelineCfg: pipelineCfg,
		db:          db,
		runtimeCfg:  runtimeCfg,
		meter:       meter,

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

	topicCfg, err := i.getTopicConfig()
	if err != nil {
		i.log.ErrorContext(ctx, "failed to resolve ingestor topic config", "topic_name", i.topicName, "error", err)
		return fmt.Errorf("resolve ingestor topic config: %w", err)
	}

	outputSubject := strings.TrimSpace(i.runtimeCfg.OutputSubject)
	if outputSubject == "" {
		return fmt.Errorf("ingestor runtime output subject is required")
	}

	if topicCfg.Deduplication.Enabled {
		if strings.TrimSpace(i.runtimeCfg.DedupSubjectPrefix) == "" {
			return fmt.Errorf("ingestor runtime dedup subject prefix is required when deduplication is enabled")
		}
		if i.runtimeCfg.DedupSubjectCount <= 0 {
			return fmt.Errorf("ingestor runtime dedup subject count must be > 0 when deduplication is enabled")
		}
	}

	dlqSubject := models.GetDLQStreamSubjectName(i.pipelineCfg.ID)
	var srClient schemav2.SchemaRegistryClient
	if topicCfg.SchemaRegistryConfig.URL != "" {
		srClient, err = sr.NewSchemaRegistryClient(topicCfg.SchemaRegistryConfig)
		if err != nil {
			i.log.ErrorContext(ctx, "failed to create schema registry client", "error", err)
			return fmt.Errorf("create schema registry client: %w", err)
		}
	}

	i.log.InfoContext(ctx, "Ingestor will write to NATS subject",
		"subject", outputSubject,
		"pipelineId", i.pipelineCfg.Status.PipelineID,
		"topic", i.topicName,
	)
	i.log.InfoContext(ctx, "Ingestor will write failed events to DLQ subject",
		"dlq_subject", dlqSubject,
		"pipelineId", i.pipelineCfg.Status.PipelineID,
	)
	if topicCfg.Deduplication.Enabled {
		i.log.InfoContext(ctx, "Ingestor will route messages by dedup key to subjects",
			"prefix", i.runtimeCfg.DedupSubjectPrefix,
			"subject_count", i.runtimeCfg.DedupSubjectCount)
	}

	streamPublisher := stream.NewNATSPublisher(
		i.nc.JetStream(),
		stream.PublisherConfig{
			Subject: outputSubject,
		},
	)

	dlqStreamPublisher := stream.NewNATSPublisher(
		i.nc.JetStream(),
		stream.PublisherConfig{
			Subject: dlqSubject,
		},
	)

	signalPublisher, err := componentsignals.NewPublisher(i.nc)
	if err != nil {
		return fmt.Errorf("create component signal publisher: %w", err)
	}

	schema, err := schemav2.NewSchema(
		i.pipelineCfg.Status.PipelineID,
		i.topicName,
		i.db,
		srClient,
	)
	if err != nil {
		return fmt.Errorf("create schema for ingestor: %w", err)
	}

	component, err := component.NewIngestorComponent(
		i.pipelineCfg,
		i.topicName,
		i.runtimeCfg,
		streamPublisher,
		dlqStreamPublisher,
		schema,
		signalPublisher,
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

func (i *IngestorRunner) getTopicConfig() (models.KafkaTopicsConfig, error) {
	for _, topic := range i.pipelineCfg.Ingestor.KafkaTopics {
		if topic.Name == i.topicName {
			return topic, nil
		}
	}

	return models.KafkaTopicsConfig{}, fmt.Errorf("topic %q not found in ingestor config", i.topicName)
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
