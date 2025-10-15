package service

import (
	"context"
	"errors"
	"fmt"
	"log/slog"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/status"
)

type Orchestrator interface {
	GetType() string
	SetupPipeline(ctx context.Context, cfg *models.PipelineConfig) error
	StopPipeline(ctx context.Context, pid string) error
	TerminatePipeline(ctx context.Context, pid string) error
	DeletePipeline(ctx context.Context, pid string) error
	ResumePipeline(ctx context.Context, pid string) error
	EditPipeline(ctx context.Context, pid string, newCfg *models.PipelineConfig) error
}

type PipelineStore interface {
	InsertPipeline(ctx context.Context, pi models.PipelineConfig) error
	DeletePipeline(ctx context.Context, pid string) error
	GetPipeline(ctx context.Context, pid string) (*models.PipelineConfig, error)
	GetPipelines(ctx context.Context) ([]models.PipelineConfig, error)
	PatchPipelineName(ctx context.Context, pid string, name string) error
	UpdatePipelineStatus(ctx context.Context, pid string, status models.PipelineHealth) error
	UpdatePipeline(ctx context.Context, pid string, cfg models.PipelineConfig) error
}

type PipelineManager interface { //nolint:interfacebloat //important interface
	CreatePipeline(ctx context.Context, cfg *models.PipelineConfig) error
	DeletePipeline(ctx context.Context, pid string) error
	TerminatePipeline(ctx context.Context, pid string) error
	ResumePipeline(ctx context.Context, pid string) error
	StopPipeline(ctx context.Context, pid string) error
	EditPipeline(ctx context.Context, pid string, newCfg *models.PipelineConfig) error
	GetPipeline(ctx context.Context, pid string) (models.PipelineConfig, error)
	GetPipelines(ctx context.Context) ([]models.ListPipelineConfig, error)
	UpdatePipelineName(ctx context.Context, id string, name string) error
	GetPipelineHealth(ctx context.Context, pid string) (models.PipelineHealth, error)
	GetOrchestratorType() string
	CleanUpPipelines(ctx context.Context) error
}

type PipelineManagerImpl struct {
	orchestrator Orchestrator
	db           PipelineStore
	log          *slog.Logger
}

func NewPipelineManager(orch Orchestrator, db PipelineStore, log *slog.Logger) *PipelineManagerImpl {
	return &PipelineManagerImpl{
		orchestrator: orch,
		db:           db,
		log:          log,
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
		p.log.ErrorContext(ctx, "failed to check existing pipeline ID", "pipeline_id", cfg.ID, "error", err)
		return fmt.Errorf("check existing pipeline ID: %w", err)
	}

	if existing != nil {
		p.log.ErrorContext(ctx, "pipeline ID already exists", "pipeline_id", cfg.ID)
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
		p.log.ErrorContext(ctx, "failed to setup pipeline in orchestrator", "pipeline_id", cfg.ID, "error", err)
		return fmt.Errorf("create pipeline: %w", err)
	}

	err = p.db.InsertPipeline(ctx, *cfg)
	if err != nil {
		p.log.ErrorContext(ctx, "failed to insert pipeline to database", "pipeline_id", cfg.ID, "error", err)
		return fmt.Errorf("insert pipeline: %w", err)
	}

	return nil
}

// DeletePipeline implements PipelineManager.
func (p *PipelineManagerImpl) DeletePipeline(ctx context.Context, pid string) error {
	// First call orchestrator to handle resource cleanup
	err := p.orchestrator.DeletePipeline(ctx, pid)
	if err != nil {
		p.log.ErrorContext(ctx, "failed to delete pipeline from orchestrator", "pipeline_id", pid, "error", err)
		return fmt.Errorf("delete pipeline from orchestrator: %w", err)
	}

	// in case of k8 orchestrator the operator controller-manager takes care of deleting this from KV
	if p.orchestrator.GetType() == "local" {
		// Then delete from database/KV store
		err = p.db.DeletePipeline(ctx, pid)
		if err != nil {
			p.log.ErrorContext(ctx, "failed to delete pipeline from database", "pipeline_id", pid, "error", err)
			return fmt.Errorf("delete pipeline from database: %w", err)
		}
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
		p.log.ErrorContext(ctx, "failed to get pipeline for termination", "pipeline_id", pid, "error", err)
		return fmt.Errorf("get pipeline failed for termination: %w", err)
	}

	err = status.ValidatePipelineOperation(pipeline, internal.PipelineStatusTerminating)
	if err != nil {
		return err
	}

	// Set status to Terminating
	pipeline.Status.OverallStatus = internal.PipelineStatusTerminating

	// Update status in database
	err = p.db.UpdatePipelineStatus(ctx, pid, pipeline.Status)
	if err != nil {
		p.log.ErrorContext(ctx, "failed to update pipeline status to terminating", "pipeline_id", pid, "error", err)
		return fmt.Errorf("update pipeline status: %w", err)
	}

	err = p.orchestrator.TerminatePipeline(ctx, pid)
	if err != nil {
		p.log.ErrorContext(ctx, "failed to terminate pipeline in orchestrator", "pipeline_id", pid, "error", err)
		return fmt.Errorf("shutdown pipeline: %w", err)
	}

	// in case of k8 orchestrator the operator controller-manager takes care of updating this status
	if p.orchestrator.GetType() == "local" {
		pipeline.Status.OverallStatus = internal.PipelineStatusStopped

		// Update status in database
		err = p.db.UpdatePipelineStatus(ctx, pid, pipeline.Status)
		if err != nil {
			p.log.ErrorContext(ctx, "failed to update pipeline status to stopped", "pipeline_id", pid, "error", err)
			return fmt.Errorf("update pipeline status: %w", err)
		}
		return nil
	}

	return nil
}

// GetPipeline implements PipelineManager.
func (p *PipelineManagerImpl) GetPipeline(ctx context.Context, pid string) (zero models.PipelineConfig, _ error) {
	pi, err := p.db.GetPipeline(ctx, pid)
	if err != nil {
		p.log.ErrorContext(ctx, "failed to load pipeline from database", "pipeline_id", pid, "error", err)
		return zero, fmt.Errorf("load pipeline: %w", err)
	}

	return *pi, nil
}

// GetPipelines implements PipelineManager.
func (p *PipelineManagerImpl) GetPipelines(ctx context.Context) ([]models.ListPipelineConfig, error) {
	pipelines, err := p.db.GetPipelines(ctx)
	if err != nil {
		p.log.ErrorContext(ctx, "failed to load pipelines from database", "error", err)
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
		p.log.ErrorContext(ctx, "failed to update pipeline name", "pipeline_id", id, "new_name", name, "error", err)
		return fmt.Errorf("update pipeline: %w", err)
	}

	return nil
}

// GetPipelineHealth implements PipelineManager.
func (p *PipelineManagerImpl) GetPipelineHealth(ctx context.Context, pid string) (models.PipelineHealth, error) {
	pipeline, err := p.db.GetPipeline(ctx, pid)
	if err != nil {
		if errors.Is(err, ErrPipelineNotExists) {
			return models.PipelineHealth{}, ErrPipelineNotExists
		}
		p.log.ErrorContext(ctx, "failed to get pipeline health", "pipeline_id", pid, "error", err)
		return models.PipelineHealth{}, fmt.Errorf("get pipeline health: %w", err)
	}

	return pipeline.Status, nil
}

// UpdatePipelineStatus implements PipelineManager.
func (p *PipelineManagerImpl) UpdatePipelineStatus(ctx context.Context, pid string, status models.PipelineHealth) error {
	err := p.db.UpdatePipelineStatus(ctx, pid, status)
	if err != nil {
		p.log.ErrorContext(ctx, "failed to update pipeline status", "pipeline_id", pid, "status", status.OverallStatus, "error", err)
		return fmt.Errorf("update pipeline status: %w", err)
	}

	return nil
}

// ResumePipeline implements PipelineManager.
func (p *PipelineManagerImpl) ResumePipeline(ctx context.Context, pid string) error {
	// Get current pipeline to update status
	pipeline, err := p.db.GetPipeline(ctx, pid)
	if err != nil {
		if errors.Is(err, ErrPipelineNotExists) {
			return ErrPipelineNotExists
		}
		p.log.ErrorContext(ctx, "failed to get pipeline for resume", "pipeline_id", pid, "error", err)
		return fmt.Errorf("get pipeline failed for resume: %w", err)
	}

	err = status.ValidatePipelineOperation(pipeline, internal.PipelineStatusResuming)
	if err != nil {
		return err
	}

	// Set status to Resuming
	pipeline.Status.OverallStatus = internal.PipelineStatusResuming

	// Update status in database
	err = p.db.UpdatePipelineStatus(ctx, pid, pipeline.Status)
	if err != nil {
		p.log.ErrorContext(ctx, "failed to update pipeline status to resuming", "pipeline_id", pid, "error", err)
		return fmt.Errorf("update pipeline status: %w", err)
	}

	err = p.orchestrator.ResumePipeline(ctx, pid)
	if err != nil {
		p.log.ErrorContext(ctx, "failed to resume pipeline in orchestrator", "pipeline_id", pid, "error", err)
		return fmt.Errorf("resume pipeline: %w", err)
	}

	// in case of k8 orchestrator the operator controller-manager takes care of updating this status
	if p.orchestrator.GetType() == "local" {
		// Set status to Running
		pipeline.Status.OverallStatus = internal.PipelineStatusRunning

		// Update status in database
		err = p.db.UpdatePipelineStatus(ctx, pid, pipeline.Status)
		if err != nil {
			p.log.ErrorContext(ctx, "failed to update pipeline status to running", "pipeline_id", pid, "error", err)
			return fmt.Errorf("update pipeline status: %w", err)
		}
		return nil
	}

	return nil
}

// StopPipeline implements PipelineManager.
func (p *PipelineManagerImpl) StopPipeline(ctx context.Context, pid string) error {
	// Get current pipeline to update status
	pipeline, err := p.db.GetPipeline(ctx, pid)
	if err != nil {
		if errors.Is(err, ErrPipelineNotExists) {
			return ErrPipelineNotExists
		}
		p.log.ErrorContext(ctx, "failed to get pipeline for stop", "pipeline_id", pid, "error", err)
		return fmt.Errorf("get pipeline failed for stop: %w", err)
	}

	err = status.ValidatePipelineOperation(pipeline, internal.PipelineStatusStopping)
	if err != nil {
		return err
	}

	// Set status to Stopping
	pipeline.Status.OverallStatus = internal.PipelineStatusStopping

	// Update status in database
	err = p.db.UpdatePipelineStatus(ctx, pid, pipeline.Status)
	if err != nil {
		p.log.ErrorContext(ctx, "failed to update pipeline status to stopping", "pipeline_id", pid, "error", err)
		return fmt.Errorf("update pipeline status to stopping: %w", err)
	}

	// For Docker orchestrator, mark as failed if stop fails
	if p.orchestrator.GetType() == "local" {
		// create a new context for the stop pipeline operation
		ctxAsync := context.Background()

		go func() {
			err := p.orchestrator.StopPipeline(ctxAsync, pid)
			if err != nil {
				pipeline.Status.OverallStatus = internal.PipelineStatusFailed
				err := p.db.UpdatePipelineStatus(context.Background(), pid, pipeline.Status)
				if err != nil {
					p.log.Error("failed to update pipeline status to failed", slog.Any("error", err))
				}
			} else {
				pipeline.Status.OverallStatus = internal.PipelineStatusStopped
				err := p.db.UpdatePipelineStatus(context.Background(), pid, pipeline.Status)
				if err != nil {
					p.log.Error("failed to update pipeline status to stopped", slog.Any("error", err))
				}
			}
		}()

		return nil
	}

	// For k8 orchestrator, the operator controller-manager takes care of updating this status
	err = p.orchestrator.StopPipeline(ctx, pid)
	if err != nil {
		p.log.ErrorContext(ctx, "failed to stop pipeline in orchestrator", "pipeline_id", pid, "error", err)
		return fmt.Errorf("failed to stop k8 pipeline: %w", err)
	}

	return nil
}

// EditPipeline implements PipelineManager.
func (p *PipelineManagerImpl) EditPipeline(ctx context.Context, pid string, newCfg *models.PipelineConfig) error {
	// Get current pipeline to check existence and status
	currentPipeline, err := p.db.GetPipeline(ctx, pid)
	if err != nil {
		if errors.Is(err, ErrPipelineNotExists) {
			return ErrPipelineNotExists
		}
		p.log.ErrorContext(ctx, "failed to get pipeline for edit", "pipeline_id", pid, "error", err)
		return fmt.Errorf("get pipeline failed for edit: %w", err)
	}

	// Validate pipeline is in Stopped status
	if currentPipeline.Status.OverallStatus != internal.PipelineStatusStopped {
		p.log.ErrorContext(ctx, "pipeline must be stopped before editing", "pipeline_id", pid, "current_status", currentPipeline.Status.OverallStatus)
		return status.NewPipelineNotStoppedForEditError(models.PipelineStatus(currentPipeline.Status.OverallStatus))
	}

	// Update pipeline in NATS KV
	err = p.db.UpdatePipeline(ctx, pid, *newCfg)
	if err != nil {
		p.log.ErrorContext(ctx, "failed to update pipeline in database", "pipeline_id", pid, "error", err)
		return fmt.Errorf("update pipeline in database: %w", err)
	}

	// Call orchestrator to handle the edit operation
	err = p.orchestrator.EditPipeline(ctx, pid, newCfg)
	if err != nil {
		p.log.ErrorContext(ctx, "failed to edit pipeline in orchestrator", "pipeline_id", pid, "error", err)
		return fmt.Errorf("edit pipeline: %w", err)
	}

	p.log.InfoContext(ctx, "pipeline edit initiated successfully", "pipeline_id", pid)
	return nil
}

// GetOrchestratorType implements PipelineManager.
func (p *PipelineManagerImpl) GetOrchestratorType() string {
	return p.orchestrator.GetType()
}

// CleanUpPipelines implements PipelineManager.
func (p *PipelineManagerImpl) CleanUpPipelines(ctx context.Context) error {
	p.log.Info("cleaning up pipelines", slog.String("orchestrator", p.GetOrchestratorType()))

	if p.GetOrchestratorType() != "local" {
		return nil
	}

	pipelines, err := p.db.GetPipelines(ctx)
	if err != nil {
		p.log.ErrorContext(ctx, "failed to load pipelines for cleanup", "error", err)
		return fmt.Errorf("load pipelines: %w", err)
	}

	for _, pi := range pipelines {
		if pi.Status.OverallStatus != internal.PipelineStatusStopped &&
			pi.Status.OverallStatus != internal.PipelineStatusFailed {
			p.log.Debug("cleaning pipeline...", slog.String("pipelineID", pi.ID), slog.Any("status", pi.Status.OverallStatus))
			pi.Status.OverallStatus = internal.PipelineStatusStopped
			err := p.db.UpdatePipelineStatus(ctx, pi.ID, pi.Status)
			if err != nil {
				p.log.ErrorContext(ctx, "failed to update pipeline status during cleanup", "pipeline_id", pi.ID, "error", err)
				return fmt.Errorf("update pipeline with %s failed: %w", pi.ID, err)
			}
		}
	}

	return nil
}
