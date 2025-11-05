package service

import (
	"context"
	"errors"
	"log/slog"
	"testing"

	"github.com/glassflow/clickhouse-etl/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl/glassflow-api/internal/status"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// MockOrchestrator is a mock implementation of Orchestrator
type MockOrchestrator struct {
	mock.Mock
}

func (m *MockOrchestrator) GetType() string {
	args := m.Called()
	return args.String(0)
}

func (m *MockOrchestrator) SetupPipeline(ctx context.Context, cfg *models.PipelineConfig) error {
	args := m.Called(ctx, cfg)
	return args.Error(0)
}

func (m *MockOrchestrator) StopPipeline(ctx context.Context, pid string) error {
	args := m.Called(ctx, pid)
	return args.Error(0)
}

func (m *MockOrchestrator) TerminatePipeline(ctx context.Context, pid string) error {
	args := m.Called(ctx, pid)
	return args.Error(0)
}

func (m *MockOrchestrator) DeletePipeline(ctx context.Context, pid string) error {
	args := m.Called(ctx, pid)
	return args.Error(0)
}

func (m *MockOrchestrator) ResumePipeline(ctx context.Context, pid string) error {
	args := m.Called(ctx, pid)
	return args.Error(0)
}

func (m *MockOrchestrator) EditPipeline(ctx context.Context, pid string, newCfg *models.PipelineConfig) error {
	args := m.Called(ctx, pid, newCfg)
	return args.Error(0)
}

// MockPipelineStore is a mock implementation of PipelineStore
type MockPipelineStore struct {
	mock.Mock
}

func (m *MockPipelineStore) InsertPipeline(ctx context.Context, pi models.PipelineConfig) error {
	args := m.Called(ctx, pi)
	return args.Error(0)
}

func (m *MockPipelineStore) DeletePipeline(ctx context.Context, pid string) error {
	args := m.Called(ctx, pid)
	return args.Error(0)
}

func (m *MockPipelineStore) GetPipeline(ctx context.Context, pid string) (*models.PipelineConfig, error) {
	args := m.Called(ctx, pid)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.PipelineConfig), args.Error(1)
}

func (m *MockPipelineStore) GetPipelines(ctx context.Context) ([]models.PipelineConfig, error) {
	args := m.Called(ctx)
	return args.Get(0).([]models.PipelineConfig), args.Error(1)
}

func (m *MockPipelineStore) PatchPipelineName(ctx context.Context, pid string, name string) error {
	args := m.Called(ctx, pid, name)
	return args.Error(0)
}

func (m *MockPipelineStore) UpdatePipelineStatus(ctx context.Context, pid string, status models.PipelineHealth) error {
	args := m.Called(ctx, pid, status)
	return args.Error(0)
}

func (m *MockPipelineStore) UpdatePipeline(ctx context.Context, pid string, cfg models.PipelineConfig) error {
	args := m.Called(ctx, pid, cfg)
	return args.Error(0)
}

func TestEditPipeline_Success(t *testing.T) {
	// Setup
	mockOrchestrator := new(MockOrchestrator)
	mockStore := new(MockPipelineStore)
	logger := slog.Default()

	pipelineService := &PipelineService{
		orchestrator: mockOrchestrator,
		db:           mockStore,
		log:          logger,
	}

	pipelineID := "test-pipeline-123"
	currentPipeline := &models.PipelineConfig{
		ID:   pipelineID,
		Name: "Current Pipeline",
		Status: models.PipelineHealth{
			OverallStatus: internal.PipelineStatusStopped,
		},
	}

	newConfig := &models.PipelineConfig{
		ID:   pipelineID,
		Name: "Updated Pipeline",
		Status: models.PipelineHealth{
			OverallStatus: internal.PipelineStatusStopped,
		},
	}

	// Setup mock expectations
	mockStore.On("GetPipeline", mock.Anything, pipelineID).Return(currentPipeline, nil)
	mockStore.On("UpdatePipeline", mock.Anything, pipelineID, *newConfig).Return(nil)
	mockOrchestrator.On("EditPipeline", mock.Anything, pipelineID, newConfig).Return(nil)

	// Execute
	err := pipelineService.EditPipeline(context.Background(), pipelineID, newConfig)

	// Assertions
	assert.NoError(t, err)
	mockStore.AssertExpectations(t)
	mockOrchestrator.AssertExpectations(t)
}

func TestEditPipeline_PipelineNotExists(t *testing.T) {
	// Setup
	mockOrchestrator := new(MockOrchestrator)
	mockStore := new(MockPipelineStore)
	logger := slog.Default()

	pipelineService := &PipelineService{
		orchestrator: mockOrchestrator,
		db:           mockStore,
		log:          logger,
	}

	pipelineID := "non-existent-pipeline"
	newConfig := &models.PipelineConfig{
		ID:   pipelineID,
		Name: "Updated Pipeline",
	}

	// Setup mock expectations
	mockStore.On("GetPipeline", mock.Anything, pipelineID).Return(nil, ErrPipelineNotExists)

	// Execute
	err := pipelineService.EditPipeline(context.Background(), pipelineID, newConfig)

	// Assertions
	assert.Error(t, err)
	assert.Equal(t, ErrPipelineNotExists, err)
	mockStore.AssertExpectations(t)
	mockOrchestrator.AssertNotCalled(t, "EditPipeline")
}

func TestEditPipeline_PipelineNotStopped(t *testing.T) {
	// Setup
	mockOrchestrator := new(MockOrchestrator)
	mockStore := new(MockPipelineStore)
	logger := slog.Default()

	pipelineService := &PipelineService{
		orchestrator: mockOrchestrator,
		db:           mockStore,
		log:          logger,
	}

	pipelineID := "test-pipeline-123"
	currentPipeline := &models.PipelineConfig{
		ID:   pipelineID,
		Name: "Current Pipeline",
		Status: models.PipelineHealth{
			OverallStatus: internal.PipelineStatusRunning, // Not stopped
		},
	}

	newConfig := &models.PipelineConfig{
		ID:   pipelineID,
		Name: "Updated Pipeline",
	}

	// Setup mock expectations
	mockStore.On("GetPipeline", mock.Anything, pipelineID).Return(currentPipeline, nil)

	// Execute
	err := pipelineService.EditPipeline(context.Background(), pipelineID, newConfig)

	// Assertions
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "Pipeline must be stopped before editing")

	// Check that it's a proper StatusValidationError
	statusErr, ok := status.GetStatusValidationError(err)
	assert.True(t, ok, "Expected StatusValidationError")
	assert.Equal(t, "PIPELINE_NOT_STOPPED_FOR_EDIT", statusErr.Code)
	assert.Equal(t, models.PipelineStatus(internal.PipelineStatusRunning), statusErr.CurrentStatus)

	mockStore.AssertExpectations(t)
	mockOrchestrator.AssertNotCalled(t, "EditPipeline")
}

func TestEditPipeline_UpdatePipelineFails(t *testing.T) {
	// Setup
	mockOrchestrator := new(MockOrchestrator)
	mockStore := new(MockPipelineStore)
	logger := slog.Default()

	pipelineService := &PipelineService{
		orchestrator: mockOrchestrator,
		db:           mockStore,
		log:          logger,
	}

	pipelineID := "test-pipeline-123"
	currentPipeline := &models.PipelineConfig{
		ID:   pipelineID,
		Name: "Current Pipeline",
		Status: models.PipelineHealth{
			OverallStatus: internal.PipelineStatusStopped,
		},
	}

	newConfig := &models.PipelineConfig{
		ID:   pipelineID,
		Name: "Updated Pipeline",
	}

	// Setup mock expectations
	mockStore.On("GetPipeline", mock.Anything, pipelineID).Return(currentPipeline, nil)
	mockStore.On("UpdatePipeline", mock.Anything, pipelineID, *newConfig).Return(errors.New("database error"))

	// Execute
	err := pipelineService.EditPipeline(context.Background(), pipelineID, newConfig)

	// Assertions
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "update pipeline in database")
	mockStore.AssertExpectations(t)
	mockOrchestrator.AssertNotCalled(t, "EditPipeline")
}

func TestEditPipeline_OrchestratorFails(t *testing.T) {
	// Setup
	mockOrchestrator := new(MockOrchestrator)
	mockStore := new(MockPipelineStore)
	logger := slog.Default()

	pipelineService := &PipelineService{
		orchestrator: mockOrchestrator,
		db:           mockStore,
		log:          logger,
	}

	pipelineID := "test-pipeline-123"
	currentPipeline := &models.PipelineConfig{
		ID:   pipelineID,
		Name: "Current Pipeline",
		Status: models.PipelineHealth{
			OverallStatus: internal.PipelineStatusStopped,
		},
	}

	newConfig := &models.PipelineConfig{
		ID:   pipelineID,
		Name: "Updated Pipeline",
	}

	// Setup mock expectations
	mockStore.On("GetPipeline", mock.Anything, pipelineID).Return(currentPipeline, nil)
	mockStore.On("UpdatePipeline", mock.Anything, pipelineID, *newConfig).Return(nil)
	mockOrchestrator.On("EditPipeline", mock.Anything, pipelineID, newConfig).Return(errors.New("orchestrator error"))

	// Execute
	err := pipelineService.EditPipeline(context.Background(), pipelineID, newConfig)

	// Assertions
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "edit pipeline")
	mockStore.AssertExpectations(t)
	mockOrchestrator.AssertExpectations(t)
}
