package deduplication

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/nats-io/nats.go"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/batch"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

type StatelessTransformer interface {
	Transform(inputBytes []byte) ([]byte, error)
}

type Dedup interface {
	FilterDuplicates(ctx context.Context, messages []models.Message) ([]models.Message, error)
	SaveKeys(ctx context.Context, messages []models.Message) error
}

type DedupService struct {
	reader               batch.BatchReader
	writer               batch.BatchWriter
	dlqWriter            batch.BatchWriter
	statelessTransformer StatelessTransformer
	deduplicator         Dedup
	cancel               context.CancelFunc
	shutdownOnce         sync.Once
	log                  *slog.Logger
	doneCh               chan struct{}
	batchSize            int
	maxWait              time.Duration
}

// NewDedupService creates a new deduplication consumer
func NewDedupService(
	reader batch.BatchReader,
	writer batch.BatchWriter,
	dlqWriter batch.BatchWriter,
	statelessTransformer StatelessTransformer,
	deduplicator Dedup,
	log *slog.Logger,
	batchSize int,
	maxWait time.Duration,
) (*DedupService, error) {
	return &DedupService{
		reader:               reader,
		writer:               writer,
		dlqWriter:            dlqWriter,
		statelessTransformer: statelessTransformer,
		deduplicator:         deduplicator,
		log:                  log,
		batchSize:            batchSize,
		maxWait:              maxWait,
		doneCh:               make(chan struct{}),
	}, nil
}

// Start runs the deduplication consumer
func (ds *DedupService) Start(ctx context.Context) error {
	ds.log.InfoContext(ctx, "Deduplication consumer started")
	defer ds.log.InfoContext(ctx, "Deduplication consumer stopped")
	defer close(ds.doneCh)

	ctx, cancel := context.WithCancel(ctx)
	ds.cancel = cancel
	defer cancel()

	for {
		select {
		case <-ctx.Done():
			shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), internal.SinkDefaultShutdownTimeout)
			defer shutdownCancel()
			return ds.handleShutdown(shutdownCtx)
		default:
			err := ds.Process(ctx)
			if err != nil {
				// Don't log context cancellation errors (shutdown)
				if !errors.Is(err, context.Canceled) && !errors.Is(err, context.DeadlineExceeded) {
					ds.log.ErrorContext(ctx, "failed to process messages", "error", err)
				}
			}
		}
	}
}

func (ds *DedupService) Process(ctx context.Context) error {
	batchMessages, err := ds.reader.ReadBatch(
		ctx,
		models.WithBatchSize(ds.batchSize),
		models.WithTimeout(ds.maxWait),
	)
	if err != nil {
		return fmt.Errorf("read batch: %w", err)
	}

	err = ds.ProcessBatch(ctx, batchMessages)

	return err
}

// handleShutdown handles the shutdown logic
func (ds *DedupService) handleShutdown(ctx context.Context) error {
	ds.log.InfoContext(ctx, "Deduplication consumer shutting down")

	batchMessages, err := ds.reader.ReadBatchNoWait(ctx, models.WithBatchSize(ds.batchSize))
	if err != nil {
		return fmt.Errorf("read batch: %w", err)
	}

	err = ds.ProcessBatch(ctx, batchMessages)
	if err != nil {
		return fmt.Errorf("flush pending messages: %w", err)
	}

	return nil
}

// PostProcessTransformations - for now it's used to apply stateless transform before sending batch to nats
// Ideally we need some kind of wrapper around deduplication to avoid having transform logic here.
// first batch  - successfully transformed data
// second batch - original messages that failed
func (ds *DedupService) PostProcessTransformations(
	ctx context.Context,
	batchMessages []models.Message,
) ([]models.Message, []models.Message, error) {
	var (
		transformedMessages []models.Message
		failedMessages      []models.Message
	)
	// No transformer - pass through original messages
	if ds.statelessTransformer == nil {
		return batchMessages, nil, nil
	}

	for _, originalMessage := range batchMessages {
		transformedBytes, err := ds.statelessTransformer.Transform(originalMessage.Payload())
		if err != nil {
			ds.log.WarnContext(ctx, "Transformation failed, sending to DLQ",
				"error", err,
				"message_id", originalMessage.GetHeader("Nats-Msg-ID"))

			dlqMessage, dlqErr := models.NewDLQMessage(
				internal.RoleDeduplicator,
				err.Error(),
				originalMessage.Payload(),
			).ToJSON()
			if dlqErr != nil {
				return nil, nil, fmt.Errorf("NewDLQMessage: %w", dlqErr)
			}

			failedMessages = append(
				failedMessages,
				models.Message{
					Type:            models.MessageTypeNatsMsg,
					NatsMsgOriginal: &nats.Msg{Data: dlqMessage, Header: originalMessage.Headers()},
				},
			)
			continue
		}

		transformedMessages = append(
			transformedMessages,
			models.Message{
				Type: models.MessageTypeNatsMsg,
				NatsMsgOriginal: &nats.Msg{
					Data:   transformedBytes,
					Header: originalMessage.Headers(),
				},
			},
		)
	}

	return transformedMessages, failedMessages, nil
}

// ProcessBatch reads, deduplicates, and writes messages
func (ds *DedupService) ProcessBatch(ctx context.Context, batchMessages []models.Message) (err error) {
	if len(batchMessages) == 0 {
		return nil
	}

	defer func() {
		if err != nil {
			ds.nakMessages(ctx, batchMessages)
		}
	}()

	// Filter duplicates if deduplicator is enabled
	filteredMessages := batchMessages
	if ds.deduplicator != nil {
		filteredMessages, err = ds.deduplicator.FilterDuplicates(ctx, batchMessages)
		if err != nil {
			return fmt.Errorf("filter duplicates: %w", err)
		}

		if len(filteredMessages) == 0 {
			// All duplicates, just ack
			if err := ds.ackMessages(ctx, batchMessages); err != nil {
				return fmt.Errorf("failed to ack duplicates: %w", err)
			}
			return nil
		}
	}

	outgoingBatch, dlqBatch, err := ds.PostProcessTransformations(ctx, filteredMessages)
	if err != nil {
		return fmt.Errorf("post process: %w", err)
	}

	if len(dlqBatch) > 0 {
		failedDlqBatch := ds.dlqWriter.WriteBatch(ctx, dlqBatch)
		if len(failedDlqBatch) > 0 {
			return fmt.Errorf("write dlq batch: %w", failedDlqBatch[0].Error)
		}
	}

	failedBatch := ds.writer.WriteBatch(ctx, outgoingBatch)
	if len(failedBatch) > 0 {
		failedDlqBatch := ds.dlqWriter.WriteBatch(ctx, dlqBatch)
		if len(failedDlqBatch) > 0 {
			return fmt.Errorf("write dlq batch: %w", failedDlqBatch[0].Error)
		}
	}

	if ds.deduplicator != nil {
		if err := ds.deduplicator.SaveKeys(ctx, filteredMessages); err != nil {
			return fmt.Errorf("save keys: %w", err)
		}
	}

	if err := ds.ackMessages(ctx, batchMessages); err != nil {
		return fmt.Errorf("failed to ack after successful write: %w", err)
	}

	ds.log.InfoContext(ctx, "Deduplicated messages",
		"input_count", len(batchMessages),
		"unique_count", len(filteredMessages),
		"duplicates_filtered", len(batchMessages)-len(filteredMessages))

	return nil
}

func (ds *DedupService) nakMessages(ctx context.Context, messages []models.Message) {
	err := ds.reader.Nak(ctx, messages)
	if err != nil {
		ds.log.ErrorContext(ctx, "failed to nak message", "error", err)
	}
}

func (ds *DedupService) ackMessages(ctx context.Context, messages []models.Message) error {
	if len(messages) == 0 {
		return nil
	}

	err := ds.reader.Ack(ctx, messages)
	if err != nil {
		return fmt.Errorf("failed to ack batch: %w", err)
	}

	return nil
}

func (ds *DedupService) Done() <-chan struct{} {
	return ds.doneCh
}

// Shutdown gracefully stops the consumer
func (ds *DedupService) Shutdown() {
	ds.shutdownOnce.Do(func() {
		if ds.cancel != nil {
			ds.cancel()
		}
	})
}
