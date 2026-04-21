package processor

import (
	"context"
	"fmt"

	colmetricspb "go.opentelemetry.io/proto/otlp/collector/metrics/v1"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/otlp-receiver/server/processor/flattener"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/pkg/observability"
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

	err = p.sendBatch(
		ctx,
		observability.MetricComponentOTLPMetrics,
		pipelineID,
		messages,
	)
	if err != nil {
		return err
	}

	return nil
}
