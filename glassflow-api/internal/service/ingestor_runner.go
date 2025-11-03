package service

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/client"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/component"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/schema"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/sink_ingestor"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/pkg/observability"
)

type IngestorRunner struct {
	nc  *client.NATSClient
	log *slog.Logger

	topicName    string
	pipelineCfg  models.PipelineConfig
	schemaMapper schema.Mapper
	meter        *observability.Meter

	component     component.Component
	sinkIngestor  *sink_ingestor.KafkaClickHouseSinkIngestor
	c             chan error
	doneCh        chan struct{}
	useDirectSink bool
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

	var topicConfig models.KafkaTopicsConfig
	var outputStreamID string
	for _, topic := range i.pipelineCfg.Ingestor.KafkaTopics {
		if topic.Name == i.topicName {
			outputStreamID = topic.OutputStreamID
			topicConfig = topic
		}
	}

	i.log.DebugContext(ctx, "Starting ingestor", "pipelineId", i.pipelineCfg.Status.PipelineID, "streamId", outputStreamID)

	if outputStreamID == "" {
		i.log.ErrorContext(ctx, "output stream name cannot be empty", "topic_name", i.topicName)
		return fmt.Errorf("output stream name cannot be empty")
	}

	// Use direct Kafka->ClickHouse sink ingestor
	i.useDirectSink = true
	i.log.Info("Using direct Kafka->ClickHouse sink ingestor (bypassing NATS)")

	config := sink_ingestor.Config{
		KafkaConnection: i.pipelineCfg.Ingestor.KafkaConnectionParams,
		KafkaTopic:      topicConfig,
		ClickHouse:      i.pipelineCfg.Sink.ClickHouseConnectionParams,
		Batch:           i.pipelineCfg.Sink.Batch,
	}

	sinkIngestor, err := sink_ingestor.NewKafkaClickHouseSinkIngestor(
		config,
		i.schemaMapper,
		i.log,
		i.meter,
	)
	if err != nil {
		i.log.ErrorContext(ctx, "failed to create sink ingestor: ", "error", err)
		return fmt.Errorf("create sink ingestor: %w", err)
	}

	i.sinkIngestor = sinkIngestor

	go func() {
		defer close(i.doneCh)
		err := sinkIngestor.Start(ctx)
		if err != nil {
			i.log.ErrorContext(ctx, "error in sink ingestor", "error", err, "topic", i.topicName)
			i.c <- err
		}
		close(i.c)
	}()

	return nil
}

func (i *IngestorRunner) Shutdown() {
	i.log.Debug("Stopping ingestor", slog.String("pipelineId", i.pipelineCfg.Status.PipelineID), slog.String("topic", i.topicName))
	if i.useDirectSink && i.sinkIngestor != nil {
		i.sinkIngestor.Stop()
	} else if i.component != nil {
		i.component.Stop(component.WithNoWait(true))
	}
}

func (i *IngestorRunner) Done() <-chan struct{} {
	return i.doneCh
}
