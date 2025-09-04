package api

import (
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/service"
)

func TestPausePipelineHandler(t *testing.T) {
	tests := []struct {
		name           string
		pipelineID     string
		mockError      error
		expectedStatus int
		expectedBody   string
	}{
		{
			name:           "successful pause",
			pipelineID:     "test-pipeline-123",
			mockError:      nil,
			expectedStatus: http.StatusNoContent,
			expectedBody:   "",
		},
		{
			name:           "pipeline not found",
			pipelineID:     "nonexistent-pipeline",
			mockError:      service.ErrPipelineNotExists,
			expectedStatus: http.StatusNotFound,
			expectedBody:   `{"message":"no active pipeline with given id to pause"}`,
		},
		{
			name:           "internal server error",
			pipelineID:     "test-pipeline-123",
			mockError:      assert.AnError,
			expectedStatus: http.StatusInternalServerError,
			expectedBody:   `{"message":"failed to pause pipeline"}`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create mock pipeline manager
			mockPipelineManager := &MockPipelineManager{}
			if tt.pipelineID != "" {
				mockPipelineManager.On("PausePipeline", mock.Anything, tt.pipelineID).Return(tt.mockError)
			}

			// Create mock DLQ service
			mockDLQ := &MockDLQ{}

			// Create router
			router := NewRouter(slog.Default(), mockPipelineManager, mockDLQ)

			// Create request
			url := "/api/v1/pipeline/" + tt.pipelineID + "/pause"
			req := httptest.NewRequest("POST", url, nil)
			w := httptest.NewRecorder()

			// Call router
			router.ServeHTTP(w, req)

			// Assert status code
			assert.Equal(t, tt.expectedStatus, w.Code)

			// Assert response body
			if tt.expectedBody != "" {
				assert.JSONEq(t, tt.expectedBody, w.Body.String())
			} else {
				assert.Empty(t, w.Body.String())
			}

			// Verify mock expectations
			if tt.pipelineID != "" {
				mockPipelineManager.AssertExpectations(t)
			}
		})
	}
}

func TestResumePipelineHandler(t *testing.T) {
	tests := []struct {
		name           string
		pipelineID     string
		mockError      error
		expectedStatus int
		expectedBody   string
	}{
		{
			name:           "successful resume",
			pipelineID:     "test-pipeline-123",
			mockError:      nil,
			expectedStatus: http.StatusNoContent,
			expectedBody:   "",
		},
		{
			name:           "pipeline not found",
			pipelineID:     "nonexistent-pipeline",
			mockError:      service.ErrPipelineNotExists,
			expectedStatus: http.StatusNotFound,
			expectedBody:   `{"message":"no active pipeline with given id to resume"}`,
		},
		{
			name:           "internal server error",
			pipelineID:     "test-pipeline-123",
			mockError:      assert.AnError,
			expectedStatus: http.StatusInternalServerError,
			expectedBody:   `{"message":"failed to resume pipeline"}`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create mock pipeline manager
			mockPipelineManager := &MockPipelineManager{}
			if tt.pipelineID != "" {
				mockPipelineManager.On("ResumePipeline", mock.Anything, tt.pipelineID).Return(tt.mockError)
			}

			// Create mock DLQ service
			mockDLQ := &MockDLQ{}

			// Create router
			router := NewRouter(slog.Default(), mockPipelineManager, mockDLQ)

			// Create request
			url := "/api/v1/pipeline/" + tt.pipelineID + "/resume"
			req := httptest.NewRequest("POST", url, nil)
			w := httptest.NewRecorder()

			// Call router
			router.ServeHTTP(w, req)

			// Assert status code
			assert.Equal(t, tt.expectedStatus, w.Code)

			// Assert response body
			if tt.expectedBody != "" {
				assert.JSONEq(t, tt.expectedBody, w.Body.String())
			} else {
				assert.Empty(t, w.Body.String())
			}

			// Verify mock expectations
			if tt.pipelineID != "" {
				mockPipelineManager.AssertExpectations(t)
			}
		})
	}
}
