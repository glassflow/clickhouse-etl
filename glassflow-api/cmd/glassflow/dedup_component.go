package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"strconv"

	"github.com/dgraph-io/badger/v4"
	"github.com/nats-io/nats.go/jetstream"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/batch"
	batchNats "github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/batch/nats"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/client"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/componentsignals"
	badgerDeduplication "github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/deduplication/badger"
	filterJSON "github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/filter/json"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/processor"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/storage"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/stream"
	subjectrouter "github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/subject/router"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/transformer/versioned"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/pkg/observability"
)

func mainDeduplicatorV2(
	ctx context.Context,
	nc *client.NATSClient,
	cfg *config,
	log *slog.Logger,
) error {

	pipelineCfg, err := getPipelineConfigFromJSON(cfg.PipelineConfig)
	if err != nil {
		return fmt.Errorf("failed to get pipeline config: %w", err)
	}

	if pipelineCfg.ID == "" {
		return fmt.Errorf("pipeline ID is empty")
	}

	observability.SetPipelineID(pipelineCfg.ID)

	dedupCfg, err := getDeduplicationCfgFromPipelineConfig(pipelineCfg, cfg.DedupTopic)
	if err != nil {
		return fmt.Errorf("failed to get deduplication config from pipeline config: %w", err)
	}

	inputStreamName, err := getInputStreamNameFromEnv()
	if err != nil {
		return err
	}
	log.InfoContext(ctx, "Dedup/transform will read from NATS stream", "stream", inputStreamName, "pipeline_id", pipelineCfg.ID)

	outputRouter, err := getOutputRouterFromEnv()
	if err != nil {
		return err
	}
	log.InfoContext(
		ctx,
		"Dedup/transform will write to NATS subject",
		"pipeline_id",
		pipelineCfg.ID,
		"subject",
		outputRouter.Config().OutputSubject,
	)

	batchSize := internal.DefaultDedupComponentBatchSize
	maxWait := internal.DefaultDedupMaxWaitTime

	pendingPublishesLimit := min(internal.PublisherMaxPendingAcks, internal.NATSMaxBufferedMsgs)

	// MaxAckPending for dedup consumer: 4x sink batch size (avoids NATS default 100 when using -1)
	maxAckPending := pipelineCfg.Sink.Batch.MaxBatchSize * 4
	if maxAckPending < 1 {
		maxAckPending = 1
	}

	dlqSubjectRouter, err := subjectrouter.New(
		models.RoutingConfig{
			OutputSubject: models.GetDLQStreamSubjectName(pipelineCfg.ID),
			Type:          models.RoutingTypeName,
		})
	if err != nil {
		return err
	}

	log.InfoContext(ctx, "Starting deduplicator",
		slog.String("source", sourceLabel(cfg.DedupTopic)),
		slog.String("pipeline_id", pipelineCfg.ID),
		slog.String("input_stream", inputStreamName),
		slog.String("output_subject_prefix", outputRouter.Config().OutputSubject),
		slog.String("dlq_subject", dlqSubjectRouter.Config().OutputSubject),
		slog.Duration("ttl", dedupCfg.Window.Duration()),
		slog.Int("batch_size", batchSize),
		slog.Duration("max_wait", maxWait),
		slog.Int("pending_publishes_limit", pendingPublishesLimit),
		slog.Int("max_ack_pending", maxAckPending))

	consumerName := models.GetNATSDedupConsumerName(pipelineCfg.ID)
	consumer, err := stream.NewNATSConsumer(
		ctx,
		nc.JetStream(),
		jetstream.ConsumerConfig{
			Name:          consumerName,
			Durable:       consumerName,
			AckPolicy:     jetstream.AckExplicitPolicy,
			AckWait:       internal.NatsDefaultAckWait,
			MaxAckPending: maxAckPending,
		},
		inputStreamName,
	)
	if err != nil {
		log.ErrorContext(ctx, "failed to create deduplication consumer", "error", err)
		return fmt.Errorf("create deduplication consumer: %w", err)
	}

	batchReader := batchNats.NewBatchReader(consumer)

	batchWriter := batchNats.NewBatchWriter(
		nc.JetStream(),
		outputRouter,
	)

	dlqWriter := batchNats.NewBatchWriter(
		nc.JetStream(),
		dlqSubjectRouter,
	)

	componentSignal, err := componentsignals.NewPublisher(nc)
	if err != nil {
		log.ErrorContext(ctx, "failed to create component signal", "error", err)
		return fmt.Errorf("create component signal: %w", err)
	}

	component, err := NewDedupComponent(
		ctx,
		batchReader,
		batchWriter,
		dlqWriter,
		log,
		pipelineCfg,
		cfg,
		componentSignal,
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
	ctx context.Context,
	reader batch.BatchReader,
	writer batch.BatchWriter,
	dlqWriter batch.BatchWriter,
	log *slog.Logger,
	pipelineConfig models.PipelineConfig,
	cfg *config,
	componentSignalPublisher *componentsignals.ComponentSignalPublisher,
) (*processor.StreamingComponent, error) {
	role := internal.RoleDeduplicator

	dedupProcessor, err := dedupProcessorFromConfig(pipelineConfig, cfg)
	if err != nil {
		return nil, fmt.Errorf("dedupProcessorFromConfig: %w", err)
	}

	statelessTransformerProcessorBase, err := statelessTransformerProcessorFromConfig(
		ctx,
		pipelineConfig,
		cfg,
		componentSignalPublisher,
		log,
	)
	if err != nil {
		return nil, err
	}

	statelessTransformerProcessor := processor.ChainProcessors(
		processor.ChainMiddlewares(processor.DLQMiddleware(dlqWriter, role)),
		statelessTransformerProcessorBase,
	)

	filterProcessorBase, err := filterProcessorFromConfig(pipelineConfig)
	if err != nil {
		return nil, err
	}
	filterProcessor := processor.ChainProcessors(
		processor.ChainMiddlewares(processor.DLQMiddleware(dlqWriter, role)),
		filterProcessorBase,
	)

	return processor.NewStreamingComponent(
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

func statelessTransformerProcessorFromConfig(
	ctx context.Context,
	config models.PipelineConfig,
	cfg *config,
	componentSignalPublisher *componentsignals.ComponentSignalPublisher,
	log *slog.Logger,
) (processor.Processor, error) {
	if !config.StatelessTransformation.Enabled {
		return &processor.NoopProcessor{}, nil
	}

	encryptionKey, err := loadEncryptionKey(cfg, log)
	if err != nil {
		return nil, fmt.Errorf("load encryption key: %w", err)
	}

	db, err := storage.NewPipelineStore(ctx, cfg.DatabaseURL, log, encryptionKey, internal.RoleDeduplicator)
	if err != nil {
		return nil, fmt.Errorf("create postgres store for pipelines: %w", err)
	}
	transformer := versioned.New(
		db,
		componentSignalPublisher,
		config.ID,
		config.StatelessTransformation.SourceID,
	)

	return processor.NewStatelessTransformerProcessor(transformer), nil
}

func filterProcessorFromConfig(
	config models.PipelineConfig,
) (processor.Processor, error) {
	if !config.Filter.Enabled {
		return &processor.NoopProcessor{}, nil
	}

	filterJson, err := filterJSON.New(config.Filter.Expression, config.Filter.Enabled)
	if err != nil {
		return nil, fmt.Errorf("failed to create filter component: %w", err)
	}

	return processor.NewFilterProcessor(filterJson), nil
}

func dedupProcessorFromConfig(
	config models.PipelineConfig,
	cfg *config,
) (processor.Processor, error) {
	dedupCfg, err := getDeduplicationCfgFromPipelineConfig(config, cfg.DedupTopic)
	if err != nil {
		return nil, fmt.Errorf("failed to get deduplication config from pipeline config: %w", err)
	}

	badgerOpts := badger.DefaultOptions("/data/badger").
		WithLogger(nil)

	db, err := badger.Open(badgerOpts)
	if err != nil {
		return nil, fmt.Errorf("open BadgerDB: %w", err)
	}

	ttl := dedupCfg.Window.Duration()
	badgerDedup := badgerDeduplication.NewDeduplicator(db, ttl)

	return processor.NewDedupProcessor(badgerDedup), nil
}

// getOutputRouterFromEnv builds a subject router from NATS_SUBJECT_PREFIX, GLASSFLOW_POD_INDEX,
// and optional NATS_SUBJECT_TOTAL_COUNT / NATS_PUBLISHER_REPLICA_COUNT.
// When multiple subjects are assigned to this pod, a round-robin router is returned.
func getOutputRouterFromEnv() (*subjectrouter.Router, error) {
	prefix, err := models.GetRequiredEnvVar("NATS_SUBJECT_PREFIX")
	if err != nil {
		return nil, err
	}

	podIndexStr, err := models.GetRequiredEnvVar("GLASSFLOW_POD_INDEX")
	if err != nil {
		return nil, err
	}

	podIndex, err := strconv.Atoi(podIndexStr)
	if err != nil {
		return nil, fmt.Errorf("parse GLASSFLOW_POD_INDEX: %w", err)
	}

	totalSubjects := 1
	if raw := os.Getenv("NATS_SUBJECT_TOTAL_COUNT"); raw != "" {
		n, parseErr := strconv.Atoi(raw)
		if parseErr != nil || n <= 0 {
			return nil, fmt.Errorf("invalid NATS_SUBJECT_TOTAL_COUNT=%q: must be a positive integer", raw)
		}
		totalSubjects = n
	}

	if totalSubjects > 1 {
		return subjectrouter.New(models.RoutingConfig{
			OutputSubject: prefix,
			SubjectCount:  totalSubjects,
			Type:          models.RoutingTypeRoundRobin,
		})
	}

	return subjectrouter.New(models.RoutingConfig{
		OutputSubject: prefix,
		SubjectCount:  podIndex,
		Type:          models.RoutingTypePodIndex,
		PodIndex:      &models.RoutingConfigFieldPodIndex{Index: podIndex},
	})
}

// getInputStreamNameFromEnv returns the NATS stream name to consume from.
func getInputStreamNameFromEnv() (string, error) {
	prefix, err := models.GetRequiredEnvVar("NATS_INPUT_STREAM_PREFIX")
	if err != nil {
		return "", err
	}

	podIndex, err := models.GetRequiredEnvVar("GLASSFLOW_POD_INDEX")
	if err != nil {
		return "", err
	}

	if prefix == "" || podIndex == "" {
		return "", fmt.Errorf("stream prefix and pod index is required")
	}

	return fmt.Sprintf("%s_%s", prefix, podIndex), nil
}

func getDeduplicationCfgFromPipelineConfig(config models.PipelineConfig, topicName string) (*models.DeduplicationConfig, error) {
	if topicName == "" {
		if config.OTLPSource.Deduplication.Enabled {
			return &config.OTLPSource.Deduplication, nil
		}
		return nil, fmt.Errorf("deduplication config not found for OTLP source")
	}

	for i, topic := range config.Ingestor.KafkaTopics {
		if topic.Name == topicName {
			return &config.Ingestor.KafkaTopics[i].Deduplication, nil
		}
	}
	return nil, fmt.Errorf("deduplication config not found for topic %s", topicName)
}

func sourceLabel(topicName string) string {
	if topicName == "" {
		return "otlp"
	}
	return topicName
}
