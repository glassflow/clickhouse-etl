package ingestor

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"math/rand"
	"strconv"
	"time"

	"github.com/google/uuid"
	"github.com/nats-io/nats.go"
	"github.com/nats-io/nats.go/jetstream"
	"github.com/twmb/franz-go/pkg/kgo"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/pkg/observability"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/schema"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/stream"
)

var (
	ErrValidateSchema  = errors.New("failed to validate data")
	ErrDeduplicateData = errors.New("failed to deduplicate data")
	ErrFilterData      = errors.New("failed to filter data")
)

type Filter interface {
	Matches([]byte) (bool, error)
}

type KafkaMsgProcessor struct {
	publisher    stream.Publisher
	dlqPublisher stream.Publisher
	Jetstream    jetstream.JetStream
	schemaMapper schema.Mapper
	topic        models.KafkaTopicsConfig
	log          *slog.Logger
	meter        *observability.Meter

	filter Filter

	pendingPublishesLimit int
}

func NewKafkaMsgProcessor(
	publisher, dlqPublisher stream.Publisher,
	Jetstream jetstream.JetStream,
	schemaMapper schema.Mapper,
	topic models.KafkaTopicsConfig,
	log *slog.Logger,
	meter *observability.Meter,
	filter Filter,
) *KafkaMsgProcessor {
	if topic.Replicas < 1 {
		topic.Replicas = 1
	}

	pendingPublishesLimit := min(internal.PublisherMaxPendingAcks, internal.NATSMaxBufferedMsgs/topic.Replicas)
	return &KafkaMsgProcessor{
		publisher:             publisher,
		dlqPublisher:          dlqPublisher,
		Jetstream:             Jetstream,
		schemaMapper:          schemaMapper,
		topic:                 topic,
		pendingPublishesLimit: pendingPublishesLimit,
		log:                   log,
		meter:                 meter,
		filter:                filter,
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

	err := k.schemaMapper.ValidateSchema(k.topic.Name, msg.Value)
	if err != nil {
		k.log.Error("Failed to validate data",
			slog.Any("error", err), slog.String("topic", k.topic.Name),
			slog.Int64("offset", msg.Offset),
			slog.String("partition", strconv.Itoa(int(msg.Partition))))

		if dlqErr := k.pushMsgToDLQ(ctx, msg.Value, fmt.Errorf("%w: %w", ErrValidateSchema, err)); dlqErr != nil {
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

	filterMatched, err := k.filter.Matches(msg.Value)
	if err != nil {
		k.log.Error("Failed to filter", slog.Any("error", err), slog.String("topic", k.topic.Name))
		if dlqErr := k.pushMsgToDLQ(ctx, msg.Value, ErrFilterData); dlqErr != nil {
			return nil, fmt.Errorf("failed to push to DLQ: %w", dlqErr)
		}
		return nil, nil
	}
	if filterMatched {
		k.log.Debug("Message filtered out", slog.String("topic", k.topic.Name))
		if k.meter != nil {
			k.meter.RecordFilteredMessage(ctx, 1)
		}
		return nil, nil
	}

	return nMsg, nil
}

func (k *KafkaMsgProcessor) ProcessBatch(ctx context.Context, batch []*kgo.Record) error {
	if len(batch) == 0 {
		return nil
	}

	err := k.ProcessBatchNatsKV(ctx, batch)
	if err != nil {
		return fmt.Errorf("ProcessBatchNatsKV: %w", err)
	}

	//if internal.DefaultProcessorMode == internal.SyncMode {
	//	err = k.processBatchSync(ctx, batch)
	//	if err != nil {
	//		return fmt.Errorf("failed to process sync batch: %w", err)
	//	}
	//} else {
	//	err = k.processBatchAsync(ctx, batch)
	//	if err != nil {
	//		return fmt.Errorf("failed to process async batch: %w", err)
	//	}
	//}

	return nil
}

func (k *KafkaMsgProcessor) ProcessBatchNatsKV(ctx context.Context, batch []*kgo.Record) error {
	kvBatch, err := k.PrepareMessages(ctx, batch)
	if err != nil {
		return fmt.Errorf("prepare message: %w", err)
	}
	kvBatchBytes, err := json.Marshal(kvBatch)
	if err != nil {
		return fmt.Errorf("marshal: %w", err)
	}

	bucketName := models.Buckets[rand.New(rand.NewSource(time.Now().UnixNano())).Intn(len(models.Buckets))]

	bucket, err := k.Jetstream.ObjectStore(ctx, bucketName)
	if err != nil {
		if errors.Is(err, jetstream.ErrBucketNotFound) {
			bucket, err = k.Jetstream.CreateObjectStore(ctx, jetstream.ObjectStoreConfig{
				Bucket:      bucketName,
				Description: bucketName,
				TTL:         time.Hour * 6,
				Replicas:    3,
				//Compression: true,
			})
			if err != nil {
				return fmt.Errorf("Jetstream.CreateObjectStore: %w", err)
			}
		} else {
			return fmt.Errorf("get bucket: %w", err)
		}
	}

	keyID := uuid.New().String()

	_, err = bucket.PutBytes(ctx, keyID, kvBatchBytes)
	if err != nil {
		return fmt.Errorf("put bytes: %w", err)
	}

	kvBatchReference := models.KVBatchReference{BucketID: bucketName, KeyID: keyID, Size: int64(len(batch))}
	referenceBytes, err := json.Marshal(kvBatchReference)
	if err != nil {
		return fmt.Errorf("json marshal: %w", err)
	}

	nMsg := nats.NewMsg("buckets")
	nMsg.Data = referenceBytes

	err = k.publisher.PublishNatsMsg(ctx, nMsg, stream.WithUntilAck())
	if err != nil {
		return fmt.Errorf("publish nats msg: %w", err)
	}

	return nil
}

func (k *KafkaMsgProcessor) PrepareMessages(ctx context.Context, batch []*kgo.Record) (*models.KVBatch, error) {
	outputBatch := make([]models.Msg, 0, len(batch))
	for _, msg := range batch {
		natsMsg, err := k.prepareMesssage(ctx, msg)
		if err != nil {
			k.log.Error("Failed to prepare message",
				slog.Any("error", err),
				slog.String("topic", msg.Topic),
				slog.Int("partition", int(msg.Partition)))

			return nil, fmt.Errorf("failed to prepare message: %w", err)
		}

		outputBatch = append(outputBatch, natsMsg.Data)
	}

	return &models.KVBatch{Messages: outputBatch}, nil
}

// nolint
func (k *KafkaMsgProcessor) processBatchSync(ctx context.Context, batch []*kgo.Record) error {
	for _, msg := range batch {
		natsMsg, err := k.prepareMesssage(ctx, msg)
		if err != nil {
			k.log.Error("Failed to prepare message",
				slog.Any("error", err),
				slog.String("topic", msg.Topic),
				slog.Int("partition", int(msg.Partition)))

			return fmt.Errorf("failed to prepare message: %w", err)
		}
		if natsMsg == nil {
			// Message was pushed to DLQ, nothing more to do
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
				return fmt.Errorf("failed to publish to NATS: %w", err)
			}
		}
	}

	return nil
}

// nolint
func (k *KafkaMsgProcessor) processBatchAsync(_ context.Context, batch []*kgo.Record) error {
	ctx := context.Background()
	futures := make([]jetstream.PubAckFuture, 0, len(batch))
	for _, msg := range batch {
		natsMsg, err := k.prepareMesssage(ctx, msg)
		if err != nil {
			k.log.Error("Failed to prepare message",
				slog.Any("error", err),
				slog.String("topic", msg.Topic),
				slog.Int("partition", int(msg.Partition)))

			return fmt.Errorf("failed to prepare message: %w", err)
		}
		if natsMsg == nil {
			// Message was pushed to DLQ, nothing more to do
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
				return fmt.Errorf("failed to publish async to NATS: %w", err)
			}

			continue
		}

		futures = append(futures, fut)
	}

	// Wait for all futures to complete
	<-k.publisher.WaitForAsyncPublishAcks()

	for _, fut := range futures {
		select {
		case <-fut.Ok():
			// Successfully published
			continue
		case err := <-fut.Err():
			k.log.Error("Failed to receive async publish ack",
				slog.Any("error", err),
				slog.String("subject", fut.Msg().Subject))

			dlqErr := k.pushMsgToDLQ(ctx, fut.Msg().Data, err)
			if dlqErr != nil {
				k.log.Error("Failed to push failed message to DLQ",
					slog.Any("error", dlqErr),
					slog.String("subject", fut.Msg().Subject))
				return fmt.Errorf("push mesage to the DLQ %w", dlqErr)
			}
		}
	}

	return nil
}
