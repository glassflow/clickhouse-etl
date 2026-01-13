package main

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/dgraph-io/badger/v4"
	"github.com/nats-io/nats.go/jetstream"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/client"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/deduplication"
	badgerDeduplication "github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/deduplication/badger"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/stream"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/transformer/json"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/pkg/observability"

	batchNats "github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/batch/nats"
)

func mainDeduplicator(
	ctx context.Context,
	nc *client.NATSClient,
	cfg *config,
	log *slog.Logger,
	_ *observability.Meter,
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

	// Get batch configuration from sink
	batchSize := pipelineCfg.Sink.Batch.MaxBatchSize
	maxWait := pipelineCfg.Sink.Batch.MaxDelayTime.Duration()

	// Calculate pending publishes limit
	pendingPublishesLimit := min(internal.PublisherMaxPendingAcks, internal.NATSMaxBufferedMsgs/topicConfig.Replicas)

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
			AckPolicy:     jetstream.AckAllPolicy,
			AckWait:       internal.NatsDefaultAckWait,
			MaxAckPending: -1,
		},
		inputStreamID,
	)
	if err != nil {
		log.ErrorContext(ctx, "failed to create deduplication consumer", "error", err)
		return fmt.Errorf("create deduplication consumer: %w", err)
	}

	// Create deduplicator only if deduplication is enabled
	var badgerDedup deduplication.Dedup
	var db *badger.DB
	if topicConfig.Deduplication.Enabled {
		badgerOpts := badger.DefaultOptions("/data/badger").
			WithLogger(nil)

		db, err = badger.Open(badgerOpts)
		if err != nil {
			log.ErrorContext(ctx, "failed to open BadgerDB", "path", "/data/badger", "error", err)
			return fmt.Errorf("open BadgerDB: %w", err)
		}
		defer func() {
			if err := db.Close(); err != nil {
				log.ErrorContext(ctx, "failed to close BadgerDB", "error", err)
			}
		}()

		ttl := topicConfig.Deduplication.Window.Duration()
		badgerDedup = badgerDeduplication.NewDeduplicator(db, ttl)

		log.InfoContext(ctx, "Deduplication enabled",
			slog.Duration("ttl", ttl))
	}

	if !topicConfig.Deduplication.Enabled {
		log.InfoContext(ctx, "Deduplication disabled, running transformations only")
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

	// Create stateless transformer if enabled
	var statelessTransformer deduplication.StatelessTransformer
	if pipelineCfg.StatelessTransformation.Enabled {
		statelessTransformer, err = json.NewTransformer(pipelineCfg.StatelessTransformation.Config.Transform)
		if err != nil {
			return fmt.Errorf("create stateless transformer: %w", err)
		}

		log.InfoContext(ctx, "Stateless transformer enabled",
			slog.Int("transformations_count", len(pipelineCfg.StatelessTransformation.Config.Transform)))
	}

	dedupService, err := deduplication.NewDedupService(
		batchReader,
		batchWriter,
		dlqWriter,
		statelessTransformer,
		badgerDedup,
		log,
		batchSize,
		maxWait,
	)
	if err != nil {
		return fmt.Errorf("create deduplication service: %w", err)
	}

	return runWithGracefulShutdown(
		ctx,
		dedupService,
		log,
		internal.RoleDeduplicator,
	)
}
