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
)

type IngestorRunner struct {
	nc  *client.NATSClient
	log *slog.Logger

	topicName   string
	pipelineCfg models.PipelineConfig
	db          PipelineStore
	runtimeCfg  models.IngestorRuntimeConfig

	component component.Component
	c         chan error
	doneCh    chan struct{}

	samplerCancel context.CancelFunc
}

func NewIngestorRunner(
	log *slog.Logger,
	nc *client.NATSClient,
	topicName string,
	pipelineCfg models.PipelineConfig,
	db PipelineStore,
	runtimeCfg models.IngestorRuntimeConfig,
) *IngestorRunner {
	return &IngestorRunner{
		nc:  nc,
		log: log,

		topicName:   topicName,
		pipelineCfg: pipelineCfg,
		db:          db,
		runtimeCfg:  runtimeCfg,

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
		topicCfg.ID,
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
	)
	if err != nil {
		i.log.ErrorContext(ctx, "failed to create ingestor component: ", "error", err)
		return fmt.Errorf("create ingestor: %w", err)
	}

	i.component = component

	i.startStreamSamplers(ctx)

	go func() {
		component.Start(ctx, i.c)
		close(i.c)
		for err := range i.c {
			i.log.ErrorContext(ctx, "error in ingestor component", "error", err, "topic", i.topicName)
		}
	}()

	return nil
}

// startStreamSamplers resolves the streams the ingestor publishes into from
// its runtime config, then spawns one StreamSampler per unique stream. Each
// sampler runs until samplerCancel is called from Shutdown.
//
// Subjects map onto streams differently across orchestrators (local: one
// stream covers all sharded subjects; K8s: one stream per replica), so the
// stream set is discovered via JetStream's StreamNameBySubject rather than
// inferred from naming conventions.
func (i *IngestorRunner) startStreamSamplers(ctx context.Context) {
	subjects := ingestorOutputSubjects(i.runtimeCfg)
	if len(subjects) == 0 {
		return
	}

	samplerCtx, cancel := context.WithCancel(ctx)
	i.samplerCancel = cancel

	js := i.nc.JetStream()
	streams := make(map[string]struct{}, len(subjects))
	for _, subj := range subjects {
		name, err := js.StreamNameBySubject(samplerCtx, subj)
		if err != nil {
			i.log.WarnContext(ctx, "stream sampler: skipping subject (no stream bound)",
				slog.String("subject", subj),
				slog.Any("error", err))
			continue
		}
		streams[name] = struct{}{}
	}

	for name := range streams {
		s := stream.NewStreamSampler(js, name, i.log)
		go s.Run(samplerCtx)
		i.log.InfoContext(ctx, "stream sampler started",
			slog.String("stream", name),
			slog.String("pipeline_id", i.pipelineCfg.Status.PipelineID))
	}
}

// ingestorOutputSubjects returns every distinct subject the ingestor will
// publish to under the given runtime config.
func ingestorOutputSubjects(c models.IngestorRuntimeConfig) []string {
	if c.DedupSubjectCount > 0 && c.DedupSubjectPrefix != "" {
		out := make([]string, c.DedupSubjectCount)
		for i := range out {
			out[i] = fmt.Sprintf("%s.%d", c.DedupSubjectPrefix, i)
		}
		return out
	}
	if c.TotalSubjectCount > 1 && c.OutputSubjectPrefix != "" {
		out := make([]string, c.TotalSubjectCount)
		for i := range out {
			out[i] = fmt.Sprintf("%s.%d", c.OutputSubjectPrefix, i)
		}
		return out
	}
	if c.OutputSubject == "" {
		return nil
	}
	return []string{c.OutputSubject}
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
	if i.samplerCancel != nil {
		i.samplerCancel()
		i.samplerCancel = nil
	}
	if i.component != nil {
		i.component.Stop(component.WithNoWait(true))
	}
}

func (i *IngestorRunner) Done() <-chan struct{} {
	return i.doneCh
}
