package processor

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/batch"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

type ProcessorBatch struct {
	Messages       []models.Message
	FailedMessages []models.FailedMessage
	FatalError     error
	CommitFn       func() error // nil for stateless
}

type Processor interface {
	ProcessBatch(ctx context.Context, batch ProcessorBatch) ProcessorBatch
	Close(ctx context.Context) error
}

// ChainProcessors applies middlewares to a base processor, similar to HTTP middleware pattern.
// Middlewares are applied in reverse order so the first middleware in the slice wraps outermost.
func ChainProcessors(middlewares []func(Processor) Processor, base Processor) Processor {
	// we shouldn't do anything if base is noop
	if noop, ok := base.(*NoopProcessor); ok {
		return noop
	}

	result := base
	for i := len(middlewares) - 1; i >= 0; i-- {
		result = middlewares[i](result)
	}
	return result
}

// ChainMiddlewares is a variadic helper to avoid verbose slice literal syntax.
func ChainMiddlewares(middlewares ...func(Processor) Processor) []func(Processor) Processor {
	return middlewares
}

type shutdown struct {
	cancel       context.CancelFunc
	shutdownOnce sync.Once
	doneCh       chan struct{}
}

type Component struct {
	reader     batch.BatchReader
	writer     batch.BatchWriter
	dlqWriter  batch.BatchWriter
	log        *slog.Logger
	processors []Processor
	shutdown   shutdown
	role       string
}

func NewComponent(
	reader batch.BatchReader,
	writer batch.BatchWriter,
	dlqWriter batch.BatchWriter,
	log *slog.Logger,
	role string,
	processors []Processor,
) *Component {
	return &Component{
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

func (c *Component) Start(ctx context.Context) error {
	c.log.InfoContext(ctx, "stage started")
	defer c.log.InfoContext(ctx, "stage stopped")
	defer close(c.shutdown.doneCh)

	ctx, cancel := context.WithCancel(ctx)
	c.shutdown.cancel = cancel
	defer cancel()

	for {
		select {
		case <-ctx.Done():
			shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), internal.DefaultComponentShutdownTimeout)
			defer shutdownCancel()
			return c.handleShutdown(shutdownCtx)
		default:
			if err := c.Process(ctx); err != nil {
				if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
					continue // let the select handle it
				}
				if errors.Is(err, models.ErrSignalSent) {
					c.log.ErrorContext(ctx, "signal to stop component is sent, exiting")
					return nil
				}
				c.log.ErrorContext(ctx, "batch processing failed", "error", err)
			}
		}
	}
}

// handleShutdown handles the shutdown logic
func (c *Component) handleShutdown(ctx context.Context) error {
	c.log.InfoContext(ctx, "stage shutting down")

	batchMessages, err := c.reader.ReadBatchNoWait(ctx)
	if err != nil {
		return fmt.Errorf("read batch: %w", err)
	}

	if len(batchMessages) == 0 {
		return nil
	}

	err = c.ProcessBatch(ctx, batchMessages)
	if err != nil {
		return fmt.Errorf("flush pending messages: %w", err)
	}

	for _, processor := range c.processors {
		err = processor.Close(ctx)
		if err != nil {
			c.log.ErrorContext(ctx, "failed to close processor", slog.String("error", err.Error()))
		}
	}

	return nil
}

func (c *Component) Done() <-chan struct{} {
	return c.shutdown.doneCh
}

// Shutdown gracefully stops the consumer
func (c *Component) Shutdown() {
	c.shutdown.shutdownOnce.Do(func() {
		if c.shutdown.cancel != nil {
			c.shutdown.cancel()
		}
	})
}

func (c *Component) Process(ctx context.Context) error {
	batchToProcess, err := c.reader.ReadBatch(ctx, models.WithBatchSize(100), models.WithTimeout(time.Millisecond))
	if err != nil {
		return fmt.Errorf("read: %w", err)
	}
	if len(batchToProcess) == 0 {
		return nil
	}

	return c.ProcessBatch(ctx, batchToProcess)
}

func (c *Component) writeFailedBatch(ctx context.Context, failedMessages []models.FailedMessage) error {
	messages := make([]models.Message, 0, len(failedMessages))
	for _, failedMessage := range failedMessages {
		msg, err := models.FailedMessageToMessage(
			failedMessage,
			c.role,
			failedMessage.Error,
		)
		if err != nil {
			return fmt.Errorf("map failed message to message: %w", err)
		}
		messages = append(messages, msg)
	}

	failedDlqMessages := c.dlqWriter.WriteBatch(ctx, messages)
	if len(failedDlqMessages) > 0 {
		return fmt.Errorf("failed to write to DLQ: %w", failedDlqMessages[0].Error)
	}

	return nil
}

func (c *Component) ProcessBatch(ctx context.Context, batch []models.Message) (err error) {
	if len(batch) == 0 {
		return nil
	}

	defer func() {
		if err != nil {
			// NAK messages on error to make them immediately available for redelivery
			if nakErr := c.reader.Nak(ctx, batch); nakErr != nil {
				c.log.ErrorContext(ctx, "failed to nak messages", "error", nakErr)
			}
		}
	}()

	messages, commits, err := c.runProcessors(ctx, batch)
	if err != nil {
		return fmt.Errorf("process: %w", err)
	}
	if len(messages) == 0 {
		return c.reader.Ack(ctx, batch)
	}

	failedMessages := c.writer.WriteBatch(ctx, messages)
	if len(failedMessages) > 0 {
		err = c.writeFailedBatch(ctx, failedMessages)
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

	return c.reader.Ack(ctx, batch)
}

func (c *Component) runProcessors(ctx context.Context, batch []models.Message) ([]models.Message, []func() error, error) {
	current := ProcessorBatch{Messages: batch}
	commits := make([]func() error, 0, len(c.processors))

	for _, proc := range c.processors {
		if len(current.Messages) == 0 {
			break
		}

		result := proc.ProcessBatch(ctx, current)

		if result.FatalError != nil {
			return nil, nil, result.FatalError
		}
		commits = append(commits, result.CommitFn)

		current = result
	}

	return current.Messages, commits, nil
}
