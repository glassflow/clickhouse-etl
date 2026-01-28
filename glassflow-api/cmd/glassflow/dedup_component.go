package main

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/dgraph-io/badger/v4"
	"github.com/nats-io/nats.go/jetstream"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/batch"
	batchNats "github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/batch/nats"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/client"
	badgerDeduplication "github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/deduplication/badger"
	filterJSON "github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/filter/json"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/processor"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/stream"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/transformer/json"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/pkg/observability"
)

func mainDeduplicatorV2(
	ctx context.Context,
	nc *client.NATSClient,
	cfg *config,
	log *slog.Logger,
	meter *observability.Meter,
) error {
	if cfg.DedupTopic == "" {
		return fmt.Errorf("deduplicator topic must be specified via GLASSFLOW_DEDUP_TOPIC")
	}

	pipelineCfg, err := getPipelineConfigFromJSON(cfg.PipelineConfig)
	if err != nil {
		return fmt.Errorf("failed to get pipeline config: %w", err)
	}

	var topicConfig *models.KafkaTopicsConfig
	for i, topic := range pipelineCfg.Ingestor.KafkaTopics {
		if topic.Name == cfg.DedupTopic {
			topicConfig = &pipelineCfg.Ingestor.KafkaTopics[i]
			break
		}
	}

	if topicConfig == nil {
		return fmt.Errorf("topic %s not found in pipeline config", cfg.DedupTopic)
	}

	// Input: read from ingestor's output stream
	inputStreamID := topicConfig.OutputStreamID
	if inputStreamID == "" {
		return fmt.Errorf("output stream ID not set for topic %s", cfg.DedupTopic)
	}

	// Output: write to dedup-specific output stream
	// This stream will be consumed by either sink or join
	outputStreamID := models.GetDedupOutputStreamName(pipelineCfg.ID, cfg.DedupTopic)

	if outputStreamID == "" {
		return fmt.Errorf("output stream ID could not be determined")
	}

	batchSize := internal.DefaultDedupComponentBatchSize
	maxWait := internal.DefaultDedupMaxWaitTime

	// Calculate pending publishes limit
	pendingPublishesLimit := min(internal.PublisherMaxPendingAcks, internal.NATSMaxBufferedMsgs)

	log.InfoContext(ctx, "Starting deduplicator",
		slog.String("topic", cfg.DedupTopic),
		slog.String("pipeline_id", pipelineCfg.ID),
		slog.String("input_stream", inputStreamID),
		slog.String("output_stream", outputStreamID),
		slog.Duration("ttl", topicConfig.Deduplication.Window.Duration()),
		slog.Int("batch_size", batchSize),
		slog.Duration("max_wait", maxWait),
		slog.Int("pending_publishes_limit", pendingPublishesLimit))

	consumerName := models.GetNATSDedupConsumerName(pipelineCfg.ID)
	consumer, err := stream.NewNATSConsumer(
		ctx,
		nc.JetStream(),
		jetstream.ConsumerConfig{
			Name:          consumerName,
			Durable:       consumerName,
			FilterSubject: models.GetWildcardNATSSubjectName(inputStreamID),
			AckPolicy:     jetstream.AckExplicitPolicy,
			AckWait:       internal.NatsDefaultAckWait,
			MaxAckPending: -1,
		},
		inputStreamID,
	)
	if err != nil {
		log.ErrorContext(ctx, "failed to create deduplication consumer", "error", err)
		return fmt.Errorf("create deduplication consumer: %w", err)
	}

	batchReader := batchNats.NewBatchReader(consumer)

	batchWriter := batchNats.NewBatchWriter(
		nc.JetStream(),
		models.GetNATSSubjectNameDefault(outputStreamID),
	)

	dlqWriter := batchNats.NewBatchWriter(
		nc.JetStream(),
		models.GetDLQStreamSubjectName(pipelineCfg.ID),
	)

	component, err := NewDedupComponent(
		batchReader,
		batchWriter,
		dlqWriter,
		log,
		pipelineCfg,
		cfg,
		meter,
	)
	if err != nil {
		return fmt.Errorf("create dedup component: %w", err)
	}

	usageStatsClient := newUsageStatsClient(cfg, log, nil)

	return runWithGracefulShutdown(
		ctx,
		component,
		log,
		internal.RoleDeduplicator,
		usageStatsClient,
	)
}

func NewDedupComponent(
	reader batch.BatchReader,
	writer batch.BatchWriter,
	dlqWriter batch.BatchWriter,
	log *slog.Logger,
	pipelineConfig models.PipelineConfig,
	cfg *config,
	meter *observability.Meter,
) (*processor.Component, error) {
	role := internal.RoleDeduplicator

	dedupProcessor, err := dedupProcessorFromConfig(pipelineConfig, cfg)
	if err != nil {
		return nil, fmt.Errorf("dedupProcessorFromConfig: %w", err)
	}

	statelessTransformerProcessorBase, err := statelessProcessorFromConfig(pipelineConfig)
	if err != nil {
		return nil, err
	}

	statelessTransformerProcessor := processor.ChainProcessors(
		processor.ChainMiddlewares(processor.DLQMiddleware(dlqWriter, role)),
		statelessTransformerProcessorBase,
	)

	filterProcessorBase, err := filterProcessorFromConfig(pipelineConfig, meter)
	if err != nil {
		return nil, err
	}
	filterProcessor := processor.ChainProcessors(
		processor.ChainMiddlewares(processor.DLQMiddleware(dlqWriter, role)),
		filterProcessorBase,
	)

	return processor.NewComponent(
		reader,
		writer,
		dlqWriter,
		log,
		role,
		// execution depends on order in this slice
		[]processor.Processor{
			filterProcessor,
			dedupProcessor,
			statelessTransformerProcessor,
		},
	), nil
}

func statelessProcessorFromConfig(config models.PipelineConfig) (processor.Processor, error) {
	if !config.StatelessTransformation.Enabled {
		return &processor.NoopProcessor{}, nil
	}

	transformer, err := json.NewTransformer(config.StatelessTransformation.Config.Transform)
	if err != nil {
		return nil, fmt.Errorf("create stateless transformer: %w", err)
	}

	statelessTransformerProcessorBase := processor.NewStatelessTransformerProcessor(transformer)

	return statelessTransformerProcessorBase, nil
}

func filterProcessorFromConfig(
	config models.PipelineConfig,
	meter *observability.Meter,
) (processor.Processor, error) {
	if !config.Filter.Enabled {
		return &processor.NoopProcessor{}, nil
	}

	filterJson, err := filterJSON.New(config.Filter.Expression, config.Filter.Enabled)
	if err != nil {
		return nil, fmt.Errorf("failed to create filter component: %w", err)
	}

	return processor.NewFilterProcessor(filterJson, meter), nil

}

func dedupProcessorFromConfig(
	config models.PipelineConfig,
	cfg *config,
) (processor.Processor, error) {
	var topicConfig *models.KafkaTopicsConfig
	for i, topic := range config.Ingestor.KafkaTopics {
		if topic.Name == cfg.DedupTopic {
			topicConfig = &config.Ingestor.KafkaTopics[i]
			break
		}
	}
	if topicConfig == nil {
		return nil, fmt.Errorf("topic %s not found in pipeline config", cfg.DedupTopic)
	}

	if !topicConfig.Deduplication.Enabled {
		return &processor.NoopProcessor{}, nil
	}

	badgerOpts := badger.DefaultOptions("/data/badger").
		WithLogger(nil)

	db, err := badger.Open(badgerOpts)
	if err != nil {
		return nil, fmt.Errorf("open BadgerDB: %w", err)
	}

	ttl := topicConfig.Deduplication.Window.Duration()
	badgerDedup := badgerDeduplication.NewDeduplicator(db, ttl)

	return processor.NewDedupProcessor(badgerDedup), nil
}
