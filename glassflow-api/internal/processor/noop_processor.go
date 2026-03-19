package processor

import "context"

// NoopProcessor
// we need NoopProcessor since filter -> dedup -> transform is hardcoded, so instead of changing code we would just
// provide noop processor if something is disabled.
// this would go away as soon as we start to manage what components are used from control plane.
type NoopProcessor struct{}

func (np *NoopProcessor) ProcessBatch(
	_ context.Context,
	batch ProcessorBatch,
) ProcessorBatch {
	return batch
}

func (np *NoopProcessor) Close(_ context.Context) error {
	return nil
}
