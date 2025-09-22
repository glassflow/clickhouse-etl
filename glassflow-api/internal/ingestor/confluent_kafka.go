//go:build cgo
// +build cgo

package ingestor

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/kafka"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/schema"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/stream"
)

// ConfluentKafkaIngestor implements kafka ingestion using confluent-kafka-go with batching
type ConfluentKafkaIngestor struct {
	consumer     kafka.BatchedConsumer
	processor    kafka.MessageProcessor
	topic        models.KafkaTopicsConfig
	log          *slog.Logger
	useBatchMode bool
}

// NewConfluentKafkaIngestor creates a new Confluent Kafka ingestor with optional batching
func NewConfluentKafkaIngestor(config models.IngestorComponentConfig, topicName string, natsPub, dlqPub stream.Publisher, schema schema.Mapper, log *slog.Logger, useBatchMode bool) (*ConfluentKafkaIngestor, error) {
	var topic models.KafkaTopicsConfig

	if topicName == "" {
		return nil, fmt.Errorf("topic not found")
	}

	for _, t := range config.KafkaTopics {
		if t.Name == topicName {
			log.Debug("Found topic for Confluent Kafka ingestor", slog.String("topic", t.Name), slog.String("id", t.ID))
			if t.Deduplication.Enabled {
				log.Info("Deduplication is enabled for topic", slog.String("topic", t.Name), slog.String("dedupKey", t.Deduplication.ID), slog.String("window", t.Deduplication.Window.String()))
			}
			if useBatchMode {
				log.Info("Batch mode enabled", slog.String("topic", t.Name), slog.Int("batchSize", t.BatchSize), slog.String("batchTimeout", t.BatchTimeout.String()))
			}
			topic = t
			break
		}
	}

	consumer, err := kafka.NewConfluentBatchConsumer(config.KafkaConnectionParams, topic, log)
	if err != nil {
		return nil, fmt.Errorf("failed to create Confluent Kafka consumer: %w", err)
	}

	msgProcessor := NewKafkaMsgProcessor(natsPub, dlqPub, schema, topic, log)

	return &ConfluentKafkaIngestor{
		consumer:     consumer,
		processor:    msgProcessor,
		topic:        topic,
		log:          log,
		useBatchMode: useBatchMode,
	}, nil
}

// Run starts the Confluent Kafka ingestor
func (k *ConfluentKafkaIngestor) Start(ctx context.Context) error {
	k.log.Info("Starting Confluent Kafka ingestor", slog.String("topic", k.topic.Name), slog.Bool("batchMode", k.useBatchMode))

	if k.useBatchMode {
		batchSize := k.topic.BatchSize
		if batchSize <= 0 {
			batchSize = 10000 // Default batch size
		}

		batchTimeout := k.topic.BatchTimeout.Duration()
		if batchTimeout <= 0 {
			batchTimeout = 200 * time.Microsecond // Default timeout
		}

		return k.consumer.StartBatch(ctx, k.processor, batchSize, batchTimeout)
	}

	return k.consumer.Start(ctx, k.processor)
}

// Close stops the Confluent Kafka ingestor
func (k *ConfluentKafkaIngestor) Stop() {
	k.log.Info("Stopping Confluent Kafka ingestor", slog.String("topic", k.topic.Name))
	err := k.consumer.Close()
	if err != nil {
		k.log.Error("Failed to close Confluent Kafka consumer", slog.Any("error", err), slog.String("topic", k.topic.Name))
	}
}
