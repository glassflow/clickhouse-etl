package api

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

// MockPipelineManager is a mock implementation of service.PipelineManager
type MockPipelineManager struct {
	mock.Mock
}

func (m *MockPipelineManager) PausePipeline(ctx context.Context, pid string) error {
	//TODO implement me
	panic("implement me")
}

func (m *MockPipelineManager) ResumePipeline(ctx context.Context, pid string) error {
	//TODO implement me
	panic("implement me")
}

func (m *MockPipelineManager) CreatePipeline(ctx context.Context, cfg *models.PipelineConfig) error {
	args := m.Called(ctx, cfg)
	return args.Error(0)
}

func (m *MockPipelineManager) DeletePipeline(ctx context.Context, pid string) error {
	args := m.Called(ctx, pid)
	return args.Error(0)
}

func (m *MockPipelineManager) StopPipeline(ctx context.Context, pid string) error {
	args := m.Called(ctx, pid)
	return args.Error(0)
}

func (m *MockPipelineManager) TerminatePipeline(ctx context.Context, pid string) error {
	args := m.Called(ctx, pid)
	return args.Error(0)
}

func (m *MockPipelineManager) GetPipeline(ctx context.Context, pid string) (models.PipelineConfig, error) {
	args := m.Called(ctx, pid)
	return args.Get(0).(models.PipelineConfig), args.Error(1)
}

func (m *MockPipelineManager) GetPipelines(ctx context.Context) ([]models.ListPipelineConfig, error) {
	args := m.Called(ctx)
	return args.Get(0).([]models.ListPipelineConfig), args.Error(1)
}

func (m *MockPipelineManager) UpdatePipelineName(ctx context.Context, id string, name string) error {
	args := m.Called(ctx, id, name)
	return args.Error(0)
}

func (m *MockPipelineManager) GetPipelineHealth(ctx context.Context, pid string) (models.PipelineHealth, error) {
	args := m.Called(ctx, pid)
	return args.Get(0).(models.PipelineHealth), args.Error(1)
}

func (m *MockPipelineManager) GetOrchestratorType() string {
	args := m.Called()
	return args.String(0)
}

func (m *MockPipelineManager) CleanUpPipelines(ctx context.Context) error {
	args := m.Called(ctx)
	return args.Error(0)
}

// MockDLQ is a mock implementation of service.DLQ
type MockDLQ struct {
	mock.Mock
}

func (m *MockDLQ) ConsumeDLQ(ctx context.Context, pid string, batchSize models.DLQBatchSize) ([]models.DLQMessage, error) {
	args := m.Called(ctx, pid, batchSize)
	return args.Get(0).([]models.DLQMessage), args.Error(1)
}

func (m *MockDLQ) GetDLQState(ctx context.Context, pid string) (models.DLQState, error) {
	args := m.Called(ctx, pid)
	return args.Get(0).(models.DLQState), args.Error(1)
}

func TestPlatformHandler(t *testing.T) {
	tests := []struct {
		name             string
		orchestratorType string
		expectedStatus   int
		expectedResponse PlatformResponse
	}{
		{
			name:             "local orchestrator",
			orchestratorType: "local",
			expectedStatus:   http.StatusOK,
			expectedResponse: PlatformResponse{
				Orchestrator: "local",
			},
		},
		{
			name:             "k8s orchestrator",
			orchestratorType: "k8s",
			expectedStatus:   http.StatusOK,
			expectedResponse: PlatformResponse{
				Orchestrator: "k8s",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create mock pipeline manager
			mockPipelineManager := &MockPipelineManager{}
			mockPipelineManager.On("GetOrchestratorType").Return(tt.orchestratorType)

			// Create mock DLQ service
			mockDLQ := &MockDLQ{}

			// Create handler
			h := &handler{
				pipelineManager: mockPipelineManager,
				dlqSvc:          mockDLQ,
			}

			// Create request
			req := httptest.NewRequest("GET", "/api/v1/platform", nil)
			w := httptest.NewRecorder()

			// Call handler
			h.platform(w, req)

			// Assert status code
			assert.Equal(t, tt.expectedStatus, w.Code)

			// Parse response
			var response PlatformResponse
			err := json.NewDecoder(w.Body).Decode(&response)
			require.NoError(t, err)

			// Assert response
			assert.Equal(t, tt.expectedResponse.Orchestrator, response.Orchestrator)
			assert.Equal(t, tt.expectedResponse.APIVersion, response.APIVersion)

			// Verify mock expectations
			mockPipelineManager.AssertExpectations(t)
		})
	}
}

func TestPlatformHandlerWithNilPipelineManager(t *testing.T) {
	// Create handler with nil pipeline manager
	h := &handler{
		pipelineManager: nil,
		dlqSvc:          &MockDLQ{},
	}

	// Create request
	req := httptest.NewRequest("GET", "/api/v1/platform", nil)
	w := httptest.NewRecorder()

	// Call handler
	h.platform(w, req)

	// Assert status code
	assert.Equal(t, http.StatusOK, w.Code)

	// Parse response
	var response PlatformResponse
	err := json.NewDecoder(w.Body).Decode(&response)
	require.NoError(t, err)

	// Assert response
	assert.Equal(t, "unknown", response.Orchestrator)
	assert.Equal(t, "", response.APIVersion)
}
