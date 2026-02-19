package api

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.uber.org/mock/gomock"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/api/mocks"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/service"
)

func TestEditPipeline_Success(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockPipelineService := mocks.NewMockPipelineService(ctrl)
	logger := slog.Default()

	handler := &handler{
		log:             logger,
		pipelineService: mockPipelineService,
	}

	// Test data - use a simple valid pipeline JSON
	pipelineID := "test-pipeline-123"
	editRequestData := map[string]interface{}{
		"pipeline_id": pipelineID,
		"name":        "Updated Pipeline",
		"source": map[string]interface{}{
			"type":     "kafka",
			"provider": "confluent",
			"connection_params": map[string]interface{}{
				"brokers":   []string{"localhost:9092"},
				"mechanism": "NO_AUTH",
				"protocol":  "SASL_PLAINTEXT",
			},
			"topics": []map[string]interface{}{
				{
					"name": "test-topic",
					"id":   "topic-1",
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
		"schema": map[string]interface{}{
			"fields": []map[string]interface{}{
				{
					"source_id":   "test-topic",
					"name":        "id",
					"type":        "string",
					"column_name": "id",
					"column_type": "String",
				},
			},
		},
	}

	// Convert to pipelineJSON
	jsonBytes, _ := json.Marshal(editRequestData)
	var pipelineBody pipelineJSON
	err := json.Unmarshal(jsonBytes, &pipelineBody)
	require.NoError(t, err)

	// Setup mock expectations
	mockPipelineService.EXPECT().EditPipeline(gomock.Any(), pipelineID, gomock.Any()).Return(nil)

	// Create input
	input := &EditPipelineInput{
		ID:   pipelineID,
		Body: pipelineBody,
	}

	// Call handler
	response, err := handler.editPipeline(context.Background(), input)

	// Assertions
	require.NoError(t, err)
	require.NotNil(t, response)
}

func TestEditPipeline_PipelineNotFound(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockPipelineService := mocks.NewMockPipelineService(ctrl)
	logger := slog.Default()

	handler := &handler{
		log:             logger,
		pipelineService: mockPipelineService,
	}

	pipelineID := "non-existent-pipeline"
	editRequestData := map[string]interface{}{
		"pipeline_id": pipelineID,
		"name":        "Updated Pipeline",
		"source": map[string]interface{}{
			"type":     "kafka",
			"provider": "confluent",
			"connection_params": map[string]interface{}{
				"brokers":   []string{"localhost:9092"},
				"mechanism": "NO_AUTH",
				"protocol":  "SASL_PLAINTEXT",
			},
			"topics": []map[string]interface{}{
				{
					"name": "test-topic",
					"id":   "topic-1",
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
		"schema": map[string]interface{}{
			"fields": []map[string]interface{}{
				{
					"source_id":   "test-topic",
					"name":        "id",
					"type":        "string",
					"column_name": "id",
					"column_type": "String",
				},
			},
		},
	}

	// Convert to pipelineJSON
	jsonBytes, _ := json.Marshal(editRequestData)
	var pipelineBody pipelineJSON
	err := json.Unmarshal(jsonBytes, &pipelineBody)
	require.NoError(t, err)

	// Setup mock expectations
	mockPipelineService.EXPECT().EditPipeline(gomock.Any(), pipelineID, gomock.Any()).Return(service.ErrPipelineNotExists)

	// Create input
	input := &EditPipelineInput{
		ID:   pipelineID,
		Body: pipelineBody,
	}

	// Call handler
	response, err := handler.editPipeline(context.Background(), input)

	// Assertions
	require.Error(t, err)
	require.Nil(t, response)

	// Check error details
	var errDetail *ErrorDetail
	require.ErrorAs(t, err, &errDetail)
	assert.Equal(t, http.StatusNotFound, errDetail.Status)
	assert.Equal(t, "not_found", errDetail.Code)
}

func TestEditPipeline_IDMismatch(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()
	mockPipelineService := mocks.NewMockPipelineService(ctrl)

	logger := slog.Default()

	handler := &handler{
		log:             logger,
		pipelineService: mockPipelineService,
	}

	// Test data with mismatched pipeline ID
	pipelineID := "test-pipeline-123"
	editRequestData := map[string]interface{}{
		"pipeline_id": "different-pipeline-id",
		"name":        "Updated Pipeline",
	}

	// Convert to pipelineJSON
	jsonBytes, _ := json.Marshal(editRequestData)
	var pipelineBody pipelineJSON
	err := json.Unmarshal(jsonBytes, &pipelineBody)
	require.NoError(t, err)

	// Create input
	input := &EditPipelineInput{
		ID:   pipelineID,
		Body: pipelineBody,
	}

	// Call handler (should not call EditPipeline on service due to ID mismatch)
	response, err := handler.editPipeline(context.Background(), input)

	// Assertions
	require.Error(t, err)
	require.Nil(t, response)

	// Check error details
	var errDetail *ErrorDetail
	require.ErrorAs(t, err, &errDetail)
	assert.Equal(t, http.StatusBadRequest, errDetail.Status)
	assert.Equal(t, "bad_request", errDetail.Code)
	assert.Contains(t, errDetail.Message, "pipeline ID in request body must match")
}

func TestEditPipeline_InvalidPipelineData(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()
	mockPipelineService := mocks.NewMockPipelineService(ctrl)

	logger := slog.Default()

	handler := &handler{
		log:             logger,
		pipelineService: mockPipelineService,
	}

	// Test data with incomplete/invalid pipeline data
	pipelineID := "test-pipeline-123"

	// Create a minimal/invalid pipeline body that will fail toModel() conversion
	var pipelineBody pipelineJSON
	pipelineBody.PipelineID = pipelineID
	pipelineBody.Name = "Test"
	// Missing required fields like source, sink, schema will cause toModel() to fail

	// Create input
	input := &EditPipelineInput{
		ID:   pipelineID,
		Body: pipelineBody,
	}

	// Call handler
	response, err := handler.editPipeline(context.Background(), input)

	// Assertions
	require.Error(t, err)
	require.Nil(t, response)

	// Check error details
	var errDetail *ErrorDetail
	require.ErrorAs(t, err, &errDetail)
	assert.Equal(t, http.StatusUnprocessableEntity, errDetail.Status)
	assert.Equal(t, "unprocessable_entity", errDetail.Code)
}

// validCreatePipelineBody returns a minimal valid pipeline JSON for create (used as base for validation tests).
func validCreatePipelineBody() map[string]interface{} {
	return map[string]interface{}{
		"pipeline_id": "test-pipeline",
		"name":        "Test Pipeline",
		"source": map[string]interface{}{
			"type":     "kafka",
			"provider": "confluent",
			"connection_params": map[string]interface{}{
				"brokers":   []string{"localhost:9092"},
				"mechanism": "NO_AUTH",
				"protocol":  "SASL_PLAINTEXT",
			},
			"topics": []map[string]interface{}{
				{"name": "test-topic", "id": "topic-1"},
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
			"password":       "x",
			"secure":         false,
			"max_batch_size": 1000,
			"max_delay_time": "60s",
		},
		"schema": map[string]interface{}{
			"fields": []map[string]interface{}{
				{
					"source_id":   "test-topic",
					"name":        "id",
					"type":        "string",
					"column_name": "id",
					"column_type": "String",
				},
			},
		},
	}
}

func TestCreatePipeline_UnsupportedClickHouseColumnType(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockPipelineService := mocks.NewMockPipelineService(ctrl)
	// CreatePipeline must NOT be called because validation fails in toModel()
	handler := &handler{
		log:             slog.Default(),
		pipelineService: mockPipelineService,
	}

	body := validCreatePipelineBody()
	// Override schema to use an unsupported ClickHouse column type
	body["schema"] = map[string]interface{}{
		"fields": []map[string]interface{}{
			{
				"source_id":   "test-topic",
				"name":        "id",
				"type":        "string",
				"column_name": "id",
				"column_type": "Unsupported",
			},
		},
	}

	jsonBytes, err := json.Marshal(body)
	require.NoError(t, err)
	var pipelineBody pipelineJSON
	err = json.Unmarshal(jsonBytes, &pipelineBody)
	require.NoError(t, err)

	input := &CreatePipelineInput{Body: pipelineBody}
	response, err := handler.createPipeline(context.Background(), input)

	require.Error(t, err)
	require.Nil(t, response)
	var errDetail *ErrorDetail
	require.ErrorAs(t, err, &errDetail)
	assert.Equal(t, http.StatusUnprocessableEntity, errDetail.Status)
	assert.Equal(t, "unprocessable_entity", errDetail.Code)
	assert.Contains(t, errDetail.Message, "failed to convert request to pipeline model")
	// Details should mention unsupported column type
	if errDetail.Details != nil {
		if e, ok := errDetail.Details["error"].(string); ok {
			assert.Contains(t, e, "unsupported ClickHouse column type")
			assert.Contains(t, e, "Unsupported")
		}
	}
}

func TestCreatePipeline_InvalidStatelessTransformExpression(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockPipelineService := mocks.NewMockPipelineService(ctrl)
	handler := &handler{
		log:             slog.Default(),
		pipelineService: mockPipelineService,
	}

	body := validCreatePipelineBody()
	// Enable stateless transformation with an invalid expression (will not compile)
	body["stateless_transformation"] = map[string]interface{}{
		"id":      "test-transform",
		"type":    "expr_lang_transform",
		"enabled": true,
		"config": map[string]interface{}{
			"transform": []map[string]interface{}{
				{
					"expression": "invalid ??? syntax",
					"output_name": "out",
					"output_type": "string",
				},
			},
		},
	}

	jsonBytes, err := json.Marshal(body)
	require.NoError(t, err)
	var pipelineBody pipelineJSON
	err = json.Unmarshal(jsonBytes, &pipelineBody)
	require.NoError(t, err)

	input := &CreatePipelineInput{Body: pipelineBody}
	response, err := handler.createPipeline(context.Background(), input)

	require.Error(t, err)
	require.Nil(t, response)
	var errDetail *ErrorDetail
	require.ErrorAs(t, err, &errDetail)
	assert.Equal(t, http.StatusUnprocessableEntity, errDetail.Status)
	assert.Equal(t, "unprocessable_entity", errDetail.Code)
	assert.Contains(t, errDetail.Message, "failed to convert request to pipeline model")
	if errDetail.Details != nil {
		if e, ok := errDetail.Details["error"].(string); ok {
			assert.Contains(t, e, "stateless transformation")
		}
	}
}

func TestCreatePipeline_UndefinedFunctionInStatelessTransform(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockPipelineService := mocks.NewMockPipelineService(ctrl)
	handler := &handler{
		log:             slog.Default(),
		pipelineService: mockPipelineService,
	}

	body := validCreatePipelineBody()
	// Expression compiles but uses undefined function - should fail when we run with sample
	body["stateless_transformation"] = map[string]interface{}{
		"id":      "test-transform",
		"type":    "expr_lang_transform",
		"enabled": true,
		"config": map[string]interface{}{
			"transform": []map[string]interface{}{
				{
					"expression":  "convert2Blah(id)",
					"output_name": "out",
					"output_type": "string",
				},
			},
		},
	}

	jsonBytes, err := json.Marshal(body)
	require.NoError(t, err)
	var pipelineBody pipelineJSON
	err = json.Unmarshal(jsonBytes, &pipelineBody)
	require.NoError(t, err)

	input := &CreatePipelineInput{Body: pipelineBody}
	response, err := handler.createPipeline(context.Background(), input)

	require.Error(t, err)
	require.Nil(t, response)
	var errDetail *ErrorDetail
	require.ErrorAs(t, err, &errDetail)
	assert.Equal(t, http.StatusUnprocessableEntity, errDetail.Status)
	if errDetail.Details != nil {
		if e, ok := errDetail.Details["error"].(string); ok {
			assert.Contains(t, e, "stateless transformation")
			// Runtime error from expr when calling undefined function
			assert.Contains(t, e, "cannot call nil")
		}
	}
}

func TestCreatePipeline_ValidStatelessTransformAccepted(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockPipelineService := mocks.NewMockPipelineService(ctrl)
	mockPipelineService.EXPECT().CreatePipeline(gomock.Any(), gomock.Any()).Return(nil)

	handler := &handler{
		log:             slog.Default(),
		pipelineService: mockPipelineService,
	}

	body := validCreatePipelineBody()
	body["stateless_transformation"] = map[string]interface{}{
		"id":      "test-transform",
		"type":    "expr_lang_transform",
		"enabled": true,
		"config": map[string]interface{}{
			"transform": []map[string]interface{}{
				{
					"expression":  "lower(id)",
					"output_name": "out",
					"output_type": "string",
				},
			},
		},
	}

	jsonBytes, err := json.Marshal(body)
	require.NoError(t, err)
	var pipelineBody pipelineJSON
	err = json.Unmarshal(jsonBytes, &pipelineBody)
	require.NoError(t, err)

	input := &CreatePipelineInput{Body: pipelineBody}
	response, err := handler.createPipeline(context.Background(), input)

	require.NoError(t, err)
	require.NotNil(t, response)
}