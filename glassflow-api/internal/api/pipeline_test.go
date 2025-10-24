package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"log/slog"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/api/mocks"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/service"
	"github.com/gorilla/mux"
	"github.com/stretchr/testify/assert"
	"go.uber.org/mock/gomock"
)

func TestEditPipeline_Success(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockPipelineManager := mocks.NewMockPipelineManager(ctrl)
	logger := slog.Default()

	handler := &handler{
		log:             logger,
		pipelineManager: mockPipelineManager,
	}

	// Test data - use a simple valid pipeline JSON
	pipelineID := "test-pipeline-123"
	editRequest := map[string]interface{}{
		"pipeline_id": pipelineID,
		"name":        "Updated Pipeline",
		"source": map[string]interface{}{
			"type":     "kafka",
			"provider": "confluent",
			"connection_params": map[string]interface{}{
				"brokers":   []string{"localhost:9092"},
				"skip_auth": true,
				"protocol":  "PLAINTEXT",
			},
			"topics": []map[string]interface{}{
				{
					"topic": "test-topic",
					"id":    "topic-1",
					"schema": map[string]interface{}{
						"type": "json",
						"fields": []map[string]interface{}{
							{"name": "id", "data_type": "string"},
						},
					},
				},
			},
		},
		"join": map[string]interface{}{
			"type":    "temporal",
			"enabled": false,
		},
		"sink": map[string]interface{}{
			"type":           "clickhouse",
			"host":           "localhost",
			"port":           "9000",
			"http_port":      "8123",
			"database":       "test_db",
			"table":          "test_table",
			"username":       "default",
			"password":       "test_password",
			"secure":         false,
			"max_batch_size": 1000,
			"max_delay_time": "60s",
		},
	}

	// Setup mock expectations
	mockPipelineManager.EXPECT().EditPipeline(gomock.Any(), pipelineID, gomock.Any()).Return(nil)

	// Create request
	reqBody, _ := json.Marshal(editRequest)
	req := httptest.NewRequest("POST", "/api/v1/pipeline/"+pipelineID+"/edit", bytes.NewBuffer(reqBody))
	req.Header.Set("Content-Type", "application/json")

	// Create response recorder
	w := httptest.NewRecorder()

	// Create router and add route
	router := mux.NewRouter()
	router.HandleFunc("/api/v1/pipeline/{id}/edit", handler.editPipeline).Methods("POST")

	// Execute request
	router.ServeHTTP(w, req)

	// Assertions
	assert.Equal(t, http.StatusNoContent, w.Code)
}

func TestEditPipeline_PipelineNotFound(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockPipelineManager := mocks.NewMockPipelineManager(ctrl)
	logger := slog.Default()

	handler := &handler{
		log:             logger,
		pipelineManager: mockPipelineManager,
	}

	pipelineID := "non-existent-pipeline"
	editRequest := map[string]interface{}{
		"pipeline_id": pipelineID,
		"name":        "Updated Pipeline",
		"source": map[string]interface{}{
			"type":     "kafka",
			"provider": "confluent",
			"connection_params": map[string]interface{}{
				"brokers":   []string{"localhost:9092"},
				"skip_auth": true,
				"protocol":  "PLAINTEXT",
			},
			"topics": []map[string]interface{}{
				{
					"topic": "test-topic",
					"id":    "topic-1",
					"schema": map[string]interface{}{
						"type": "json",
						"fields": []map[string]interface{}{
							{"name": "id", "data_type": "string"},
						},
					},
				},
			},
		},
		"join": map[string]interface{}{
			"type":    "temporal",
			"enabled": false,
		},
		"sink": map[string]interface{}{
			"type":           "clickhouse",
			"host":           "localhost",
			"port":           "9000",
			"http_port":      "8123",
			"database":       "test_db",
			"table":          "test_table",
			"username":       "default",
			"password":       "test_password",
			"secure":         false,
			"max_batch_size": 1000,
			"max_delay_time": "60s",
		},
	}

	// Setup mock expectations
	mockPipelineManager.EXPECT().EditPipeline(gomock.Any(), pipelineID, gomock.Any()).Return(service.ErrPipelineNotExists)

	// Create request
	reqBody, _ := json.Marshal(editRequest)
	req := httptest.NewRequest("POST", "/api/v1/pipeline/"+pipelineID+"/edit", bytes.NewBuffer(reqBody))
	req.Header.Set("Content-Type", "application/json")

	// Create response recorder
	w := httptest.NewRecorder()

	// Create router and add route
	router := mux.NewRouter()
	router.HandleFunc("/api/v1/pipeline/{id}/edit", handler.editPipeline).Methods("POST")

	// Execute request
	router.ServeHTTP(w, req)

	// Assertions
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestEditPipeline_IDMismatch(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()
	mockPipelineManager := mocks.NewMockPipelineManager(ctrl)

	logger := slog.Default()

	handler := &handler{
		log:             logger,
		pipelineManager: mockPipelineManager,
	}

	// Test data with mismatched pipeline ID
	pipelineID := "test-pipeline-123"
	editRequest := map[string]interface{}{
		"pipeline_id": "different-pipeline-id",
		"name":        "Updated Pipeline",
	}

	// Create request
	reqBody, _ := json.Marshal(editRequest)
	req := httptest.NewRequest("POST", "/api/v1/pipeline/"+pipelineID+"/edit", bytes.NewBuffer(reqBody))
	req.Header.Set("Content-Type", "application/json")

	// Create response recorder
	w := httptest.NewRecorder()

	// Create router and add route
	router := mux.NewRouter()
	router.HandleFunc("/api/v1/pipeline/{id}/edit", handler.editPipeline).Methods("POST")

	// Execute request
	router.ServeHTTP(w, req)

	// Assertions
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestEditPipeline_InvalidJSON(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()
	mockPipelineManager := mocks.NewMockPipelineManager(ctrl)

	logger := slog.Default()

	handler := &handler{
		log:             logger,
		pipelineManager: mockPipelineManager,
	}

	// Test data with invalid JSON
	pipelineID := "test-pipeline-123"
	invalidJSON := `{"pipeline_id": "test-pipeline-123", "name": "Updated Pipeline", "invalid": }`

	// Create request
	req := httptest.NewRequest("POST", "/api/v1/pipeline/"+pipelineID+"/edit", bytes.NewBufferString(invalidJSON))
	req.Header.Set("Content-Type", "application/json")

	// Create response recorder
	w := httptest.NewRecorder()

	// Create router and add route
	router := mux.NewRouter()
	router.HandleFunc("/api/v1/pipeline/{id}/edit", handler.editPipeline).Methods("POST")

	// Execute request
	router.ServeHTTP(w, req)

	// Assertions
	assert.Equal(t, http.StatusBadRequest, w.Code)
}
