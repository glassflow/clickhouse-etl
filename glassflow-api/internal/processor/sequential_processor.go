package processor

import (
	"context"
)

type SequentialProcessor struct {
	processors []Processor
}

func NewSequentialProcessor(processors []Processor) SequentialProcessor {
	return SequentialProcessor{processors: processors}
}

func (sp *SequentialProcessor) ProcessBatch(
	ctx context.Context,
	current ProcessorBatch,
) ProcessorBatch {
	commits := make([]func() error, 0, len(sp.processors))

	for _, proc := range sp.processors {
		if len(current.Messages) == 0 {
			break
		}

		result := proc.ProcessBatch(ctx, current)

		if result.FatalError != nil {
			return ProcessorBatch{FatalError: result.FatalError}
		}
		commits = append(commits, result.CommitFn...)

		current = result
	}

	return current
}
