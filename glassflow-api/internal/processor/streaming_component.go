package processor

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/batch"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

// streamingState encapsulates all streaming-specific state
type streamingState struct {
	messageBuffer     []models.Message
	bufferMu          sync.Mutex
	bufferFlushTicker *time.Ticker
	maxBatchSize      int
	maxDelayTime      time.Duration
	consumeContext    batch.ConsumeContext
}

type StreamingComponent struct {
	reader     batch.BatchReader
	writer     batch.BatchWriter
	dlqWriter  batch.BatchWriter
	log        *slog.Logger
	processors []Processor
	shutdown   shutdown
	role       string

	streaming streamingState
}

func NewStreamingComponent(
	reader batch.BatchReader,
	writer batch.BatchWriter,
	dlqWriter batch.BatchWriter,
	log *slog.Logger,
	role string,
	processors []Processor,
) *StreamingComponent {
	return &StreamingComponent{
		reader:     reader,
		writer:     writer,
		dlqWriter:  dlqWriter,
		log:        log,
		processors: processors,
		role:       role,
		shutdown: shutdown{
			doneCh: make(chan struct{}),
		},
	}
}

func (sc *StreamingComponent) Start(ctx context.Context) error {
	sc.log.InfoContext(ctx, "starting streaming component")
	defer sc.log.InfoContext(ctx, "streaming component stopped")
	defer close(sc.shutdown.doneCh)

	ctx, cancel := context.WithCancel(ctx)
	sc.shutdown.cancel = cancel
	defer cancel()

	sc.streaming.maxBatchSize = internal.DefaultDedupComponentBatchSize
	sc.streaming.maxDelayTime = internal.DefaultDedupMaxWaitTime
	sc.streaming.messageBuffer = make([]models.Message, 0, sc.streaming.maxBatchSize)

	sc.streaming.bufferFlushTicker = time.NewTicker(sc.streaming.maxDelayTime)
	defer sc.streaming.bufferFlushTicker.Stop()

	flushWg := sync.WaitGroup{}
	flushWg.Add(1)
	go func() {
		defer flushWg.Done()
		for {
			select {
			case <-ctx.Done():
				return
			case <-sc.streaming.bufferFlushTicker.C:
				sc.flushBuffer(ctx)
			}
		}
	}()

	messageHandler := func(msg models.Message) {
		sc.streaming.bufferMu.Lock()
		sc.streaming.messageBuffer = append(sc.streaming.messageBuffer, msg)
		shouldFlush := len(sc.streaming.messageBuffer) >= sc.streaming.maxBatchSize
		sc.streaming.bufferMu.Unlock()

		if shouldFlush {
			sc.flushBuffer(ctx)
		}
	}

	consumeCtx, err := sc.reader.Consume(ctx, messageHandler, models.WithBatchSize(sc.streaming.maxBatchSize))
	if err != nil {
		return fmt.Errorf("start consumption: %w", err)
	}
	sc.streaming.consumeContext = consumeCtx

	<-ctx.Done()

	flushWg.Wait()

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), internal.DefaultComponentShutdownTimeout)
	defer shutdownCancel()
	return sc.handleShutdown(shutdownCtx)
}

// flushBuffer processes accumulated messages in the buffer
func (sc *StreamingComponent) flushBuffer(ctx context.Context) {
	sc.streaming.bufferMu.Lock()
	if len(sc.streaming.messageBuffer) == 0 {
		sc.streaming.bufferMu.Unlock()
		return
	}

	batchToProcess := make([]models.Message, len(sc.streaming.messageBuffer))
	copy(batchToProcess, sc.streaming.messageBuffer)

	sc.streaming.messageBuffer = sc.streaming.messageBuffer[:0]
	sc.streaming.bufferMu.Unlock()

	if err := sc.ProcessBatch(ctx, batchToProcess); err != nil {
		sc.log.ErrorContext(ctx, "batch processing failed", "error", err, "batch_size", len(batchToProcess))
	}
}

// handleShutdown handles the shutdown logic
func (sc *StreamingComponent) handleShutdown(ctx context.Context) error {
	sc.log.InfoContext(ctx, "streaming component shutting down")

	if sc.streaming.consumeContext != nil {
		sc.streaming.consumeContext.Stop()
	}

	sc.flushBuffer(ctx)

	for _, processor := range sc.processors {
		err := processor.Close(ctx)
		if err != nil {
			sc.log.ErrorContext(ctx, "failed to close processor", slog.String("error", err.Error()))
		}
	}

	return nil
}

func (sc *StreamingComponent) Done() <-chan struct{} {
	return sc.shutdown.doneCh
}

// Shutdown gracefully stops the consumer
func (sc *StreamingComponent) Shutdown() {
	sc.shutdown.shutdownOnce.Do(func() {
		if sc.shutdown.cancel != nil {
			sc.shutdown.cancel()
		}
	})
}

func (sc *StreamingComponent) writeFailedBatch(ctx context.Context, failedMessages []models.FailedMessage) error {
	messages := make([]models.Message, 0, len(failedMessages))
	for _, failedMessage := range failedMessages {
		msg, err := models.FailedMessageToMessage(
			failedMessage,
			sc.role,
			failedMessage.Error,
		)
		if err != nil {
			return fmt.Errorf("map failed message to message: %w", err)
		}
		messages = append(messages, msg)
	}

	failedDlqMessages := sc.dlqWriter.WriteBatch(ctx, messages)
	if len(failedDlqMessages) > 0 {
		return fmt.Errorf("failed to write to DLQ: %w", failedDlqMessages[0].Error)
	}

	return nil
}

func (sc *StreamingComponent) ProcessBatch(ctx context.Context, batch []models.Message) (err error) {
	if len(batch) == 0 {
		return nil
	}

	start := time.Now()

	defer func() {
		if err != nil {
			if nakErr := sc.reader.Nak(ctx, batch); nakErr != nil {
				sc.log.ErrorContext(ctx, "failed to nak messages", "error", nakErr)
			}
		}
	}()

	messages, commits, totalDlqCount, err := sc.runProcessors(ctx, batch)
	if err != nil {
		return fmt.Errorf("process: %w", err)
	}
	if len(messages) == 0 {
		return sc.reader.Ack(ctx, batch)
	}

	failedMessages := sc.writer.WriteBatch(ctx, messages)
	if len(failedMessages) > 0 {
		err = sc.writeFailedBatch(ctx, failedMessages)
		if err != nil {
			return fmt.Errorf("write failed batch: %w", err)
		}
	}

	for i, commit := range commits {
		if commit == nil {
			continue
		}
		if err = commit(); err != nil {
			return fmt.Errorf("commit[%d]: %w", i, err)
		}
	}

	err = sc.reader.Ack(ctx, batch)
	if err != nil {
		return fmt.Errorf("ack: %w", err)
	}

	sc.log.InfoContext(
		ctx,
		"Batch processed successfully",
		slog.Int("batchSize", len(batch)),
		slog.Int("dlq_count", totalDlqCount),
		slog.Duration("duration", time.Duration(time.Since(start).Milliseconds())),
	)

	return nil
}

func (sc *StreamingComponent) runProcessors(ctx context.Context, batch []models.Message) ([]models.Message, []func() error, int, error) {
	current := ProcessorBatch{Messages: batch}
	commits := make([]func() error, 0, len(sc.processors))
	var totalDlqCount int

	for _, proc := range sc.processors {
		if len(current.Messages) == 0 {
			break
		}

		result := proc.ProcessBatch(ctx, current)

		if result.FatalError != nil {
			return nil, nil, 0, result.FatalError
		}
		totalDlqCount += result.DlqCount
		commits = append(commits, result.CommitFn)

		current = result
	}

	return current.Messages, commits, totalDlqCount, nil
}
