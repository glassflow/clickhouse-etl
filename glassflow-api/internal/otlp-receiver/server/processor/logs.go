package processor

import (
	"context"
	"fmt"

	collogspb "go.opentelemetry.io/proto/otlp/collector/logs/v1"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/otlp-receiver/server/processor/flattener"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/pkg/observability"
)

func (p *Processor) ProcessLogs(
	ctx context.Context,
	pipelineID string,
	exportLogsRequest *collogspb.ExportLogsServiceRequest,
) error {
	messages, err := flattener.FlattenLogs(exportLogsRequest)
	if err != nil {
		return fmt.Errorf("FlattenLogs: %w", err)
	}

	err = p.sendBatch(
		ctx,
		observability.MetricComponentOTLPLogs,
		pipelineID,
		messages,
	)
	if err != nil {
		return err
	}

	return nil
}
