package processor

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/avast/retry-go"
	"github.com/tidwall/gjson"

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
		natsWriterCache:   make(map[string]writerConfig),
		nc:                nc,
	}
}

const natsWriterCacheTTL = 60 * time.Second

type writerConfig struct {
	nats          batch.BatchWriter
	routingConfig models.OTLPConfig
	expiresAt     time.Time
}

type Processor struct {
	otlpConfigFetcher OTLPConfigFetcher
	natsWriterCache   map[string]writerConfig
	natsWriterMu      sync.RWMutex
	nc                *client.NATSClient
}

func (p *Processor) getWriterConfig(
	ctx context.Context,
	pipelineID string,
) (writerConfig, error) {
	p.natsWriterMu.RLock()
	entry, ok := p.natsWriterCache[pipelineID]
	p.natsWriterMu.RUnlock()
	if ok && !entry.expiresAt.Before(time.Now()) {
		return entry, nil
	}

	otlpConfig, err := p.otlpConfigFetcher.GetOTLPConfig(ctx, pipelineID)
	if err != nil {
		return writerConfig{}, fmt.Errorf("otlp config fetch: %w", err)
	}

	subjectRouter, err := subjectrouter.New(otlpConfig.Routing)
	if err != nil {
		return writerConfig{}, fmt.Errorf("subjectrouter.New: %w", err)
	}

	newWriterConfig := nats.NewBatchWriter(p.nc.JetStream(), subjectRouter)

	p.natsWriterMu.Lock()
	defer p.natsWriterMu.Unlock()

	if p.natsWriterCache == nil {
		p.natsWriterCache = make(map[string]writerConfig)
	}

	if entry, ok := p.natsWriterCache[pipelineID]; ok && !entry.expiresAt.Before(time.Now()) {
		return entry, nil
	}

	p.natsWriterCache[pipelineID] = writerConfig{
		nats:          newWriterConfig,
		routingConfig: otlpConfig,
		expiresAt:     time.Now().Add(natsWriterCacheTTL),
	}

	return p.natsWriterCache[pipelineID], nil
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
			cfg, err := p.getWriterConfig(ctx, pipelineID)
			if err != nil {
				if errors.Is(err, service.ErrPipelineNotFound) {
					return retry.Unrecoverable(service.ErrPipelineNotFound)
				}
				return fmt.Errorf("getWriterConfig: %w", err)
			}

			// for now RoutingTypeField will be used for dedup based routing
			if cfg.routingConfig.Routing.Type == models.RoutingTypeField {
				messages, err = setupNatsDedupHeader(cfg, messages)
				if err != nil {
					return retry.Unrecoverable(err)
				}
			}

			failedMessages := cfg.nats.WriteBatch(ctx, messages)
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

func setupNatsDedupHeader(cfg writerConfig, messages []models.Message) ([]models.Message, error) {
	for i := range messages {
		dedupValue := gjson.GetBytes(
			messages[i].Payload(),
			cfg.routingConfig.Routing.Field.Name,
		).String()

		if dedupValue == "" {
			return nil, errors.New("dedup value is empty")
		}
		messages[i].SetHeader("Nats-Msg-Id", dedupValue)
	}

	return messages, nil
}
