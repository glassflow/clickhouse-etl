package processor

import (
	"context"
	"fmt"
	"time"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/pkg/observability"
)

type dedup interface {
	FilterDuplicates(ctx context.Context, messages []models.Message) ([]models.Message, error)
	SaveKeys(ctx context.Context, messages []models.Message) error
	Close(ctx context.Context) error
}

type DedupProcessor struct {
	dedup dedup
	meter *observability.Meter
}

func NewDedupProcessor(dedup dedup, meter *observability.Meter) *DedupProcessor {
	return &DedupProcessor{
		dedup: dedup,
		meter: meter,
	}
}

func (dp *DedupProcessor) Close(ctx context.Context) error {
	return dp.dedup.Close(ctx)
}

func (dp *DedupProcessor) ProcessBatch(
	ctx context.Context,
	batch ProcessorBatch,
) ProcessorBatch {
	start := time.Now()

	var inBytes int64
	for _, msg := range batch.Messages {
		inBytes += int64(len(msg.Payload()))
	}

	if dp.meter != nil {
		dp.meter.RecordBytesProcessed(ctx, "dedup", "in", inBytes)
	}

	deduplicatedMessages, err := dp.dedup.FilterDuplicates(ctx, batch.Messages)
	if err != nil {
		return ProcessorBatch{
			FatalError: err,
		}
	}

	lookupDuration := time.Since(start).Seconds()
	if dp.meter != nil {
		dp.meter.RecordProcessingDuration(ctx, "dedup_filter", lookupDuration)
		duplicatesFound := int64(len(batch.Messages) - len(deduplicatedMessages))
		if duplicatesFound > 0 {
			dp.meter.RecordProcessorMessages(ctx, "dedup", "duplicate", duplicatesFound)
		}
		if len(deduplicatedMessages) > 0 {
			dp.meter.RecordProcessorMessages(ctx, "dedup", "success", int64(len(deduplicatedMessages)))
		}

		var outBytes int64
		for _, msg := range deduplicatedMessages {
			outBytes += int64(len(msg.Payload()))
		}
		dp.meter.RecordBytesProcessed(ctx, "dedup", "out", outBytes)
	}

	commitFn := func() error {
		commitStart := time.Now()
		err = dp.dedup.SaveKeys(ctx, deduplicatedMessages)
		if err != nil {
			return fmt.Errorf("dedup.SaveKeys: %w", err)
		}

		commitDuration := time.Since(commitStart).Seconds()
		if dp.meter != nil {
			dp.meter.RecordProcessingDuration(ctx, "dedup_write", commitDuration)
		}

		return nil
	}

	return ProcessorBatch{Messages: deduplicatedMessages, CommitFn: commitFn}
}
