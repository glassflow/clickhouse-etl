package processor

import (
	"context"
	"fmt"

	coltracepb "go.opentelemetry.io/proto/otlp/collector/trace/v1"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/otlp-receiver/server/processor/flattener"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/pkg/observability"
)

func (p *Processor) ProcessTraces(
	ctx context.Context,
	pipelineID string,
	exportTracesRequest *coltracepb.ExportTraceServiceRequest,
) error {
	messages, err := flattener.FlattenTraces(exportTracesRequest)
	if err != nil {
		return fmt.Errorf("flattenTraces: %w", err)
	}

	err = p.sendBatch(
		ctx,
		observability.MetricComponentOTLPTraces,
		pipelineID,
		messages,
	)
	if err != nil {
		return err
	}

	return nil
}
