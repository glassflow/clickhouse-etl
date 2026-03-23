package processor

import (
	"context"
	"fmt"

	coltracepb "go.opentelemetry.io/proto/otlp/collector/trace/v1"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

func (p *Processor) ProcessTraces(
	ctx context.Context,
	pipelineID string,
	exportTracesRequest *coltracepb.ExportTraceServiceRequest,
) error {
	messages, err := p.flattenTraces(exportTracesRequest)
	if err != nil {
		return fmt.Errorf("flattenMetrics: %w", err)
	}

	natsWriter, err := p.getNatsWriter(ctx, pipelineID)
	if err != nil {
		return fmt.Errorf("getNatsWriter: %w", err)
	}

	failedMessages := natsWriter.WriteBatch(ctx, messages)
	if len(failedMessages) > 0 {
		return fmt.Errorf("write batch: %w", failedMessages[0].Error)
	}

	return nil
}

func (p *Processor) flattenTraces(exportTracesRequest *coltracepb.ExportTraceServiceRequest) ([]models.Message, error) {
	return nil, fmt.Errorf("not implemented yet")
}
