package deduplication

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/nats-io/nats.go"
	"github.com/nats-io/nats.go/jetstream"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

type batchReader interface {
	ReadBatchNoWait(ctx context.Context, batchSize int) ([]jetstream.Msg, error)
	ReadBatch(ctx context.Context, batchSize int, opts ...jetstream.FetchOpt) ([]jetstream.Msg, error)
}

type batchWriter interface {
	WriteNatsBatch(ctx context.Context, messages []*nats.Msg) error
}

type statelessTransformer interface {
	Transform(inputBytes []byte) ([]byte, error)
}

type Dedup interface {
	FilterDuplicates(ctx context.Context, messages []jetstream.Msg) ([]jetstream.Msg, error)
	SaveKeys(ctx context.Context, messages []jetstream.Msg) error
}

type DedupService struct {
	reader               batchReader
	writer               batchWriter
	dlqWriter            batchWriter
	statelessTransformer statelessTransformer
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
	reader batchReader,
	writer batchWriter,
	dlqWriter batchWriter,
	statelessTransformer statelessTransformer,
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
		ds.batchSize,
		jetstream.FetchMaxWait(ds.maxWait),
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

	batchMessages, err := ds.reader.ReadBatchNoWait(ctx, ds.batchSize)
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
// output is nats.Msg because it's impossible to create jetstream.Msg
func (ds *DedupService) PostProcessTransformations(
	ctx context.Context,
	batchMessages []jetstream.Msg,
) ([]*nats.Msg, []*nats.Msg, error) {
	var (
		transformedMessages []*nats.Msg
		failedMessages      []*nats.Msg
	)
	// No transformer - pass through original messages
	if ds.statelessTransformer == nil {
		ds.log.InfoContext(ctx, "Stateless transformer disabled")
		for _, msg := range batchMessages {
			transformedMessages = append(transformedMessages, &nats.Msg{
				Data:   msg.Data(),
				Header: msg.Headers(),
			})
		}
		return transformedMessages, nil, nil
	}

	ds.log.InfoContext(ctx, "Stateless transformer enabled")

	for _, originalMessage := range batchMessages {
		ds.log.InfoContext(ctx, "calling transform")
		transformedBytes, err := ds.statelessTransformer.Transform(originalMessage.Data())
		if err != nil {
			ds.log.WarnContext(ctx, "Transformation failed, sending to DLQ",
				"error", err,
				"message_id", originalMessage.Headers().Get("Nats-Msg-ID"))

			dlqMessage, dlqErr := models.NewDLQMessage(
				internal.RoleDeduplicator,
				err.Error(),
				originalMessage.Data(),
			).ToJSON()
			if dlqErr != nil {
				return nil, nil, fmt.Errorf("NewDLQMessage: %w", dlqErr)
			}

			failedMessages = append(failedMessages, &nats.Msg{Data: dlqMessage, Header: originalMessage.Headers()})
			continue
		}

		transformedMessages = append(transformedMessages, &nats.Msg{
			Data:   transformedBytes,
			Header: originalMessage.Headers(),
		})
	}

	return transformedMessages, failedMessages, nil
}

// ProcessBatch reads, deduplicates, and writes messages
func (ds *DedupService) ProcessBatch(ctx context.Context, batchMessages []jetstream.Msg) (err error) {
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
		if err := ds.dlqWriter.WriteNatsBatch(ctx, dlqBatch); err != nil {
			return fmt.Errorf("write dlq batch: %w", err)
		}
	}

	if err := ds.writer.WriteNatsBatch(ctx, outgoingBatch); err != nil {
		return fmt.Errorf("write batch: %w", err)
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

func (ds *DedupService) nakMessages(ctx context.Context, messages []jetstream.Msg) {
	for _, msg := range messages {
		if err := msg.Nak(); err != nil {
			ds.log.ErrorContext(ctx, "failed to nak message", "error", err)
		}
	}
}

func (ds *DedupService) ackMessages(_ context.Context, messages []jetstream.Msg) error {
	if len(messages) == 0 {
		return nil
	}

	// Ack the last message which acks all previous messages in the batch (AckAll policy)
	lastMsg := messages[len(messages)-1]
	if err := lastMsg.Ack(); err != nil {
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
