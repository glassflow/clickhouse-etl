//go:build cgo
// +build cgo

package ingestor

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/kafka"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/schema"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/stream"
)

type KafkaIngestor struct {
	consumer     kafka.BatchedConsumer
	processor    kafka.MessageProcessor
	topic        models.KafkaTopicsConfig
	log          *slog.Logger
	useBatchMode bool
}

// NewKafkaIngestor creates a new  Kafka ingestor with optional batching
func NewKafkaIngestor(config models.IngestorComponentConfig, topicName string, natsPub, dlqPub stream.Publisher, schema schema.Mapper, log *slog.Logger, useBatchMode bool) (*KafkaIngestor, error) {
	var topic models.KafkaTopicsConfig

	if topicName == "" {
		return nil, fmt.Errorf("topic not found")
	}

	for _, t := range config.KafkaTopics {
		if t.Name == topicName {
			log.Debug("Found topic for Kafka ingestor", slog.String("topic", t.Name), slog.String("id", t.ID))
			if t.Deduplication.Enabled {
				log.Info("Deduplication is enabled for topic", slog.String("topic", t.Name), slog.String("dedupKey", t.Deduplication.ID), slog.String("window", t.Deduplication.Window.String()))
			}
			if useBatchMode {
				log.Info("Batch mode enabled", slog.String("topic", t.Name), slog.Int("batchSize", internal.DefaultKafkaBatchSize))
			}
			topic = t
			break
		}
	}

	consumer, err := kafka.NewBatchConsumer(config.KafkaConnectionParams, topic, log)
	if err != nil {
		return nil, fmt.Errorf("failed to create Kafka consumer: %w", err)
	}

	msgProcessor := NewKafkaMsgProcessor(natsPub, dlqPub, schema, topic, log)

	return &KafkaIngestor{
		consumer:     consumer,
		processor:    msgProcessor,
		topic:        topic,
		log:          log,
		useBatchMode: useBatchMode,
	}, nil
}

// Run starts the Kafka ingestor
func (k *KafkaIngestor) Start(ctx context.Context) error {
	k.log.Info("Starting Kafka ingestor", slog.String("topic", k.topic.Name), slog.Bool("batchMode", k.useBatchMode))

	if k.useBatchMode {
		err := k.consumer.StartBatch(ctx, k.processor, internal.DefaultKafkaBatchSize, internal.DefaultKafkaBatchTimeout)
		if err != nil {
			return fmt.Errorf("failed to start Kafka consumer in batch mode: %w", err)
		}

		return nil
	}

	err := k.consumer.Start(ctx, k.processor)
	if err != nil {
		return fmt.Errorf("failed to start Kafka consumer: %w", err)
	}

	return nil
}

// Close stops the Kafka ingestor
func (k *KafkaIngestor) Stop() {
	k.log.Info("Stopping Kafka ingestor", slog.String("topic", k.topic.Name))
	err := k.consumer.Close()
	if err != nil {
		k.log.Error("Failed to close Kafka consumer", slog.Any("error", err), slog.String("topic", k.topic.Name))
	}
}
