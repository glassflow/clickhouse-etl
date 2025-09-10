package ingestor

import (
	"context"
	"errors"
	"fmt"
	"log/slog"

	"github.com/IBM/sarama"
	"github.com/nats-io/nats.go"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/kafka"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/schema"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/stream"
)

var (
	ErrValidateSchema  = errors.New("failed to validate data")
	ErrDeduplicateData = errors.New("failed to deduplicate data")
)

type KafkaIngestor struct {
	consumer     kafka.Consumer
	publisher    stream.Publisher
	dlqPublisher stream.Publisher
	schemaMapper schema.Mapper

	topic models.KafkaTopicsConfig

	log *slog.Logger
}

func NewKafkaIngestor(config models.IngestorComponentConfig, topicName string, natsPub, dlqPub stream.Publisher, schema schema.Mapper, log *slog.Logger) (*KafkaIngestor, error) {
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

	consumer, err := kafka.NewConsumer(config.KafkaConnectionParams, topic, log)
	if err != nil {
		return nil, fmt.Errorf("failed to create Kafka consumer: %w", err)
	}

	return &KafkaIngestor{
		consumer:     consumer,
		publisher:    natsPub,
		dlqPublisher: dlqPub,
		schemaMapper: schema,
		topic:        topic,
		log:          log,
	}, nil
}

func (k *KafkaIngestor) PushMsgToDLQ(ctx context.Context, orgMsg []byte, err error) error {
	k.log.Error("Pushing message to DLQ", slog.Any("error", err), slog.String("topic", k.topic.Name))

	data, jsonErr := models.NewDLQMessage(internal.RoleIngestor, err.Error(), orgMsg).ToJSON()
	if jsonErr != nil {
		k.log.Error("Failed to convert DLQ message to JSON", slog.Any("error", jsonErr), slog.String("topic", k.topic.Name))
		return fmt.Errorf("failed to convert DLQ message to JSON: %w", jsonErr)
	}

	if dlqErr := k.dlqPublisher.Publish(ctx, data); dlqErr != nil {
		k.log.Error("Failed to publish message to DLQ", slog.Any("error", dlqErr), slog.String("topic", k.topic.Name))
		return fmt.Errorf("failed to publish to DLQ: %w", dlqErr)
	}

	return nil
}

func (k *KafkaIngestor) ProcessMessage(ctx context.Context, msg *sarama.ConsumerMessage) error {
	// Convert sarama message to internal format if needed for existing logic
	kafkaMsg := kafka.Message{
		Topic:     msg.Topic,
		Partition: msg.Partition,
		Offset:    msg.Offset,
		Key:       msg.Key,
		Value:     msg.Value,
		Headers:   convertSaramaToRecordHeaders(msg.Headers),
	}

	return k.processMsg(ctx, kafkaMsg)
}

func convertSaramaToRecordHeaders(headers []*sarama.RecordHeader) []sarama.RecordHeader {
	result := make([]sarama.RecordHeader, 0, len(headers))
	for _, h := range headers {
		if h != nil {
			result = append(result, *h)
		}
	}
	return result
}

func (k *KafkaIngestor) processMsg(ctx context.Context, msg kafka.Message) error {
	nMsg := nats.NewMsg(k.publisher.GetSubject())
	nMsg.Data = msg.Value

	nMsg.Header = k.convertKafkaToNATSHeaders(msg.Headers)

	err := k.schemaMapper.ValidateSchema(k.topic.Name, msg.Value)
	if err != nil {
		k.log.Error("Failed to validate data", slog.Any("error", err), slog.String("topic", k.topic.Name))
		if dlqErr := k.PushMsgToDLQ(ctx, msg.Value, ErrValidateSchema); dlqErr != nil {
			return fmt.Errorf("failed to push to DLQ: %w", dlqErr)
		}
		return nil // Continue processing (message will be auto-committed)
	}

	if k.topic.Deduplication.Enabled {
		k.log.Debug("Setting up deduplication header for message",
			slog.String("topic", k.topic.Name),
			slog.String("dedupKey", k.topic.Deduplication.ID),
			slog.String("subject", string(msg.Value)),
		)
		if err := k.setupDeduplicationHeader(nMsg.Header, msg.Value, k.topic.Deduplication.ID); err != nil {
			k.log.Error("Failed to setup deduplication header",
				slog.Any("error", err),
				slog.String("topic", k.topic.Name),
				slog.String("dedupKey", k.topic.Deduplication.ID),
				slog.String("subject", string(msg.Value)),
			)
			if dlqErr := k.PushMsgToDLQ(ctx, msg.Value, ErrDeduplicateData); dlqErr != nil {
				return fmt.Errorf("failed to push to DLQ: %w", dlqErr)
			}
			return nil
		}
	}

	err = k.publisher.PublishNatsMsg(ctx, nMsg, stream.WithUntilAck())
	if err != nil {
		k.log.Error("Failed to publish message to NATS",
			slog.Any("error", err),
			slog.String("topic", k.topic.Name),
			slog.String("subject", k.publisher.GetSubject()),
		)
		return fmt.Errorf("failed to publish to NATS: %w", err)
	}

	return nil
}

func (k *KafkaIngestor) convertKafkaToNATSHeaders(headers []sarama.RecordHeader) nats.Header {
	if len(headers) == 0 {
		return nats.Header{}
	}

	natsHeaders := make(nats.Header)

	for _, header := range headers {
		if header.Value != nil && len(header.Value) == 0 {
			natsHeaders.Add(string(header.Key), string(header.Value))
		}
	}

	return natsHeaders
}

func (k *KafkaIngestor) setupDeduplicationHeader(headers nats.Header, msgData []byte, dedupKey string) error {
	if dedupKey == "" {
		return nil // No deduplication required
	}

	keyValue, err := k.schemaMapper.GetKey(k.topic.Name, dedupKey, msgData)
	if err != nil {
		return fmt.Errorf("failed to get deduplication key: %w", err)
	}

	if keyValue == nil {
		return fmt.Errorf("deduplication key is nil for topic %s", k.topic.Name)
	}

	k.log.Debug("Setting deduplication header",
		slog.String("topic", k.topic.Name),
		slog.String("dedupKey", dedupKey),
		slog.Any("keyValue", keyValue),
	)

	headers.Set("Nats-Msg-Id", fmt.Sprintf("%v", keyValue))

	return nil
}

func (k *KafkaIngestor) Start(ctx context.Context) error {
	k.log.Info("Starting Kafka ingestor", slog.String("topic", k.topic.Name))

	// Pass self as processor - we implement MessageProcessor interface
	if err := k.consumer.Start(ctx, k); err != nil {
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
