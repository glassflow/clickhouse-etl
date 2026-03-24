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
