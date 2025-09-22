package ingestor

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strconv"

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

type MessageProcessor interface {
	ProcessMessage(ctx context.Context, msg kafka.Message) error
	ProcessBatch(ctx context.Context, batch kafka.MessageBatch) error
}

type KafkaMsgProcessor struct {
	publisher    stream.Publisher
	dlqPublisher stream.Publisher
	schemaMapper schema.Mapper

	topic models.KafkaTopicsConfig

	log *slog.Logger
}

func NewKafkaMsgProcessor(publisher, dlqPublisher stream.Publisher, schemaMapper schema.Mapper, topic models.KafkaTopicsConfig, log *slog.Logger) *KafkaMsgProcessor {
	return &KafkaMsgProcessor{
		publisher:    publisher,
		dlqPublisher: dlqPublisher,
		schemaMapper: schemaMapper,
		topic:        topic,
		log:          log,
	}
}

func (k *KafkaMsgProcessor) pushMsgToDLQ(ctx context.Context, orgMsg []byte, err error) error {
	k.log.Error("Pushing message to DLQ", slog.Any("error", err), slog.String("topic", k.topic.Name))

	data, err := models.NewDLQMessage(internal.RoleIngestor, err.Error(), orgMsg).ToJSON()
	if err != nil {
		k.log.Error("Failed to convert DLQ message to JSON", slog.Any("error", err), slog.String("topic", k.topic.Name))
		return fmt.Errorf("failed to convert DLQ message to JSON: %w", err)
	}

	err = k.dlqPublisher.Publish(ctx, data)
	if err != nil {
		k.log.Error("Failed to publish message to DLQ", slog.Any("error", err), slog.String("topic", k.topic.Name))
		return fmt.Errorf("failed to publish to DLQ: %w", err)
	}

	return nil
}

func (k *KafkaMsgProcessor) convertKafkaToNATSHeaders(headers []sarama.RecordHeader) nats.Header {
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

func (k *KafkaMsgProcessor) setupDeduplicationHeader(headers nats.Header, msgData []byte, dedupKey string) error {
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

func (k *KafkaMsgProcessor) setSubject(partitionID int32) string {
	if k.topic.Replicas > 1 {
		return models.GetNATSSubjectName(k.topic.OutputStreamID, strconv.Itoa(int(partitionID)))
	}

	return k.publisher.GetSubject()
}

func (k *KafkaMsgProcessor) prepareMesssage(ctx context.Context, msg kafka.Message) (*nats.Msg, error) {
	nMsg := nats.NewMsg(k.setSubject(msg.Partition))
	nMsg.Data = msg.Value

	nMsg.Header = k.convertKafkaToNATSHeaders(msg.Headers)

	err := k.schemaMapper.ValidateSchema(k.topic.Name, msg.Value)
	if err != nil {
		k.log.Error("Failed to validate data", slog.Any("error", err), slog.String("topic", k.topic.Name))
		if dlqErr := k.pushMsgToDLQ(ctx, msg.Value, ErrValidateSchema); dlqErr != nil {
			return nil, fmt.Errorf("failed to push to DLQ: %w", dlqErr)
		}
		return nil, nil
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
			if dlqErr := k.pushMsgToDLQ(ctx, msg.Value, ErrDeduplicateData); dlqErr != nil {
				return nil, fmt.Errorf("failed to push to DLQ: %w", dlqErr)
			}
			return nil, nil
		}
	}

	return nMsg, nil
}

func (k *KafkaMsgProcessor) ProcessMessage(ctx context.Context, msg kafka.Message) error {
	nMsg, err := k.prepareMesssage(ctx, msg)
	if err != nil {
		return fmt.Errorf("failed to prepare NATS message: %w", err)
	}
	if nMsg == nil {
		// Message was pushed to DLQ, nothing more to do
		return nil
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

func (k *KafkaMsgProcessor) ProcessBatch(ctx context.Context, batch kafka.MessageBatch) error {
	natsBatch := make([]*nats.Msg, 0, len(batch))
	for i, msg := range batch {
		natsMsg, err := k.prepareMesssage(ctx, msg)
		if err != nil {
			k.log.Error("Failed to process message in batch",
				slog.Any("error", err),
				slog.Int("messageIndex", i),
				slog.Int("batchSize", len(batch)),
				slog.String("topic", msg.Topic),
				slog.Int("partition", int(msg.Partition)),
				slog.Int64("offset", msg.Offset))
			return fmt.Errorf("failed to process message %d in batch: %w", i, err)
		}
		if natsMsg == nil {
			// Message was pushed to DLQ, nothing more to do
			continue
		}

		natsBatch = append(natsBatch, natsMsg)
	}

	k.log.Debug("Publishing NATS message batch", slog.Int("batchSize", len(natsBatch)))

	falied, err := k.publisher.PublishNatsMsgsAsync(ctx, natsBatch)
	if err != nil {
		switch {
		case models.IsAsyncBatchFailedErr(err):
			for _, f := range falied {
				err := k.pushMsgToDLQ(ctx, f.GetData(), f.GetError())
				if err != nil {
					k.log.Error("Failed to push failed async batch message to DLQ", slog.Any("error", err), slog.String("topic", k.topic.Name))
					return fmt.Errorf("failed to push failed async batch message to DLQ: %w", err)
				}
			}
		case models.IsFailedToTerminateBatchMsgsErr(err):
			k.log.Error("Failed to terminate batch messages after context cancel, but error had occuered:", slog.Any("error", err), slog.String("topic", k.topic.Name))
			return fmt.Errorf("failed to terminate batch messages: %w", err)
		case errors.Is(err, context.Canceled):
			k.log.Info("Context was canceled while publishing batch messages", slog.String("topic", k.topic.Name))
			return fmt.Errorf("context canceled, batch was not sent: %w", err)
		default:
			k.log.Error("Failed to publish batch messages to NATS", slog.Any("error", err), slog.String("topic", k.topic.Name))
			return fmt.Errorf("failed to publish batch to NATS: %w", err)
		}
	}

	return nil
}

type KafkaIngestor struct {
	consumer  kafka.Consumer
	processor MessageProcessor
	topic     models.KafkaTopicsConfig
	log       *slog.Logger
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
		consumer:  consumer,
		processor: NewKafkaMsgProcessor(natsPub, dlqPub, schema, topic, log),
		topic:     topic,
		log:       log,
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
