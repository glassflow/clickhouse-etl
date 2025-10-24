package service

import (
	"context"
	"errors"
	"log/slog"
	"sync"
	"testing"
	"time"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

// mockOrchestrator is a mock implementation of the Orchestrator interface
type mockOrchestrator struct {
	mu               sync.RWMutex
	orchestratorType string
	pauseError       error
	resumeError      error
	deleteError      error
	pauseCalled      bool
	resumeCalled     bool
	pausePipelineID  string
	resumePipelineID string
}

func (m *mockOrchestrator) DeletePipeline(ctx context.Context, pid string) error {
	return m.deleteError
}

func (m *mockOrchestrator) GetType() string {
	return m.orchestratorType
}

func (m *mockOrchestrator) SetupPipeline(ctx context.Context, cfg *models.PipelineConfig) error {
	return nil
}

func (m *mockOrchestrator) StopPipeline(ctx context.Context, pid string) error {
	return nil
}

func (m *mockOrchestrator) TerminatePipeline(ctx context.Context, pid string) error {
	return nil
}

func (m *mockOrchestrator) ResumePipeline(ctx context.Context, pid string) error {
	m.resumeCalled = true
	m.resumePipelineID = pid
	return m.resumeError
}

func (m *mockOrchestrator) EditPipeline(ctx context.Context, pid string, newCfg *models.PipelineConfig) error {
	return nil
}

// mockPipelineStore is a mock implementation of the PipelineStore interface
type mockPipelineStore struct {
	mu               sync.RWMutex
	pipelines        map[string]models.PipelineConfig
	getError         error
	updateError      error
	deleteError      error
	deleteCalled     bool
	deletePipelineID string
}

func (m *mockPipelineStore) InsertPipeline(ctx context.Context, pi models.PipelineConfig) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.pipelines == nil {
		m.pipelines = make(map[string]models.PipelineConfig)
	}
	m.pipelines[pi.ID] = pi
	return nil
}

func (m *mockPipelineStore) DeletePipeline(ctx context.Context, pid string) error {
	m.deleteCalled = true
	m.deletePipelineID = pid

	if m.deleteError != nil {
		return m.deleteError
	}

	delete(m.pipelines, pid)
	return nil
}

func (m *mockPipelineStore) GetPipeline(ctx context.Context, pid string) (*models.PipelineConfig, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
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

func (m *mockPipelineStore) UpdatePipeline(ctx context.Context, pid string, cfg models.PipelineConfig) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.pipelines[pid] = cfg
	return nil
}

func (m *mockPipelineStore) UpdatePipelineStatus(ctx context.Context, pid string, status models.PipelineHealth) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.updateError != nil {
		return m.updateError
	}
	if pipeline, exists := m.pipelines[pid]; exists {
		pipeline.Status = status
		m.pipelines[pid] = pipeline
	}
	return nil
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
			name:           "successful resume from stopped state",
			pipelineID:     "test-pipeline",
			initialStatus:  internal.PipelineStatusStopped,
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
			expectedError: "Invalid status transition from Running to Resuming",
		},
		{
			name:          "pipeline already resuming",
			pipelineID:    "test-pipeline",
			initialStatus: internal.PipelineStatusResuming,
			orchestrator:  &mockOrchestrator{orchestratorType: "local"},
			store:         &mockPipelineStore{},
			expectedError: "Pipeline is already in Resuming state",
		},
		{
			name:          "pipeline not in resumable state",
			pipelineID:    "test-pipeline",
			initialStatus: internal.PipelineStatusCreated,
			orchestrator:  &mockOrchestrator{orchestratorType: "local"},
			store:         &mockPipelineStore{},
			expectedError: "Invalid status transition from Created to Resuming",
		},
		{
			name:          "orchestrator resume error",
			pipelineID:    "test-pipeline",
			initialStatus: internal.PipelineStatusStopped,
			orchestrator:  &mockOrchestrator{orchestratorType: "local", resumeError: errors.New("resume failed")},
			store:         &mockPipelineStore{},
			expectedError: "resume pipeline: resume failed",
		},
		{
			name:          "k8s orchestrator not implemented",
			pipelineID:    "test-pipeline",
			initialStatus: internal.PipelineStatusStopped,
			orchestrator:  &mockOrchestrator{orchestratorType: "k8s", resumeError: ErrNotImplemented},
			store:         &mockPipelineStore{},
			expectedError: "resume pipeline: feature is not implemented",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup
			ctx := context.Background()
			manager := NewPipelineManager(tt.orchestrator, tt.store, slog.Default())

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

func TestPipelineManager_DeletePipeline(t *testing.T) {
	ctx := context.Background()

	tests := []struct {
		name          string
		pipelineID    string
		store         *mockPipelineStore
		orchestrator  *mockOrchestrator
		expectedError string
		shouldDelete  bool
	}{
		{
			name:       "successful deletion of stopped pipeline",
			pipelineID: "test-pipeline-1",
			store: &mockPipelineStore{
				pipelines: map[string]models.PipelineConfig{
					"test-pipeline-1": {
						ID: "test-pipeline-1",
						Status: models.PipelineHealth{
							OverallStatus: internal.PipelineStatusStopped,
						},
					},
				},
			},
			orchestrator: &mockOrchestrator{orchestratorType: "local"},
			shouldDelete: true,
		},
		{
			name:       "pipeline not found",
			pipelineID: "non-existent-pipeline",
			store: &mockPipelineStore{
				pipelines:   map[string]models.PipelineConfig{},
				deleteError: ErrPipelineNotExists,
			},
			orchestrator:  &mockOrchestrator{orchestratorType: "local"},
			expectedError: "delete pipeline from database: no pipeline with given id exists",
		},
		{
			name:       "orchestrator delete error",
			pipelineID: "test-pipeline-2",
			store: &mockPipelineStore{
				pipelines: map[string]models.PipelineConfig{
					"test-pipeline-2": {
						ID: "test-pipeline-2",
						Status: models.PipelineHealth{
							OverallStatus: internal.PipelineStatusStopped,
						},
					},
				},
			},
			orchestrator:  &mockOrchestrator{orchestratorType: "local", deleteError: errors.New("orchestrator deletion failed")},
			expectedError: "delete pipeline from orchestrator: orchestrator deletion failed",
		},
		{
			name:       "delete error from store",
			pipelineID: "test-pipeline-3",
			store: &mockPipelineStore{
				pipelines: map[string]models.PipelineConfig{
					"test-pipeline-3": {
						ID: "test-pipeline-3",
						Status: models.PipelineHealth{
							OverallStatus: internal.PipelineStatusStopped,
						},
					},
				},
				deleteError: errors.New("store deletion failed"),
			},
			orchestrator:  &mockOrchestrator{orchestratorType: "local"},
			expectedError: "delete pipeline from database: store deletion failed",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Initialize the store's pipelines map if it's nil
			if tt.store.pipelines == nil {
				tt.store.pipelines = make(map[string]models.PipelineConfig)
			}

			manager := &PipelineManager{
				orchestrator: tt.orchestrator,
				db:           tt.store,
				log:          slog.Default(),
			}

			err := manager.DeletePipeline(ctx, tt.pipelineID)

			if tt.expectedError != "" {
				if err == nil {
					t.Errorf("expected error containing %q, got nil", tt.expectedError)
					return
				}
				if !containsString(err.Error(), tt.expectedError) {
					t.Errorf("expected error containing %q, got %q", tt.expectedError, err.Error())
				}
				return
			}

			if err != nil {
				t.Errorf("unexpected error: %v", err)
				return
			}

			// Verify pipeline was deleted from store
			if tt.shouldDelete {
				if tt.store.deleteCalled {
					if tt.store.deletePipelineID != tt.pipelineID {
						t.Errorf("store.DeletePipeline called with %q, expected %q", tt.store.deletePipelineID, tt.pipelineID)
					}
				} else {
					t.Error("store.DeletePipeline was not called")
				}
			}
		})
	}
}
