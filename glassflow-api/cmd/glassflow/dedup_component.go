package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"

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

// getOutputSubjectFromEnv returns the NATS subject to publish to.
// When GLASSFLOW_POD_INDEX and NATS_SUBJECT_PREFIX are set, subject is "NATS_SUBJECT_PREFIX.GLASSFLOW_POD_INDEX".
// Otherwise it falls back to the default subject derived from outputStreamID (same logic as ingestor).
func getOutputSubjectFromEnv(outputStreamID string) string {
	prefix := os.Getenv("NATS_SUBJECT_PREFIX")
	podIndex := os.Getenv("GLASSFLOW_POD_INDEX")
	if prefix != "" && podIndex != "" {
		return fmt.Sprintf("%s.%s", prefix, podIndex)
	}
	return models.GetNATSSubjectNameDefault(outputStreamID)
}

// getInputStreamNameFromEnv returns the NATS stream name to consume from.
// When GLASSFLOW_POD_INDEX and NATS_INPUT_STREAM_PREFIX are set, stream name is "NATS_INPUT_STREAM_PREFIX_GLASSFLOW_POD_INDEX".
// Otherwise it falls back to the pipeline-derived input stream ID (same logic as sink).
func getInputStreamNameFromEnv(fallbackStreamID string) string {
	prefix := os.Getenv("NATS_INPUT_STREAM_PREFIX")
	podIndex := os.Getenv("GLASSFLOW_POD_INDEX")
	if prefix != "" && podIndex != "" {
		return fmt.Sprintf("%s_%s", prefix, podIndex)
	}
	return fallbackStreamID
}

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

	// Input: read from stream (env-based when NATS_INPUT_STREAM_PREFIX and GLASSFLOW_POD_INDEX are set)
	inputStreamID := topicConfig.OutputStreamID
	if inputStreamID == "" {
		return fmt.Errorf("output stream ID not set for topic %s", cfg.DedupTopic)
	}
	inputStreamName := getInputStreamNameFromEnv(inputStreamID)
	log.InfoContext(ctx, "Dedup/transform will read from NATS stream", "stream", inputStreamName, "pipeline_id", pipelineCfg.ID)

	// Output: write to dedup-specific output stream
	// This stream will be consumed by either sink or join
	outputStreamID := models.GetDedupOutputStreamName(pipelineCfg.ID, cfg.DedupTopic)

	if outputStreamID == "" {
		return fmt.Errorf("output stream ID could not be determined")
	}

	// Output subject: same as ingestor when NATS_SUBJECT_PREFIX and GLASSFLOW_POD_INDEX are set
	outputSubject := getOutputSubjectFromEnv(outputStreamID)
	log.InfoContext(ctx, "Dedup/transform will write to NATS subject", "subject", outputSubject, "pipeline_id", pipelineCfg.ID)

	batchSize := internal.DefaultDedupComponentBatchSize
	maxWait := internal.DefaultDedupMaxWaitTime

	// Calculate pending publishes limit
	pendingPublishesLimit := min(internal.PublisherMaxPendingAcks, internal.NATSMaxBufferedMsgs)

	// MaxAckPending for dedup consumer: 4x sink batch size (avoids NATS default 100 when using -1)
	maxAckPending := pipelineCfg.Sink.Batch.MaxBatchSize * 4
	if maxAckPending < 1 {
		maxAckPending = 1
	}

	log.InfoContext(ctx, "Starting deduplicator",
		slog.String("topic", cfg.DedupTopic),
		slog.String("pipeline_id", pipelineCfg.ID),
		slog.String("input_stream", inputStreamName),
		slog.String("output_stream", outputStreamID),
		slog.Duration("ttl", topicConfig.Deduplication.Window.Duration()),
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
		outputSubject,
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
) (*processor.StreamingComponent, error) {
	role := internal.RoleDeduplicator

	dedupProcessor, err := dedupProcessorFromConfig(pipelineConfig, cfg, meter)
	if err != nil {
		return nil, fmt.Errorf("dedupProcessorFromConfig: %w", err)
	}

	statelessTransformerProcessorBase, err := statelessProcessorFromConfig(pipelineConfig, meter)
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

func statelessProcessorFromConfig(config models.PipelineConfig, meter *observability.Meter) (processor.Processor, error) {
	if !config.StatelessTransformation.Enabled {
		return &processor.NoopProcessor{}, nil
	}

	transformer, err := json.NewTransformer(config.StatelessTransformation.Config.Transform)
	if err != nil {
		return nil, fmt.Errorf("create stateless transformer: %w", err)
	}

	statelessTransformerProcessorBase := processor.NewStatelessTransformerProcessor(transformer, meter)

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
	meter *observability.Meter,
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

	return processor.NewDedupProcessor(badgerDedup, meter), nil
}
