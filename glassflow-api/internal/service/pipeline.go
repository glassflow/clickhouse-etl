package service

import (
	"context"
	"errors"
	"fmt"

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
}

type PipelineManager interface {
	CreatePipeline(ctx context.Context, cfg *models.PipelineConfig) error
	DeletePipeline(ctx context.Context, pid string) error
	TerminatePipeline(ctx context.Context, pid string) error
	GetPipeline(ctx context.Context, pid string) (models.PipelineConfig, error)
	GetPipelines(ctx context.Context) ([]models.ListPipelineConfig, error)
	UpdatePipelineName(ctx context.Context, id string, name string) error
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

	err := p.orchestrator.TerminatePipeline(ctx, pid)
	if err != nil {
		return fmt.Errorf("shutdown pipeline: %w", err)
	}

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
