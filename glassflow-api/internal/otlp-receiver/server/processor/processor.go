package processor

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/avast/retry-go"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/batch"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/batch/nats"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/client"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/service"
	subjectrouter "github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/subject/router"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/pkg/observability"
)

type OTLPConfigFetcher interface {
	GetOTLPConfig(ctx context.Context, pipelineID string) (models.OTLPConfig, error)
}

func NewProcessor(
	otlpConfigFetcher OTLPConfigFetcher,
	nc *client.NATSClient,
) *Processor {
	return &Processor{
		otlpConfigFetcher: otlpConfigFetcher,
		natsWriterCache:   make(map[string]cacheEntry),
		nc:                nc,
	}
}

const natsWriterCacheTTL = 15 * time.Second

type cacheEntry struct {
	writer    batch.BatchWriter
	expiresAt time.Time
}

type Processor struct {
	otlpConfigFetcher OTLPConfigFetcher
	natsWriterCache   map[string]cacheEntry
	natsWriterMu      sync.RWMutex
	nc                *client.NATSClient
}

func (p *Processor) getNatsWriter(
	ctx context.Context,
	pipelineID string,
) (batch.BatchWriter, error) {
	p.natsWriterMu.RLock()
	entry, ok := p.natsWriterCache[pipelineID]
	p.natsWriterMu.RUnlock()
	if ok && !entry.expiresAt.Before(time.Now()) {
		return entry.writer, nil
	}

	otlpConfig, err := p.otlpConfigFetcher.GetOTLPConfig(ctx, pipelineID)
	if err != nil {
		return nil, fmt.Errorf("otlp config fetch: %w", err)
	}

	subjectRouter, err := subjectrouter.New(otlpConfig.Routing)
	if err != nil {
		return nil, fmt.Errorf("subjectrouter.New: %w", err)
	}

	newWriter := nats.NewBatchWriter(p.nc.JetStream(), subjectRouter)

	p.natsWriterMu.Lock()
	defer p.natsWriterMu.Unlock()

	if p.natsWriterCache == nil {
		p.natsWriterCache = make(map[string]cacheEntry)
	}

	if entry, ok := p.natsWriterCache[pipelineID]; ok && !entry.expiresAt.Before(time.Now()) {
		return entry.writer, nil
	}

	p.natsWriterCache[pipelineID] = cacheEntry{writer: newWriter, expiresAt: time.Now().Add(natsWriterCacheTTL)}
	return newWriter, nil
}

func (p *Processor) invalidateNatsWriter(pipelineID string) {
	p.natsWriterMu.Lock()
	defer p.natsWriterMu.Unlock()
	delete(p.natsWriterCache, pipelineID)
}

func (p *Processor) sendBatch(
	ctx context.Context,
	component observability.MetricComponent,
	pipelineID string,
	messages []models.Message,
) error {
	err := retry.Do(
		func() error {
			natsWriter, err := p.getNatsWriter(ctx, pipelineID)
			if err != nil {
				if errors.Is(err, service.ErrPipelineNotFound) {
					return retry.Unrecoverable(service.ErrPipelineNotFound)
				}
				return fmt.Errorf("getNatsWriter: %w", err)
			}

			failedMessages := natsWriter.WriteBatch(ctx, messages)
			if len(failedMessages) > 0 {
				p.invalidateNatsWriter(pipelineID)
				messages = extractMessages(failedMessages)
				return fmt.Errorf("write batch: %w", failedMessages[0].Error)
			}

			return nil
		},
		retry.Attempts(5),
		retry.Delay(time.Second),
		retry.LastErrorOnly(true),
	)
	if err != nil {
		return err
	}

	var bytesOut int64
	for _, msg := range messages {
		bytesOut += int64(len(msg.Payload()))
	}
	observability.RecordBytesProcessed(ctx, component.String(), "out", bytesOut)
	observability.RecordProcessorMessages(ctx, component.String(), "out", int64(len(messages)))

	return nil
}

func extractMessages(failed []models.FailedMessage) []models.Message {
	msgs := make([]models.Message, len(failed))
	for i, fm := range failed {
		msgs[i] = fm.Message
	}
	return msgs
}
