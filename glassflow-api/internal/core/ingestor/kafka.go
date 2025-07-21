package ingestor

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"sync"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/kafka"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/schema"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/stream"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"

	"github.com/IBM/sarama"
	"github.com/nats-io/nats.go"
)

type KafkaIngestor struct {
	consumer     kafka.Consumer
	publisher    stream.Publisher
	schemaMapper schema.Mapper

	topic models.KafkaTopicsConfig

	mu            sync.Mutex
	isClosed      bool
	ctxCancelFunc context.CancelFunc

	log *slog.Logger
}

func NewKafkaIngestor(config models.IngestorOperatorConfig, topicName string, natsPub stream.Publisher, schema schema.Mapper, log *slog.Logger) (*KafkaIngestor, error) {
	var topic models.KafkaTopicsConfig

	if topicName == "" {
		return nil, fmt.Errorf("topic not found")
	}

	for _, t := range config.KafkaTopics {
		if t.Name == topicName {
			// Topic found, proceed with initialization.
			log.Debug("Found topic for Kafka ingestor", "topic", t.Name, "id", t.ID)
			topic = t
			break
		}
	}

	consumer, err := kafka.NewConsumer(config.KafkaConnectionParams, topic)
	if err != nil {
		return nil, fmt.Errorf("failed to create Kafka consumer: %w", err)
	}

	return &KafkaIngestor{
		consumer:      consumer,
		publisher:     natsPub,
		schemaMapper:  schema,
		isClosed:      false,
		topic:         topic,
		mu:            sync.Mutex{},
		log:           log,
		ctxCancelFunc: nil,
	}, nil
}

func (k *KafkaIngestor) processMsg(ctx context.Context, msg kafka.Message) {
	nMsg := nats.NewMsg(k.publisher.GetSubject())
	nMsg.Data = msg.Value

	nMsg.Header = k.convertKafkaToNATSHeaders(msg.Headers)

	if k.topic.Deduplication.Enabled {
		if err := k.setupDeduplicationHeader(nMsg.Header, msg.Value, k.topic.Deduplication.ID); err != nil {
			k.log.Error("Failed to setup deduplication header",
				slog.Any("error", err),
				slog.String("topic", k.topic.Name),
				slog.String("dedupKey", k.topic.Deduplication.ID),
				slog.String("subject", string(msg.Value)),
			)
			return
		}
	}

	err := k.publisher.PublishNatsMsg(ctx, nMsg)
	if err != nil {
		k.log.Error("Failed to publish message to NATS",
			slog.Any("error", err),
			slog.String("topic", k.topic.Name),
			slog.String("subject", k.publisher.GetSubject()),
		)
		return
	}

	err = k.consumer.Commit(ctx, msg)
	if err != nil {
		k.log.Error("Failed to commit Kafka message",
			slog.Any("error", err),
			slog.String("topic", k.topic.Name),
			slog.String("partition", fmt.Sprint(msg.Partition)),
			slog.Int64("offset", msg.Offset),
		)
		return
	}
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

	headers.Set("Nats-Msg-Id", fmt.Sprintf("%v", keyValue))

	return nil
}

func (k *KafkaIngestor) Start(ctx context.Context) error {
	cancelCtx, cancelFunc := context.WithCancel(ctx)
	k.ctxCancelFunc = cancelFunc

	k.log.Info("Starting Kafka ingestor", slog.String("topic", k.topic.Name))

	for {
		msg, err := k.consumer.Fetch(cancelCtx)
		if err != nil {
			if errors.Is(err, cancelCtx.Err()) {
				return nil
			}

			return fmt.Errorf("failed to fetch message: %w", err)
		}

		k.log.Debug("Received message from Kafka",
			slog.String("topic", msg.Topic),
			slog.String("partition", fmt.Sprint(msg.Partition)),
			slog.Int64("offset", msg.Offset),
			slog.String("key", string(msg.Key)),
		)

		k.processMsg(cancelCtx, msg)

		if k.isClosed {
			break
		}
	}

	return nil
}

func (k *KafkaIngestor) Stop() {
	k.mu.Lock()
	defer k.mu.Unlock()

	if k.isClosed {
		k.log.Debug("Kafka ingestor is already stopped.")
		return
	}

	k.isClosed = true

	if k.ctxCancelFunc != nil {
		k.ctxCancelFunc()
	}

	if err := k.consumer.Close(); err != nil {
		k.log.Error("failed to close Kafka consumer", slog.Any("error", err))
	}

	k.log.Info("Kafka ingestor stopped")
}
