package ingestor

import (
	"context"
	"errors"
	"fmt"
	"hash/fnv"
	"log/slog"
	"strconv"
	"sync/atomic"

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

type KafkaMsgProcessor struct {
	pipelineID      string
	publisher       stream.Publisher
	dlqPublisher    stream.Publisher
	schema          *schemav2.Schema
	topic           models.KafkaTopicsConfig
	signalPublisher *componentsignals.ComponentSignalPublisher
	log             *slog.Logger

	outputSubject       string
	outputSubjectPrefix string
	totalSubjectCount   int
	roundRobinCounter   atomic.Int64
	dedupSubjectPrefix  string
	dedupSubjectCount   int
	singleDedupSubject  string

	pendingPublishesLimit int
}

func NewKafkaMsgProcessor(
	pipelineID string,
	publisher, dlqPublisher stream.Publisher,
	schema *schemav2.Schema,
	topic models.KafkaTopicsConfig,
	runtimeCfg models.IngestorRuntimeConfig,
	signalPublisher *componentsignals.ComponentSignalPublisher,
	log *slog.Logger,
) (*KafkaMsgProcessor, error) {
	if topic.Replicas < 1 {
		topic.Replicas = 1
	}

	outputSubject := runtimeCfg.OutputSubject
	if outputSubject == "" {
		return nil, fmt.Errorf("output subject is required")
	}

	dedupSubjectPrefix := runtimeCfg.DedupSubjectPrefix
	dedupSubjectCount := runtimeCfg.DedupSubjectCount
	singleDedupSubject := ""
	if topic.Deduplication.Enabled {
		if dedupSubjectCount <= 0 {
			return nil, fmt.Errorf("dedup subject count must be > 0 when deduplication is enabled")
		}
		if dedupSubjectPrefix == "" {
			return nil, fmt.Errorf("dedup subject prefix is required when deduplication is enabled")
		}
		if dedupSubjectCount == 1 {
			singleDedupSubject = outputSubject
		}
	}

	pendingPublishesLimit := min(internal.PublisherMaxPendingAcks, internal.NATSMaxBufferedMsgs/topic.Replicas)
	return &KafkaMsgProcessor{
		pipelineID:            pipelineID,
		publisher:             publisher,
		dlqPublisher:          dlqPublisher,
		schema:                schema,
		topic:                 topic,
		outputSubject:         outputSubject,
		outputSubjectPrefix:   runtimeCfg.OutputSubjectPrefix,
		totalSubjectCount:     runtimeCfg.TotalSubjectCount,
		dedupSubjectPrefix:    dedupSubjectPrefix,
		dedupSubjectCount:     dedupSubjectCount,
		singleDedupSubject:    singleDedupSubject,
		pendingPublishesLimit: pendingPublishesLimit,
		signalPublisher:       signalPublisher,
		log:                   log,
	}, nil
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

	observability.RecordDLQWrite(ctx, internal.RoleIngestor, 1)

	return nil
}

// setDedupHeader sets the Nats-Msg-Id header from a pre-resolved dedup key string.
func (k *KafkaMsgProcessor) setDedupHeader(headers nats.Header, dedupKeyStr string) {
	if dedupKeyStr == "" {
		return
	}

	k.log.Debug("Setting deduplication header",
		slog.String("topic", k.topic.Name),
		slog.String("dedupKey", k.topic.Deduplication.ID),
		slog.String("keyValue", dedupKeyStr),
	)
	headers.Set("Nats-Msg-Id", dedupKeyStr)
}

// getSubject returns the NATS subject for publishing.
// When totalSubjectCount > 1, subjects are selected round-robin across all downstream subjects.
func (k *KafkaMsgProcessor) getSubject() string {
	if k.totalSubjectCount <= 1 {
		return k.outputSubject
	}
	n := k.roundRobinCounter.Add(1) - 1
	return fmt.Sprintf("%s.%d", k.outputSubjectPrefix, n%int64(k.totalSubjectCount))
}

// getSubjectAndDedupKey returns the NATS subject for this message and, when dedup is enabled, the dedup key string for the header.
// Resolves the dedup key at most once: same key is used for subject routing (hash % M) and for Nats-Msg-Id header.
// When deduplication is enabled, subject is DedupSubjectPrefix.(hash(dedupKey) % DedupSubjectCount).
func (k *KafkaMsgProcessor) getSubjectAndDedupKey(ctx context.Context, version string, msgData []byte) (subject string, dedupKeyStr string, err error) {
	if !k.topic.Deduplication.Enabled {
		return k.getSubject(), "", nil
	}

	keyValue, err := k.schema.Get(ctx, version, k.topic.Deduplication.ID, msgData)
	if err != nil {
		return "", "", fmt.Errorf("failed to get deduplication key: %w", err)
	}
	if keyValue == nil {
		return "", "", fmt.Errorf("deduplication key is nil for topic %s", k.topic.Name)
	}
	strKey := fmt.Sprintf("%v", keyValue)

	if k.singleDedupSubject != "" {
		return k.singleDedupSubject, strKey, nil
	}

	h := fnv.New64a()
	_, _ = h.Write([]byte(strKey))
	idx := int(h.Sum64() % uint64(k.dedupSubjectCount))
	return fmt.Sprintf("%s.%d", k.dedupSubjectPrefix, idx), strKey, nil
}

func (k *KafkaMsgProcessor) prepareMesssage(ctx context.Context, msg *kgo.Record) (*nats.Msg, error) {
	version, err := k.schema.Validate(ctx, msg.Value)
	k.log.Debug("Schema validation result",
		slog.String("topic", k.topic.Name),
		slog.String("version", version),
		slog.Any("error", err))

	if err != nil {
		if models.IsIncompatibleSchemaError(err) || errors.Is(err, models.ErrSchemaNotFound) {
			k.log.Error("Schema validation error has been detected for message",
				slog.String("topic", k.topic.Name),
				slog.Int64("offset", msg.Offset),
				slog.String("partition", strconv.Itoa(int(msg.Partition))),
				slog.String("schemaID", version),
				slog.String("error", err.Error()))

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

		validationErr := fmt.Errorf("%w: %w", models.ErrValidateSchema, err)
		if errors.Is(err, models.ErrFailedToParseSchemaID) || errors.Is(err, models.ErrMessageIsTooShort) {
			validationErr = err
		}

		if dlqErr := k.pushMsgToDLQ(ctx, msg.Value, validationErr); dlqErr != nil {
			return nil, fmt.Errorf("failed to push to DLQ: %w", dlqErr)
		}
		return nil, nil
	}

	msgData := msg.Value
	if k.schema.IsExternal() {
		msgData = msgData[5:] // Remove magic byte and schema version bytes for external schemas before publishing to NATS
	}
	subject, dedupKeyStr, err := k.getSubjectAndDedupKey(ctx, version, msgData)
	if err != nil {
		if dlqErr := k.pushMsgToDLQ(ctx, msg.Value, fmt.Errorf("%w: %w", models.ErrDeduplicateData, err)); dlqErr != nil {
			return nil, fmt.Errorf("failed to push to DLQ: %w", dlqErr)
		}
		return nil, nil
	}

	nMsg := nats.NewMsg(subject)
	nMsg.Data = msgData

	nMsg.Header.Set(internal.SchemaVersionIDHeader, version) // Set schema version header

	k.setDedupHeader(nMsg.Header, dedupKeyStr)

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
	var outBytes int64

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
		outBytes += int64(len(natsMsg.Data))
		lastProcessed = msg
	}

	observability.RecordBytesProcessed(ctx, "ingestor", "out", outBytes)

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

		fut, err := k.publisher.PublishNatsMsgAsync(ctx, natsMsg, k.pendingPublishesLimit)
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

	var outBytes int64
	for _, f := range futures {
		select {
		case <-f.future.Ok():
			// Successfully published
			outBytes += int64(len(f.future.Msg().Data))
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

	observability.RecordBytesProcessed(ctx, "ingestor", "out", outBytes)

	return lastProcessed, nil
}
