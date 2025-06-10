package service

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

type PipelineStore interface {
	InsertPipeline(context.Context, models.Pipeline) error
	GetPipeline(context.Context, string) (*models.Pipeline, error)
}

type PipelineService struct {
	log   *slog.Logger
	store PipelineStore
}

func NewPipelineService(
	log *slog.Logger,
	store PipelineStore,
) *PipelineService {
	return &PipelineService{
		log:   log,
		store: store,
	}
}

var (
	ErrIDExists          = fmt.Errorf("pipeline ID already exists")
	ErrPipelineNotExists = fmt.Errorf("pipeline does not exist")
)

func (p *PipelineService) SetupPipeline(ctx context.Context, pi *models.Pipeline) error {
	err := p.store.InsertPipeline(ctx, *pi)
	if err != nil {
		return fmt.Errorf("insert pipeline: %w", err)
	}
	return nil
}

func (p *PipelineService) GetPipeline(ctx context.Context, id string) (*models.Pipeline, error) {
	pi, err := p.store.GetPipeline(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("load pipeline: %w", err)
	}
	return pi, nil
}

func (p *PipelineService) ShutdownPipeline() error {
	return nil
}
