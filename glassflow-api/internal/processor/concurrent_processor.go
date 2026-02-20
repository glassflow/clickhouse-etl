package processor

import (
	"context"
	"fmt"
	"sync"
)

// ConcurrentProcessor splits a batch into N sub-batches, runs each through the
// processor pipeline concurrently, and combines the results.
type ConcurrentProcessor struct {
	processors []Processor
	numWorkers int
}

func NewConcurrentProcessor(numWorkers int, processors []Processor) *ConcurrentProcessor {
	if numWorkers < 1 {
		numWorkers = 1
	}
	return &ConcurrentProcessor{
		processors: processors,
		numWorkers: numWorkers,
	}
}

func (cp *ConcurrentProcessor) ProcessBatch(ctx context.Context, input ProcessorBatch) ProcessorBatch {
	if len(input.Messages) == 0 {
		return input
	}

	subBatches := splitIntoSubBatches(input, cp.numWorkers)

	type indexedResult struct {
		index  int
		result ProcessorBatch
	}

	resultCh := make(chan indexedResult, len(subBatches))

	var wg sync.WaitGroup
	for i, subBatch := range subBatches {
		wg.Add(1)
		go func(idx int, batch ProcessorBatch) {
			defer wg.Done()
			current := batch
			for _, proc := range cp.processors {
				if len(current.Messages) == 0 {
					break
				}
				result := proc.ProcessBatch(ctx, current)
				if result.FatalError != nil {
					resultCh <- indexedResult{index: idx, result: result}
					return
				}
				current = result
			}
			resultCh <- indexedResult{index: idx, result: current}
		}(i, subBatch)
	}

	go func() {
		wg.Wait()
		close(resultCh)
	}()

	results := make([]ProcessorBatch, len(subBatches))
	for r := range resultCh {
		results[r.index] = r.result
	}

	combined := ProcessorBatch{}
	for _, r := range results {
		if r.FatalError != nil {
			return ProcessorBatch{FatalError: r.FatalError}
		}
		combined.Messages = append(combined.Messages, r.Messages...)
		combined.FailedMessages = append(combined.FailedMessages, r.FailedMessages...)
		combined.CommitFn = append(combined.CommitFn, r.CommitFn...)
	}

	return combined
}

func (cp *ConcurrentProcessor) Close(ctx context.Context) error {
	for _, proc := range cp.processors {
		if err := proc.Close(ctx); err != nil {
			return fmt.Errorf("close processor: %w", err)
		}
	}
	return nil
}

// splitIntoSubBatches divides a batch's messages into at most n sub-batches.
func splitIntoSubBatches(batch ProcessorBatch, n int) []ProcessorBatch {
	total := len(batch.Messages)
	if n > total {
		n = total
	}

	chunkSize := (total + n - 1) / n // ceiling division to distribute remainder

	chunks := make([]ProcessorBatch, 0, n)
	for start := 0; start < total; start += chunkSize {
		end := start + chunkSize
		if end > total {
			end = total
		}
		chunks = append(chunks, ProcessorBatch{Messages: batch.Messages[start:end]})
	}
	return chunks
}
