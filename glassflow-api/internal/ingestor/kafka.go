package ingestor

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/kafka"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/schema"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/stream"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/pkg/observability"
)

type KafkaConsumer interface {
	Start(ctx context.Context, processor kafka.MessageProcessor) error
	Close() error
}

type KafkaIngestor struct {
	consumer  KafkaConsumer
	processor kafka.MessageProcessor
	topic     models.KafkaTopicsConfig
	log       *slog.Logger
}

// NewKafkaIngestor creates a new  Kafka ingestor with optional batching
func NewKafkaIngestor(config models.IngestorComponentConfig, topicName string, natsPub, dlqPub stream.Publisher, schema schema.Mapper, log *slog.Logger, meter *observability.Meter) (*KafkaIngestor, error) {
	var topic models.KafkaTopicsConfig

	if topicName == "" {
		return nil, fmt.Errorf("topic not found")
	}

	found := false
	for _, t := range config.KafkaTopics {
		if t.Name == topicName {
			log.Debug("Found topic for Kafka ingestor", slog.String("topic", t.Name), slog.String("id", t.ID))
			if t.Deduplication.Enabled {
				log.Info("Deduplication is enabled for topic", slog.String("topic", t.Name), slog.String("dedupKey", t.Deduplication.ID), slog.String("window", t.Deduplication.Window.String()))
			}
			topic = t
			found = true
			break
		}
	}

	if !found {
		return nil, fmt.Errorf("topic %s not found in ingestor config", topicName)
	}

	consumer, err := kafka.NewConsumer(config.KafkaConnectionParams, topic, log, meter)
	if err != nil {
		return nil, fmt.Errorf("failed to create Kafka consumer: %w", err)
	}

	msgProcessor := NewKafkaMsgProcessor(natsPub, dlqPub, schema, topic, log)

	return &KafkaIngestor{
		consumer:  consumer,
		processor: msgProcessor,
		topic:     topic,
		log:       log,
	}, nil
}

// Run starts the Kafka ingestor
func (k *KafkaIngestor) Start(ctx context.Context) error {
	k.log.Info("Starting Kafka ingestor", slog.String("topic", k.topic.Name))

	err := k.consumer.Start(ctx, k.processor)
	if err != nil {
		return fmt.Errorf("kafka consumer failed: %w", err)
	}

	return nil
}

// Close stops the Kafka ingestor
func (k *KafkaIngestor) Stop() {
	k.log.Info("Stopping Kafka ingestor", slog.String("topic", k.topic.Name))
	err := k.consumer.Close()
	if err != nil {
		k.log.Error("Failed to close kafka consumer", slog.Any("error", err), slog.String("topic", k.topic.Name))
	}
}
