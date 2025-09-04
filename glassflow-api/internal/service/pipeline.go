package service

import (
	"context"
	"errors"
	"fmt"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

type Orchestrator interface {
	GetType() string
	SetupPipeline(ctx context.Context, cfg *models.PipelineConfig) error
	ShutdownPipeline(ctx context.Context, pid string) error
	TerminatePipeline(ctx context.Context, pid string) error
}

type PipelineStore interface {
	InsertPipeline(ctx context.Context, pi models.PipelineConfig) error
	DeletePipeline(ctx context.Context, pid string) error
	GetPipeline(ctx context.Context, pid string) (*models.PipelineConfig, error)
	GetPipelines(ctx context.Context) ([]models.PipelineConfig, error)
	PatchPipelineName(ctx context.Context, pid string, name string) error
	UpdatePipelineStatus(ctx context.Context, pid string, status models.PipelineHealth) error
}

type PipelineManager interface {
	CreatePipeline(ctx context.Context, cfg *models.PipelineConfig) error
	DeletePipeline(ctx context.Context, pid string) error
	TerminatePipeline(ctx context.Context, pid string) error
	PausePipeline(ctx context.Context, pid string) error
	ResumePipeline(ctx context.Context, pid string) error
	GetPipeline(ctx context.Context, pid string) (models.PipelineConfig, error)
	GetPipelines(ctx context.Context) ([]models.ListPipelineConfig, error)
	UpdatePipelineName(ctx context.Context, id string, name string) error
	GetPipelineHealth(ctx context.Context, pid string) (models.PipelineHealth, error)
	GetOrchestratorType() string
}

type PipelineManagerImpl struct {
	orchestrator Orchestrator
	db           PipelineStore
}

func NewPipelineManager(orch Orchestrator, db PipelineStore) *PipelineManagerImpl {
	return &PipelineManagerImpl{
		orchestrator: orch,
		db:           db,
	}
}

var (
	ErrIDExists             = errors.New("pipeline with this ID already exists")
	ErrPipelineNotFound     = errors.New("no active pipeline found")
	ErrNotImplemented       = errors.New("feature is not implemented")
	ErrPipelineNotExists    = errors.New("no pipeline with given id exists")
	ErrPipelineQuotaReached = errors.New("pipeline quota reached; shutdown active pipeline(s)")
)

var _ PipelineManager = (*PipelineManagerImpl)(nil)

// CreatePipeline implements PipelineManager.
func (p *PipelineManagerImpl) CreatePipeline(ctx context.Context, cfg *models.PipelineConfig) error {
	existing, err := p.db.GetPipeline(ctx, cfg.ID)
	if err != nil && !errors.Is(err, ErrPipelineNotExists) {
		return fmt.Errorf("check existing pipeline ID: %w", err)
	}

	if existing != nil {
		return fmt.Errorf("create pipeline: %w", ErrIDExists)
	}

	// Set initial status to Created
	cfg.Status = models.NewPipelineHealth(cfg.ID, cfg.Name)
	if p.orchestrator.GetType() == "local" {
		// Since we don't have separate operator to update status
		cfg.Status.OverallStatus = models.PipelineStatus(internal.PipelineStatusRunning)
	}

	err = p.orchestrator.SetupPipeline(ctx, cfg)
	if err != nil {
		return fmt.Errorf("create pipeline: %w", err)
	}

	err = p.db.InsertPipeline(ctx, *cfg)
	if err != nil {
		return fmt.Errorf("insert pipeline: %w", err)
	}

	return nil
}

// DeletePipeline implements PipelineManager.
func (p *PipelineManagerImpl) DeletePipeline(ctx context.Context, pid string) error {
	// TODO: change this to match with implementation for k8s orchestrator
	err := p.orchestrator.ShutdownPipeline(ctx, pid)
	if err != nil {
		return fmt.Errorf("shutdown pipeline: %w", err)
	}

	err = p.db.DeletePipeline(ctx, pid)
	if err != nil {
		return fmt.Errorf("shutdown pipeline: %w", err)
	}

	return nil
}

// TerminatePipeline implements PipelineManager.
func (p *PipelineManagerImpl) TerminatePipeline(ctx context.Context, pid string) error {
	// Get current pipeline to update status
	pipeline, err := p.db.GetPipeline(ctx, pid)
	if err != nil {
		if errors.Is(err, ErrPipelineNotExists) {
			return ErrPipelineNotExists
		}
		return fmt.Errorf("get pipeline failed for termination: %w", err)
	}

	if pipeline.Status.OverallStatus == internal.PipelineStatusTerminated {
		return ErrPipelineNotExists
	}

	// Set status to Terminating
	pipeline.Status.OverallStatus = internal.PipelineStatusTerminating

	// Update status in database
	err = p.db.UpdatePipelineStatus(ctx, pid, pipeline.Status)
	if err != nil {
		return fmt.Errorf("update pipeline status: %w", err)
	}

	err = p.orchestrator.TerminatePipeline(ctx, pid)
	if err != nil {
		return fmt.Errorf("shutdown pipeline: %w", err)
	}

	// in case of k8 orchestrator the operator controller-manager takes care of updating this status
	if p.orchestrator.GetType() == "local" {
		// Set status to Terminated
		pipeline.Status.OverallStatus = internal.PipelineStatusTerminated

		// Update status in database
		err = p.db.UpdatePipelineStatus(ctx, pid, pipeline.Status)
		if err != nil {
			return fmt.Errorf("update pipeline status: %w", err)
		}
		return nil
	}

	return nil
}

// PausePipeline implements PipelineManager.
func (p *PipelineManagerImpl) PausePipeline(ctx context.Context, pid string) error {
	// Get current pipeline to validate state and update status
	pipeline, err := p.db.GetPipeline(ctx, pid)
	if err != nil {
		if errors.Is(err, ErrPipelineNotExists) {
			return ErrPipelineNotExists
		}
		return fmt.Errorf("get pipeline failed for pause: %w", err)
	}

	// Validate that pipeline can transition to pausing state
	if !pipeline.Status.CanTransitionTo(models.PipelineStatus(internal.PipelineStatusPausing)) {
		return fmt.Errorf("pipeline cannot be paused from current state: %s", pipeline.Status.OverallStatus)
	}

	// Set status to Pausing
	err = pipeline.Status.TransitionTo(models.PipelineStatus(internal.PipelineStatusPausing))
	if err != nil {
		return fmt.Errorf("transition to pausing state: %w", err)
	}

	// Update status in database
	err = p.db.UpdatePipelineStatus(ctx, pid, pipeline.Status)
	if err != nil {
		return fmt.Errorf("update pipeline status: %w", err)
	}

	// TODO: Call orchestrator to handle pause logic
	// This will be implemented in the next step when we add orchestrator methods
	// err = p.orchestrator.PausePipeline(ctx, pid)
	// if err != nil {
	//     return fmt.Errorf("pause pipeline: %w", err)
	// }

	return nil
}

// ResumePipeline implements PipelineManager.
func (p *PipelineManagerImpl) ResumePipeline(ctx context.Context, pid string) error {
	// Get current pipeline to validate state and update status
	pipeline, err := p.db.GetPipeline(ctx, pid)
	if err != nil {
		if errors.Is(err, ErrPipelineNotExists) {
			return ErrPipelineNotExists
		}
		return fmt.Errorf("get pipeline failed for resume: %w", err)
	}

	// Validate that pipeline can transition to resuming state
	if !pipeline.Status.CanTransitionTo(models.PipelineStatus(internal.PipelineStatusResuming)) {
		return fmt.Errorf("pipeline cannot be resumed from current state: %s", pipeline.Status.OverallStatus)
	}

	// Set status to Resuming
	err = pipeline.Status.TransitionTo(models.PipelineStatus(internal.PipelineStatusResuming))
	if err != nil {
		return fmt.Errorf("transition to resuming state: %w", err)
	}

	// Update status in database
	err = p.db.UpdatePipelineStatus(ctx, pid, pipeline.Status)
	if err != nil {
		return fmt.Errorf("update pipeline status: %w", err)
	}

	// TODO: Call orchestrator to handle resume logic
	// This will be implemented in the next step when we add orchestrator methods
	// err = p.orchestrator.ResumePipeline(ctx, pid)
	// if err != nil {
	//     return fmt.Errorf("resume pipeline: %w", err)
	// }

	return nil
}

// GetPipeline implements PipelineManager.
func (p *PipelineManagerImpl) GetPipeline(ctx context.Context, pid string) (zero models.PipelineConfig, _ error) {
	pi, err := p.db.GetPipeline(ctx, pid)
	if err != nil {
		return zero, fmt.Errorf("load pipeline: %w", err)
	}

	return *pi, nil
}

// GetPipelines implements PipelineManager.
func (p *PipelineManagerImpl) GetPipelines(ctx context.Context) ([]models.ListPipelineConfig, error) {
	pipelines, err := p.db.GetPipelines(ctx)
	if err != nil {
		return nil, fmt.Errorf("load pipelines: %w", err)
	}

	ps := make([]models.ListPipelineConfig, 0, len(pipelines))
	for _, p := range pipelines {
		ps = append(ps, p.ToListPipeline())
	}

	return ps, nil
}

// UpdatePipelineName implements PipelineManager.
func (p *PipelineManagerImpl) UpdatePipelineName(ctx context.Context, id string, name string) error {
	err := p.db.PatchPipelineName(ctx, id, name)
	if err != nil {
		return fmt.Errorf("update pipeline: %w", err)
	}

	return nil
}

// GetPipelineHealth implements PipelineManager.
func (p *PipelineManagerImpl) GetPipelineHealth(ctx context.Context, pid string) (models.PipelineHealth, error) {
	pipeline, err := p.db.GetPipeline(ctx, pid)
	if err != nil {
		if errors.Is(err, ErrPipelineNotExists) {
			return models.PipelineHealth{}, ErrPipelineNotFound
		}
		return models.PipelineHealth{}, fmt.Errorf("get pipeline health: %w", err)
	}

	return pipeline.Status, nil
}

// UpdatePipelineStatus implements PipelineManager.
func (p *PipelineManagerImpl) UpdatePipelineStatus(ctx context.Context, pid string, status models.PipelineHealth) error {
	err := p.db.UpdatePipelineStatus(ctx, pid, status)
	if err != nil {
		return fmt.Errorf("update pipeline status: %w", err)
	}

	return nil
}

// GetOrchestratorType implements PipelineManager.
func (p *PipelineManagerImpl) GetOrchestratorType() string {
	return p.orchestrator.GetType()
}
