package ingestor

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strconv"
	"time"

	"github.com/IBM/sarama"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/kafka"
	"github.com/nats-io/nats.go"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/schema"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/stream"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/pkg/observability"
)

var (
	ErrValidateSchema  = errors.New("failed to validate data")
	ErrDeduplicateData = errors.New("failed to deduplicate data")
)

type KafkaMsgProcessor struct {
	publisher    stream.Publisher
	dlqPublisher stream.Publisher
	schemaMapper schema.Mapper

	topic models.KafkaTopicsConfig

	log   *slog.Logger
	meter *observability.Meter
}

func NewKafkaMsgProcessor(publisher, dlqPublisher stream.Publisher, schemaMapper schema.Mapper, topic models.KafkaTopicsConfig, log *slog.Logger, meter *observability.Meter) *KafkaMsgProcessor {
	return &KafkaMsgProcessor{
		publisher:    publisher,
		dlqPublisher: dlqPublisher,
		schemaMapper: schemaMapper,
		topic:        topic,
		log:          log,
		meter:        meter,
	}
}

func (k *KafkaMsgProcessor) ProcessMessage(ctx context.Context, msg kafka.Message) error {
	start := time.Now()

	nMsg := nats.NewMsg(k.setSubject(msg.Partition))
	nMsg.Data = msg.Value

	nMsg.Header = k.convertKafkaToNATSHeaders(msg.Headers)

	err := k.schemaMapper.ValidateSchema(k.topic.Name, msg.Value)
	if err != nil {
		k.log.Error("Failed to validate data", slog.Any("error", err), slog.String("topic", k.topic.Name))
		if dlqErr := k.pushMsgToDLQ(ctx, msg.Value, ErrValidateSchema); dlqErr != nil {
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
			if dlqErr := k.pushMsgToDLQ(ctx, msg.Value, ErrDeduplicateData); dlqErr != nil {
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

	// Record processing duration
	if k.meter != nil {
		duration := time.Since(start).Seconds()
		k.meter.RecordProcessingDuration(ctx, duration)
	}

	return nil
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

	// Record DLQ write metric
	if k.meter != nil {
		k.meter.RecordDLQWrite(ctx, 1)
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
