package processor

import (
	"context"
	"fmt"

	collogspb "go.opentelemetry.io/proto/otlp/collector/logs/v1"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

func (p *Processor) ProcessOTLPLogs(
	ctx context.Context,
	pipelineID string,
	exportLogsRequest *collogspb.ExportLogsServiceRequest,
) error {
	messages, err := p.flattenLogs(exportLogsRequest)
	if err != nil {
		return fmt.Errorf("flattenLogs: %w", err)
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

func (p *Processor) flattenLogs(exportLogsRequest *collogspb.ExportLogsServiceRequest) ([]models.Message, error) {
	return nil, fmt.Errorf("not implemented yet")
}
