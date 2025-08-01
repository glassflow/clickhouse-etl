package service

import (
	"context"
	"log/slog"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

// TODO: add k8s client
type K8sOrchestrator struct {
	log *slog.Logger
}

func NewK8sOrchestrator(
	log *slog.Logger,
) Orchestrator {
	return &K8sOrchestrator{
		log: log,
	}
}

var _ Orchestrator = (*K8sOrchestrator)(nil)

// SetupPipeline implements Orchestrator.
func (k *K8sOrchestrator) SetupPipeline(_ context.Context, _ *models.PipelineConfig) error {
	panic("unimplemented")
}

// ShutdownPipeline implements Orchestrator.
func (k *K8sOrchestrator) ShutdownPipeline(_ context.Context, _ string) error {
	panic("unimplemented")
}
