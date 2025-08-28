package ingestor

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strconv"
	"sync"
	"time"

	"github.com/IBM/sarama"
	"github.com/nats-io/nats.go"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/kafka"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/schema"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/stream"
)

const (
	initialRetryDelay = 500 * time.Millisecond
	maxRetryDelay     = 5 * time.Second
	maxRetryWait      = 10 * time.Minute
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

	mu            sync.Mutex
	isClosed      bool
	ctxCancelFunc context.CancelFunc

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
		consumer:      consumer,
		publisher:     natsPub,
		dlqPublisher:  dlqPub,
		schemaMapper:  schema,
		isClosed:      false,
		topic:         topic,
		mu:            sync.Mutex{},
		log:           log,
		ctxCancelFunc: nil,
	}, nil
}

func (k *KafkaIngestor) PushMsgToDLQ(ctx context.Context, orgMsg []byte, err error) {
	k.log.Error("Pushing message to DLQ", slog.Any("error", err), slog.String("topic", k.topic.Name))

	data, err := models.NewDLQMessage(models.RoleIngestor.String(), err.Error(), orgMsg).ToJSON()
	if err != nil {
		k.log.Error("Failed to convert DLQ message to JSON", slog.Any("error", err), slog.String("topic", k.topic.Name))
		return
	}

	if err := k.dlqPublisher.Publish(ctx, data); err != nil {
		k.log.Error("Failed to publish message to DLQ", slog.Any("error", err), slog.String("topic", k.topic.Name))
	}
}

func (k *KafkaIngestor) processMsg(ctx context.Context, msg kafka.Message) error {
	nMsg := nats.NewMsg(k.publisher.GetSubject())
	nMsg.Data = msg.Value

	nMsg.Header = k.convertKafkaToNATSHeaders(msg.Headers)

	err := k.schemaMapper.ValidateSchema(k.topic.Name, msg.Value)
	if err != nil {
		k.log.Error("Failed to validate data", slog.Any("error", err), slog.String("topic", k.topic.Name))
		k.PushMsgToDLQ(ctx, msg.Value, ErrValidateSchema)
		err = k.commitMsg(ctx, msg)
		if err != nil {
			return fmt.Errorf("failed to commit message to kafka: %w", err)
		}
		return nil
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
			k.PushMsgToDLQ(ctx, msg.Value, ErrDeduplicateData)
			err := k.commitMsg(ctx, msg)
			if err != nil {
				return fmt.Errorf("failed to commit message to kafka: %w", err)
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
		return fmt.Errorf("failed to publish message: %w", err)
	}

	err = k.commitMsg(ctx, msg)
	if err != nil {
		return fmt.Errorf("failed to commit message to kafka: %w", err)
	}

	return nil
}

func (k *KafkaIngestor) commitMsg(ctx context.Context, msg kafka.Message) error {
	if msg.Topic == "" || msg.Partition < 0 || msg.Offset < 0 {
		k.log.Error("Failed to commit messsage: invalid message parameters",
			slog.String("topic", msg.Topic),
			slog.String("partition", strconv.Itoa(int(msg.Partition))),
			slog.Int64("offset", msg.Offset),
		)

		return nil
	}

	if err := k.consumer.Commit(ctx, msg); err != nil {
		k.log.Error("Failed to commit Kafka message",
			slog.Any("error", err),
			slog.String("topic", msg.Topic),
			slog.String("partition", strconv.Itoa(int(msg.Partition))),
			slog.Int64("offset", msg.Offset),
		)
		return fmt.Errorf("failed to commit message: %w", err)
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
	cancelCtx, cancelFunc := context.WithCancel(ctx)
	k.ctxCancelFunc = cancelFunc

	k.log.Info("Starting Kafka ingestor", slog.String("topic", k.topic.Name))

	startTime := time.Now()
	retryDelay := initialRetryDelay

	for {
		msg, err := k.consumer.Fetch(cancelCtx)
		if err != nil {
			if errors.Is(err, cancelCtx.Err()) {
				return nil
			}

			k.log.Error("Failed to fetch messages from Kafka", slog.Any("error", err), slog.String("topic", k.topic.Name))
			select {
			case <-cancelCtx.Done():
				return nil
			case <-time.After(retryDelay):
			}

			if time.Since(startTime) > maxRetryWait {
				return fmt.Errorf("max retry wait time exceeded: %w", err)
			}

			retryDelay = min(time.Duration(float64(retryDelay)*1.5), maxRetryDelay)
			continue
		}

		k.log.Debug("Received message from Kafka",
			slog.String("topic", msg.Topic),
			slog.String("partition", strconv.Itoa(int(msg.Partition))),
			slog.Int64("offset", msg.Offset),
			slog.String("key", string(msg.Key)),
		)

		err = k.processMsg(cancelCtx, msg)
		if err != nil {
			return fmt.Errorf("failed to process messages: %w", err)
		}

		if k.isClosed {
			break
		}
	}

	k.log.Info("Kafka ingestor stopped", slog.String("topic", k.topic.Name))

	return nil
}

func (k *KafkaIngestor) Stop() {
	k.mu.Lock()
	defer k.mu.Unlock()

	if k.isClosed {
		k.log.Debug("Kafka ingestor is already stopped.")
		return
	}

	k.log.Info("Stopping Kafka ingestor", slog.String("topic", k.topic.Name))

	k.isClosed = true

	if k.ctxCancelFunc != nil {
		k.ctxCancelFunc()
	}

	if err := k.consumer.Close(); err != nil {
		k.log.Error("failed to close Kafka consumer", slog.Any("error", err))
	}

	k.log.Info("Kafka ingestor stopped")
}
