package processor

import (
	"context"
	"fmt"

	colmetricspb "go.opentelemetry.io/proto/otlp/collector/metrics/v1"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/otlp-receiver/server/processor/flattener"
)

func (p *Processor) ProcessMetrics(
	ctx context.Context,
	pipelineID string,
	exportMetricsRequest *colmetricspb.ExportMetricsServiceRequest,
) error {
	messages, err := flattener.FlattenMetrics(exportMetricsRequest)
	if err != nil {
		return fmt.Errorf("flattenMetrics: %w", err)
	}

	return p.sendBatch(ctx, pipelineID, messages)
}
