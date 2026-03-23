package processor

import (
	"context"
	"fmt"
	"sync"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/batch"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/batch/nats"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/client"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	subjectrouter "github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/subject/router"
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
		natsWriterCache:   make(map[string]batch.BatchWriter),
		nc:                nc,
	}
}

type Processor struct {
	otlpConfigFetcher OTLPConfigFetcher
	natsWriterCache   map[string]batch.BatchWriter
	natsWriterMu      sync.RWMutex
	nc                *client.NATSClient
}

func (p *Processor) getNatsWriter(
	ctx context.Context,
	pipelineID string,
) (batch.BatchWriter, error) {
	p.natsWriterMu.RLock()
	natsWriter, ok := p.natsWriterCache[pipelineID]
	p.natsWriterMu.RUnlock()
	if ok {
		return natsWriter, nil
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
		p.natsWriterCache = make(map[string]batch.BatchWriter)
	}

	if natsWriter, ok := p.natsWriterCache[pipelineID]; ok {
		return natsWriter, nil
	}

	p.natsWriterCache[pipelineID] = newWriter
	return newWriter, nil
}
