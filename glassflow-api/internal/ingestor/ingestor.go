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

type MessageProcessor interface {
	ProcessMessage(ctx context.Context, msg kafka.Message) error
}

type KafkaIngestor struct {
	consumer  kafka.Consumer
	processor MessageProcessor
	topic     models.KafkaTopicsConfig
	log       *slog.Logger
	meter     *observability.Meter
}

func NewKafkaIngestor(config models.IngestorComponentConfig, topicName string, natsPub, dlqPub stream.Publisher, schema schema.Mapper, log *slog.Logger, meter *observability.Meter) (*KafkaIngestor, error) {
	var topic models.KafkaTopicsConfig

	if topicName == "" {
		return nil, fmt.Errorf("topic not found")
	}

	for _, t := range config.KafkaTopics {
		if t.Name == topicName {
			// Topic found, proceed with initialization.
			log.Debug("Found topic for Kafka ingestor", slog.String("topic", t.Name), slog.String("id", t.ID))
			if t.Deduplication.Enabled {
				log.Info("Deduplication is enabled for topic", slog.String("topic", t.Name), slog.String("dedupKey", t.Deduplication.ID), slog.String("window", t.Deduplication.Window.String()))
			}
			topic = t
			break
		}
	}

	consumer, err := kafka.NewConsumer(config.KafkaConnectionParams, topic, log, meter)
	if err != nil {
		return nil, fmt.Errorf("failed to create Kafka consumer: %w", err)
	}

	return &KafkaIngestor{
		consumer:  consumer,
		processor: NewKafkaMsgProcessor(natsPub, dlqPub, schema, topic, log, meter),
		topic:     topic,
		log:       log,
		meter:     meter,
	}, nil
}

func (k *KafkaIngestor) Start(ctx context.Context) error {
	k.log.Info("Starting Kafka ingestor", slog.String("topic", k.topic.Name))

	// Pass self as processor - we implement MessageProcessor interface
	if err := k.consumer.Start(ctx, k.processor); err != nil {
		return fmt.Errorf("failed to start kafka consumer: %w", err)
	}
	return nil
}

func (k *KafkaIngestor) Stop() {
	k.log.Info("Stopping Kafka ingestor", slog.String("topic", k.topic.Name))

	if err := k.consumer.Close(); err != nil {
		k.log.Error("failed to close Kafka consumer", slog.Any("error", err))
	}

	k.log.Info("Kafka ingestor stopped")
}
