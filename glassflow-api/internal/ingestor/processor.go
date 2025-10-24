package ingestor

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strconv"

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

	err := k.publisher.PublishBatch(ctx, natsBatch)
	if err != nil {
		k.log.Error("Failed to publish batch messages to NATS", slog.Any("error", err), slog.String("topic", k.topic.Name))
		return fmt.Errorf("failed to publish batch to NATS: %w", err)
	}

	return nil
}

func (k *KafkaMsgProcessor) sendNatsMessage(ctx context.Context, msg *nats.Msg) error {
	err := k.publisher.PublishNatsMsg(ctx, msg, stream.WithUntilAck())
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
