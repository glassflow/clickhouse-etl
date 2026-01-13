package processor

import (
	"context"
	"fmt"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

type dedup interface {
	FilterDuplicates(ctx context.Context, messages []models.Message) ([]models.Message, error)
	SaveKeys(ctx context.Context, messages []models.Message) error
	Close(ctx context.Context) error
}

type DedupProcessor struct {
	dedup dedup
}

func NewDedupProcessor(dedup dedup) *DedupProcessor {
	return &DedupProcessor{dedup: dedup}
}

func (dp *DedupProcessor) Close(ctx context.Context) error {
	return dp.dedup.Close(ctx)
}

func (dp *DedupProcessor) ProcessBatch(
	ctx context.Context,
	batch ProcessorBatch,
) ProcessorBatch {
	deduplicatedMessages, err := dp.dedup.FilterDuplicates(ctx, batch.Messages)
	if err != nil {
		return ProcessorBatch{
			FatalError: err,
		}
	}

	commitFn := func() error {
		err = dp.dedup.SaveKeys(ctx, deduplicatedMessages)
		if err != nil {
			return fmt.Errorf("dedup.SaveKeys: %w", err)
		}

		return nil
	}

	return ProcessorBatch{Messages: deduplicatedMessages, CommitFn: commitFn}
}
