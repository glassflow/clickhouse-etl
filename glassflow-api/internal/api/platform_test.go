package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/api/mocks"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.uber.org/mock/gomock"
)

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
			ctrl := gomock.NewController(t)
			defer ctrl.Finish()

			// Create mock pipeline manager
			mockPipelineService := mocks.NewMockPipelineService(ctrl)
			mockPipelineService.EXPECT().GetOrchestratorType().Return(tt.orchestratorType)

			// Create handler
			h := &handler{
				pipelineService: mockPipelineService,
				dlqSvc:          nil,
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
		})
	}
}

func TestPlatformHandlerWithNilPipelineService(t *testing.T) {
	h := &handler{
		pipelineService: nil,
		dlqSvc:          nil,
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
