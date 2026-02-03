package ingestor

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strconv"

	"github.com/nats-io/nats.go"
	"github.com/nats-io/nats.go/jetstream"
	"github.com/twmb/franz-go/pkg/kgo"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/pkg/observability"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/componentsignals"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	schemav2 "github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/schema_v2"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/stream"
)

var (
	ErrValidateSchema  = errors.New("failed to validate data")
	ErrDeduplicateData = errors.New("failed to deduplicate data")
	ErrFilterData      = errors.New("failed to filter data")
)

type KafkaMsgProcessor struct {
	pipelineID      string
	publisher       stream.Publisher
	dlqPublisher    stream.Publisher
	schema          *schemav2.Schema
	topic           models.KafkaTopicsConfig
	signalPublisher *componentsignals.ComponentSignalPublisher
	log             *slog.Logger
	meter           *observability.Meter

	pendingPublishesLimit int
}

func NewKafkaMsgProcessor(
	pipelineID string,
	publisher, dlqPublisher stream.Publisher,
	schema *schemav2.Schema,
	topic models.KafkaTopicsConfig,
	signalPublisher *componentsignals.ComponentSignalPublisher,
	log *slog.Logger,
	meter *observability.Meter,
) *KafkaMsgProcessor {
	if topic.Replicas < 1 {
		topic.Replicas = 1
	}

	pendingPublishesLimit := min(internal.PublisherMaxPendingAcks, internal.NATSMaxBufferedMsgs/topic.Replicas)
	return &KafkaMsgProcessor{
		pipelineID:            pipelineID,
		publisher:             publisher,
		dlqPublisher:          dlqPublisher,
		schema:                schema,
		topic:                 topic,
		pendingPublishesLimit: pendingPublishesLimit,
		signalPublisher:       signalPublisher,
		log:                   log,
		meter:                 meter,
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

func (k *KafkaMsgProcessor) setupDeduplicationHeader(ctx context.Context, headers nats.Header, msgData []byte, version, dedupKey string) error {
	if dedupKey == "" {
		return nil // No deduplication required
	}

	keyValue, err := k.schema.Get(ctx, version, dedupKey, msgData)
	if err != nil {
		return fmt.Errorf("failed to get deduplication key: %w", err)
	}

	if keyValue == nil {
		return fmt.Errorf("deduplication key is nil for topic %s", k.topic.Name)
	}

	strKey := fmt.Sprintf("%v", keyValue)

	k.log.Debug("Setting deduplication header",
		slog.String("topic", k.topic.Name),
		slog.String("dedupKey", dedupKey),
		slog.Any("keyValue", keyValue),
	)

	headers.Set("Nats-Msg-Id", strKey)

	return nil
}

func (k *KafkaMsgProcessor) setSubject(partitionID int32) string {
	if k.topic.Replicas > 1 {
		return models.GetNATSSubjectName(k.topic.OutputStreamID, strconv.Itoa(int(partitionID)))
	}

	return k.publisher.GetSubject()
}

func (k *KafkaMsgProcessor) prepareMesssage(ctx context.Context, msg *kgo.Record) (*nats.Msg, error) {
	nMsg := nats.NewMsg(k.setSubject(msg.Partition))
	nMsg.Data = msg.Value

	k.log.Debug("Preparing message",
		slog.String("topic", k.topic.Name),
		slog.Any("data", nMsg.Data),
		slog.String("subject", nMsg.Subject))

	version, err := k.schema.Validate(ctx, msg.Value)
	k.log.Debug("Schema validation result",
		slog.String("topic", k.topic.Name),
		slog.String("version", version),
		slog.Any("error", err))

	if err != nil {
		if models.IsIncompatibleSchemaErr(err) || errors.Is(err, models.ErrSchemaNotFound) {
			k.log.Error("Incompatible schema detected for message",
				slog.String("topic", k.topic.Name),
				slog.Int64("offset", msg.Offset),
				slog.String("partition", strconv.Itoa(int(msg.Partition))),
				slog.String("schemaID", version),
				slog.Any("error", err))

			sigErr := k.signalPublisher.SendSignal(ctx, models.ComponentSignal{
				Component:  internal.RoleIngestor,
				PipelineID: k.pipelineID,
				Reason:     err.Error(),
				Text:       fmt.Sprintf("schema id %s validation failed", version),
			})
			if sigErr != nil {
				return nil, fmt.Errorf("failed to send component signal: %w", sigErr)
			}

			return nil, err

		}

		k.log.Error("Failed to validate data",
			slog.Any("error", err), slog.String("topic", k.topic.Name),
			slog.Int64("offset", msg.Offset),
			slog.String("partition", strconv.Itoa(int(msg.Partition))))

		if dlqErr := k.pushMsgToDLQ(ctx, msg.Value, fmt.Errorf("%w: %w", ErrValidateSchema, err)); dlqErr != nil {
			return nil, fmt.Errorf("failed to push to DLQ: %w", dlqErr)
		}
		return nil, nil
	}

	nMsg.Header.Set(internal.SchemaVersionIDHeader, version) // Set schema version header
	if k.schema.IsExternal() {
		nMsg.Data = nMsg.Data[5:] // Remove magic byte and schema version bytes for external schemas
	}

	if k.topic.Deduplication.Enabled {
		k.log.Debug("Setting up deduplication header for message",
			slog.String("topic", k.topic.Name),
			slog.String("dedupKey", k.topic.Deduplication.ID),
			slog.String("subject", string(msg.Value)),
		)

		if err := k.setupDeduplicationHeader(ctx, nMsg.Header, msg.Value, version, k.topic.Deduplication.ID); err != nil {
			k.log.Error("Failed to setup deduplication header",
				slog.Any("error", err),
				slog.String("topic", k.topic.Name),
				slog.String("dedupKey", k.topic.Deduplication.ID),
				slog.String("subject", string(msg.Value)),
			)

			if dlqErr := k.pushMsgToDLQ(ctx, msg.Value, fmt.Errorf("%w: %w", ErrDeduplicateData, err)); dlqErr != nil {
				return nil, fmt.Errorf("failed to push to DLQ: %w", dlqErr)
			}
			return nil, nil
		}
	}

	return nMsg, nil
}

func (k *KafkaMsgProcessor) ProcessBatch(ctx context.Context, batch []*kgo.Record) (*kgo.Record, error) {
	if len(batch) == 0 {
		return nil, nil
	}

	var lastProcessed *kgo.Record
	var err error

	if internal.DefaultProcessorMode == internal.SyncMode {
		lastProcessed, err = k.processBatchSync(ctx, batch)
		if err != nil {
			return lastProcessed, fmt.Errorf("failed to process sync batch: %w", err)
		}
	} else {
		lastProcessed, err = k.processBatchAsync(ctx, batch)
		if err != nil {
			return lastProcessed, fmt.Errorf("failed to process async batch: %w", err)
		}
	}

	return lastProcessed, nil
}

func (k *KafkaMsgProcessor) processBatchSync(ctx context.Context, batch []*kgo.Record) (*kgo.Record, error) {
	var lastProcessed *kgo.Record

	for _, msg := range batch {
		natsMsg, err := k.prepareMesssage(ctx, msg)
		if err != nil {
			k.log.Error("Failed to prepare message",
				slog.Any("error", err),
				slog.String("topic", msg.Topic),
				slog.Int("partition", int(msg.Partition)))

			return lastProcessed, fmt.Errorf("failed to prepare message: %w", err)
		}
		if natsMsg == nil {
			// Message was pushed to DLQ, count as processed
			lastProcessed = msg
			continue
		}

		err = k.publisher.PublishNatsMsg(ctx, natsMsg, stream.WithUntilAck())
		if err != nil {
			k.log.Error("Failed to publish message to NATS",
				slog.Any("error", err),
				slog.String("topic", msg.Topic),
				slog.Int("partition", int(msg.Partition)))

			if dlqErr := k.pushMsgToDLQ(ctx, msg.Value, err); dlqErr != nil {
				k.log.Error("Failed to push failed message to DLQ",
					slog.Any("error", dlqErr),
					slog.String("topic", msg.Topic),
					slog.Int("partition", int(msg.Partition)))
				return lastProcessed, fmt.Errorf("failed to publish to NATS: %w", err)
			}
		}

		lastProcessed = msg
	}

	return lastProcessed, nil
}

func (k *KafkaMsgProcessor) processBatchAsync(_ context.Context, batch []*kgo.Record) (*kgo.Record, error) {
	ctx := context.Background()

	type futureWithRecord struct {
		future jetstream.PubAckFuture
		record *kgo.Record
	}

	futures := make([]futureWithRecord, 0, len(batch))
	var lastProcessed *kgo.Record

	for _, msg := range batch {
		natsMsg, err := k.prepareMesssage(ctx, msg)
		if err != nil {
			k.log.Error("Failed to prepare message",
				slog.Any("error", err),
				slog.String("topic", msg.Topic),
				slog.Int("partition", int(msg.Partition)))

			return lastProcessed, fmt.Errorf("failed to prepare message: %w", err)
		}
		if natsMsg == nil {
			// Message was pushed to DLQ, count as processed
			lastProcessed = msg
			continue
		}

		fut, err := k.publisher.PublishNatsMsgAsync(natsMsg, k.pendingPublishesLimit)
		if err != nil {
			k.log.Error("Failed to publish message async to NATS",
				slog.Any("error", err),
				slog.String("topic", msg.Topic),
				slog.Int("partition", int(msg.Partition)))

			dlqErr := k.pushMsgToDLQ(ctx, msg.Value, err)
			if dlqErr != nil {
				k.log.Error("Failed to push failed message to DLQ",
					slog.Any("error", dlqErr),
					slog.String("topic", msg.Topic),
					slog.Int("partition", int(msg.Partition)))
				return lastProcessed, fmt.Errorf("failed to publish async to NATS: %w", err)
			}

			lastProcessed = msg
			continue
		}

		futures = append(futures, futureWithRecord{future: fut, record: msg})
		lastProcessed = msg
	}

	// Wait for all futures to complete
	<-k.publisher.WaitForAsyncPublishAcks()

	for _, f := range futures {
		select {
		case <-f.future.Ok():
			// Successfully published
			lastProcessed = f.record
			continue
		case err := <-f.future.Err():
			k.log.Error("Failed to receive async publish ack",
				slog.Any("error", err),
				slog.String("subject", f.future.Msg().Subject))

			dlqErr := k.pushMsgToDLQ(ctx, f.future.Msg().Data, err)
			if dlqErr != nil {
				k.log.Error("Failed to push failed message to DLQ",
					slog.Any("error", dlqErr),
					slog.String("subject", f.future.Msg().Subject))
				return lastProcessed, fmt.Errorf("push mesage to the DLQ %w", dlqErr)
			}
			lastProcessed = f.record
		}
	}

	return lastProcessed, nil
}
