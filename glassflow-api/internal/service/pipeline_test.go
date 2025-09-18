package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

// mockOrchestrator is a mock implementation of the Orchestrator interface
type mockOrchestrator struct {
	orchestratorType string
	pauseError       error
	resumeError      error
	pauseCalled      bool
	resumeCalled     bool
	pausePipelineID  string
	resumePipelineID string
}

func (m *mockOrchestrator) GetType() string {
	return m.orchestratorType
}

func (m *mockOrchestrator) SetupPipeline(ctx context.Context, cfg *models.PipelineConfig) error {
	return nil
}

func (m *mockOrchestrator) ShutdownPipeline(ctx context.Context, pid string) error {
	return nil
}

func (m *mockOrchestrator) TerminatePipeline(ctx context.Context, pid string) error {
	return nil
}

func (m *mockOrchestrator) PausePipeline(ctx context.Context, pid string) error {
	m.pauseCalled = true
	m.pausePipelineID = pid
	return m.pauseError
}

func (m *mockOrchestrator) ResumePipeline(ctx context.Context, pid string) error {
	m.resumeCalled = true
	m.resumePipelineID = pid
	return m.resumeError
}

// mockPipelineStore is a mock implementation of the PipelineStore interface
type mockPipelineStore struct {
	pipelines   map[string]models.PipelineConfig
	getError    error
	updateError error
}

func (m *mockPipelineStore) InsertPipeline(ctx context.Context, pi models.PipelineConfig) error {
	if m.pipelines == nil {
		m.pipelines = make(map[string]models.PipelineConfig)
	}
	m.pipelines[pi.ID] = pi
	return nil
}

func (m *mockPipelineStore) DeletePipeline(ctx context.Context, pid string) error {
	delete(m.pipelines, pid)
	return nil
}

func (m *mockPipelineStore) GetPipeline(ctx context.Context, pid string) (*models.PipelineConfig, error) {
	if m.getError != nil {
		return nil, m.getError
	}
	if pipeline, exists := m.pipelines[pid]; exists {
		return &pipeline, nil
	}
	return nil, ErrPipelineNotExists
}

func (m *mockPipelineStore) GetPipelines(ctx context.Context) ([]models.PipelineConfig, error) {
	var pipelines []models.PipelineConfig
	for _, pipeline := range m.pipelines {
		pipelines = append(pipelines, pipeline)
	}
	return pipelines, nil
}

func (m *mockPipelineStore) PatchPipelineName(ctx context.Context, pid string, name string) error {
	if pipeline, exists := m.pipelines[pid]; exists {
		pipeline.Name = name
		m.pipelines[pid] = pipeline
	}
	return nil
}

func (m *mockPipelineStore) UpdatePipelineStatus(ctx context.Context, pid string, status models.PipelineHealth) error {
	if m.updateError != nil {
		return m.updateError
	}
	if pipeline, exists := m.pipelines[pid]; exists {
		pipeline.Status = status
		m.pipelines[pid] = pipeline
	}
	return nil
}

func TestPipelineManager_PausePipeline(t *testing.T) {
	tests := []struct {
		name           string
		pipelineID     string
		initialStatus  models.PipelineStatus
		orchestrator   *mockOrchestrator
		store          *mockPipelineStore
		expectedError  string
		expectedStatus models.PipelineStatus
	}{
		{
			name:           "successful pause from running state",
			pipelineID:     "test-pipeline",
			initialStatus:  internal.PipelineStatusRunning,
			orchestrator:   &mockOrchestrator{orchestratorType: "local"},
			store:          &mockPipelineStore{},
			expectedError:  "",
			expectedStatus: internal.PipelineStatusPaused,
		},
		{
			name:          "pipeline not found",
			pipelineID:    "nonexistent-pipeline",
			initialStatus: "", // No pipeline created
			orchestrator:  &mockOrchestrator{orchestratorType: "local"},
			store:         &mockPipelineStore{},
			expectedError: "no pipeline with given id exists",
		},
		{
			name:          "pipeline already paused",
			pipelineID:    "test-pipeline",
			initialStatus: internal.PipelineStatusPaused,
			orchestrator:  &mockOrchestrator{orchestratorType: "local"},
			store:         &mockPipelineStore{},
			expectedError: "pipeline is already paused",
		},
		{
			name:          "pipeline already pausing",
			pipelineID:    "test-pipeline",
			initialStatus: internal.PipelineStatusPausing,
			orchestrator:  &mockOrchestrator{orchestratorType: "local"},
			store:         &mockPipelineStore{},
			expectedError: "pipeline is already being paused",
		},
		{
			name:          "pipeline terminated",
			pipelineID:    "test-pipeline",
			initialStatus: internal.PipelineStatusTerminated,
			orchestrator:  &mockOrchestrator{orchestratorType: "local"},
			store:         &mockPipelineStore{},
			expectedError: "no pipeline with given id exists",
		},
		{
			name:          "orchestrator pause error",
			pipelineID:    "test-pipeline",
			initialStatus: internal.PipelineStatusRunning,
			orchestrator:  &mockOrchestrator{orchestratorType: "local", pauseError: errors.New("pause failed")},
			store:         &mockPipelineStore{},
			expectedError: "pause pipeline: pause failed",
		},
		{
			name:          "k8s orchestrator not implemented",
			pipelineID:    "test-pipeline",
			initialStatus: internal.PipelineStatusRunning,
			orchestrator:  &mockOrchestrator{orchestratorType: "k8s", pauseError: ErrNotImplemented},
			store:         &mockPipelineStore{},
			expectedError: "pause pipeline: feature is not implemented",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup
			ctx := context.Background()
			manager := NewPipelineManager(tt.orchestrator, tt.store, nil)

			// Create test pipeline if needed
			if tt.initialStatus != "" {
				pipeline := models.PipelineConfig{
					ID:   tt.pipelineID,
					Name: "Test Pipeline",
					Status: models.PipelineHealth{
						PipelineID:    tt.pipelineID,
						PipelineName:  "Test Pipeline",
						OverallStatus: tt.initialStatus,
						CreatedAt:     time.Now(),
						UpdatedAt:     time.Now(),
					},
				}
				tt.store.InsertPipeline(ctx, pipeline)
			}

			// Execute
			err := manager.PausePipeline(ctx, tt.pipelineID)

			// Verify error
			if tt.expectedError != "" {
				if err == nil {
					t.Errorf("expected error %q, got nil", tt.expectedError)
				} else if !containsString(err.Error(), tt.expectedError) {
					t.Errorf("expected error containing %q, got %q", tt.expectedError, err.Error())
				}
				return
			}

			if err != nil {
				t.Errorf("unexpected error: %v", err)
				return
			}

			// Verify orchestrator was called
			if !tt.orchestrator.pauseCalled {
				t.Error("orchestrator.PausePipeline was not called")
			}

			if tt.orchestrator.pausePipelineID != tt.pipelineID {
				t.Errorf("orchestrator.PausePipeline called with %q, expected %q", tt.orchestrator.pausePipelineID, tt.pipelineID)
			}

			// Verify status update
			if tt.expectedStatus != "" {
				pipeline, err := tt.store.GetPipeline(ctx, tt.pipelineID)
				if err != nil {
					t.Errorf("failed to get pipeline: %v", err)
					return
				}

				if pipeline.Status.OverallStatus != tt.expectedStatus {
					t.Errorf("expected status %q, got %q", tt.expectedStatus, pipeline.Status.OverallStatus)
				}
			}
		})
	}
}

func TestPipelineManager_ResumePipeline(t *testing.T) {
	tests := []struct {
		name           string
		pipelineID     string
		initialStatus  models.PipelineStatus
		orchestrator   *mockOrchestrator
		store          *mockPipelineStore
		expectedError  string
		expectedStatus models.PipelineStatus
	}{
		{
			name:           "successful resume from paused state",
			pipelineID:     "test-pipeline",
			initialStatus:  internal.PipelineStatusPaused,
			orchestrator:   &mockOrchestrator{orchestratorType: "local"},
			store:          &mockPipelineStore{},
			expectedError:  "",
			expectedStatus: internal.PipelineStatusRunning,
		},
		{
			name:          "pipeline not found",
			pipelineID:    "nonexistent-pipeline",
			initialStatus: "", // No pipeline created
			orchestrator:  &mockOrchestrator{orchestratorType: "local"},
			store:         &mockPipelineStore{},
			expectedError: "no pipeline with given id exists",
		},
		{
			name:          "pipeline already running",
			pipelineID:    "test-pipeline",
			initialStatus: internal.PipelineStatusRunning,
			orchestrator:  &mockOrchestrator{orchestratorType: "local"},
			store:         &mockPipelineStore{},
			expectedError: "pipeline is already running",
		},
		{
			name:          "pipeline already resuming",
			pipelineID:    "test-pipeline",
			initialStatus: internal.PipelineStatusResuming,
			orchestrator:  &mockOrchestrator{orchestratorType: "local"},
			store:         &mockPipelineStore{},
			expectedError: "pipeline is already being resumed",
		},
		{
			name:          "pipeline terminated",
			pipelineID:    "test-pipeline",
			initialStatus: internal.PipelineStatusTerminated,
			orchestrator:  &mockOrchestrator{orchestratorType: "local"},
			store:         &mockPipelineStore{},
			expectedError: "no pipeline with given id exists",
		},
		{
			name:          "pipeline not paused",
			pipelineID:    "test-pipeline",
			initialStatus: internal.PipelineStatusCreated,
			orchestrator:  &mockOrchestrator{orchestratorType: "local"},
			store:         &mockPipelineStore{},
			expectedError: "pipeline must be paused to resume",
		},
		{
			name:          "orchestrator resume error",
			pipelineID:    "test-pipeline",
			initialStatus: internal.PipelineStatusPaused,
			orchestrator:  &mockOrchestrator{orchestratorType: "local", resumeError: errors.New("resume failed")},
			store:         &mockPipelineStore{},
			expectedError: "resume pipeline: resume failed",
		},
		{
			name:          "k8s orchestrator not implemented",
			pipelineID:    "test-pipeline",
			initialStatus: internal.PipelineStatusPaused,
			orchestrator:  &mockOrchestrator{orchestratorType: "k8s", resumeError: ErrNotImplemented},
			store:         &mockPipelineStore{},
			expectedError: "resume pipeline: feature is not implemented",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup
			ctx := context.Background()
			manager := NewPipelineManager(tt.orchestrator, tt.store, nil)

			// Create test pipeline if needed
			if tt.initialStatus != "" {
				pipeline := models.PipelineConfig{
					ID:   tt.pipelineID,
					Name: "Test Pipeline",
					Status: models.PipelineHealth{
						PipelineID:    tt.pipelineID,
						PipelineName:  "Test Pipeline",
						OverallStatus: tt.initialStatus,
						CreatedAt:     time.Now(),
						UpdatedAt:     time.Now(),
					},
				}
				tt.store.InsertPipeline(ctx, pipeline)
			}

			// Execute
			err := manager.ResumePipeline(ctx, tt.pipelineID)

			// Verify error
			if tt.expectedError != "" {
				if err == nil {
					t.Errorf("expected error %q, got nil", tt.expectedError)
				} else if !containsString(err.Error(), tt.expectedError) {
					t.Errorf("expected error containing %q, got %q", tt.expectedError, err.Error())
				}
				return
			}

			if err != nil {
				t.Errorf("unexpected error: %v", err)
				return
			}

			// Verify orchestrator was called
			if !tt.orchestrator.resumeCalled {
				t.Error("orchestrator.ResumePipeline was not called")
			}

			if tt.orchestrator.resumePipelineID != tt.pipelineID {
				t.Errorf("orchestrator.ResumePipeline called with %q, expected %q", tt.orchestrator.resumePipelineID, tt.pipelineID)
			}

			// Verify status update
			if tt.expectedStatus != "" {
				pipeline, err := tt.store.GetPipeline(ctx, tt.pipelineID)
				if err != nil {
					t.Errorf("failed to get pipeline: %v", err)
					return
				}

				if pipeline.Status.OverallStatus != tt.expectedStatus {
					t.Errorf("expected status %q, got %q", tt.expectedStatus, pipeline.Status.OverallStatus)
				}
			}
		})
	}
}

// Helper function to check if a string contains a substring
func containsString(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(substr) == 0 ||
		(len(s) > len(substr) && (s[:len(substr)] == substr || s[len(s)-len(substr):] == substr ||
			containsSubstring(s, substr))))
}

func containsSubstring(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
