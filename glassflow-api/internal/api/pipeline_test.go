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

	// Test data - use a simple valid v3 pipeline JSON
	pipelineID := "test-pipeline-123"
	editRequestData := map[string]interface{}{
		"version":     "v3",
		"pipeline_id": pipelineID,
		"name":        "Updated Pipeline",
		"sources": []map[string]interface{}{
			{
				"type":      "kafka",
				"source_id": "topic-1",
				"connection_params": map[string]interface{}{
					"brokers":   []string{"localhost:9092"},
					"mechanism": "NO_AUTH",
					"protocol":  "SASL_PLAINTEXT",
				},
				"topic": "test-topic",
			},
		},
		"sink": map[string]interface{}{
			"type": "clickhouse",
			"connection_params": map[string]interface{}{
				"host":      "localhost",
				"port":      "9000",
				"http_port": "8123",
				"database":  "test_db",
				"username":  "default",
				"password":  "test_password",
				"secure":    false,
			},
			"table":          "test_table",
			"max_batch_size": 1000,
			"max_delay_time": "60s",
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
		"version":     "v3",
		"pipeline_id": pipelineID,
		"name":        "Updated Pipeline",
		"sources": []map[string]interface{}{
			{
				"type":      "kafka",
				"source_id": "topic-1",
				"connection_params": map[string]interface{}{
					"brokers":   []string{"localhost:9092"},
					"mechanism": "NO_AUTH",
					"protocol":  "SASL_PLAINTEXT",
				},
				"topic": "test-topic",
			},
		},
		"sink": map[string]interface{}{
			"type": "clickhouse",
			"connection_params": map[string]interface{}{
				"host":      "localhost",
				"port":      "9000",
				"http_port": "8123",
				"database":  "test_db",
				"username":  "default",
				"password":  "test_password",
				"secure":    false,
			},
			"table":          "test_table",
			"max_batch_size": 1000,
			"max_delay_time": "60s",
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
	// Missing required fields like sources, sink will cause toModel() to fail

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

func TestCreatePipeline_PipelineIDTooShort(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockPipelineService := mocks.NewMockPipelineService(ctrl)
	handler := &handler{log: slog.Default(), pipelineService: mockPipelineService}

	body := validCreatePipelineBody()
	body["pipeline_id"] = "test" // 4 characters

	jsonBytes, err := json.Marshal(body)
	require.NoError(t, err)
	var pipelineBody pipelineJSON
	require.NoError(t, json.Unmarshal(jsonBytes, &pipelineBody))

	input := &CreatePipelineInput{Body: pipelineBody}
	response, err := handler.createPipeline(context.Background(), input)

	require.Error(t, err)
	require.Nil(t, response)
	var errDetail *ErrorDetail
	require.ErrorAs(t, err, &errDetail)
	assert.Equal(t, http.StatusUnprocessableEntity, errDetail.Status)
	assert.Contains(t, errDetail.Message, "failed to convert request to pipeline model")
	if errDetail.Details != nil {
		if e, ok := errDetail.Details["error"].(string); ok {
			assert.Contains(t, e, "pipeline ID must be at least 5 characters")
		}
	}
}

func TestCreatePipeline_CRDAlignedValidations(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockPipelineService := mocks.NewMockPipelineService(ctrl)
	handler := &handler{
		log:             slog.Default(),
		pipelineService: mockPipelineService,
	}

	tests := []struct {
		name        string
		modify      func(map[string]interface{})
		wantContain string
	}{
		{
			name: "no sources",
			modify: func(b map[string]interface{}) {
				b["sources"] = []map[string]interface{}{}
			},
			wantContain: "at least one source",
		},
		{
			name: "more than two sources",
			modify: func(b map[string]interface{}) {
				connParams := map[string]interface{}{
					"brokers":   []string{"localhost:9092"},
					"mechanism": "NO_AUTH",
					"protocol":  "SASL_PLAINTEXT",
				}
				b["sources"] = []map[string]interface{}{
					{"type": "kafka", "source_id": "t1", "connection_params": connParams, "topic": "t1"},
					{"type": "kafka", "source_id": "t2", "connection_params": connParams, "topic": "t2"},
					{"type": "kafka", "source_id": "t3", "connection_params": connParams, "topic": "t3"},
				}
			},
			wantContain: "at most 2 sources",
		},
		{
			name: "empty source_id",
			modify: func(b map[string]interface{}) {
				sources := b["sources"].([]map[string]interface{})
				sources[0]["source_id"] = ""
			},
			wantContain: "empty source_id",
		},
		{
			name: "unsupported source type",
			modify: func(b map[string]interface{}) {
				sources := b["sources"].([]map[string]interface{})
				sources[0]["type"] = "rabbitmq"
			},
			wantContain: "unsupported type",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			body := validCreatePipelineBody()
			tt.modify(body)
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
					assert.Contains(t, e, tt.wantContain, "error message should contain %q", tt.wantContain)
				}
			}
		})
	}
}

func TestCreatePipeline_JoinEnabledRejectsIncompatibleComponents(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockPipelineService := mocks.NewMockPipelineService(ctrl)
	handler := &handler{
		log:             slog.Default(),
		pipelineService: mockPipelineService,
	}

	tests := []struct {
		name        string
		modify      func(map[string]interface{})
		wantContain string
	}{
		{
			name: "stateless transformation enabled",
			modify: func(b map[string]interface{}) {
				b["transforms"] = []map[string]interface{}{
					{
						"type":      "stateless",
						"source_id": "orders",
						"config": map[string]interface{}{
							"transforms": []map[string]interface{}{
								{
									"expression":  "lower(order_id)",
									"output_name": "out",
									"output_type": "string",
								},
							},
						},
					},
				}
			},
			wantContain: "filter/stateless transforms are not supported with join",
		},
		{
			name: "filter enabled",
			modify: func(b map[string]interface{}) {
				b["transforms"] = []map[string]interface{}{
					{
						"type":      "filter",
						"source_id": "orders",
						"config": map[string]interface{}{
							"expression": `order_id != ""`,
						},
					},
				}
			},
			wantContain: "filter/stateless transforms are not supported with join",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			body := validJoinPipelineBody()
			tt.modify(body)

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
			if errDetail.Details != nil {
				if e, ok := errDetail.Details["error"].(string); ok {
					assert.Contains(t, e, tt.wantContain)
				}
			}
		})
	}
}

func TestEditPipeline_JoinEnabledRejectsIncompatibleComponents(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockPipelineService := mocks.NewMockPipelineService(ctrl)
	handler := &handler{
		log:             slog.Default(),
		pipelineService: mockPipelineService,
	}

	tests := []struct {
		name        string
		modify      func(map[string]interface{})
		wantContain string
	}{
		{
			name: "stateless transformation enabled",
			modify: func(b map[string]interface{}) {
				b["transforms"] = []map[string]interface{}{
					{
						"type":      "stateless",
						"source_id": "orders",
						"config": map[string]interface{}{
							"transforms": []map[string]interface{}{
								{
									"expression":  "lower(order_id)",
									"output_name": "out",
									"output_type": "string",
								},
							},
						},
					},
				}
			},
			wantContain: "filter/stateless transforms are not supported with join",
		},
		{
			name: "filter enabled",
			modify: func(b map[string]interface{}) {
				b["transforms"] = []map[string]interface{}{
					{
						"type":      "filter",
						"source_id": "orders",
						"config": map[string]interface{}{
							"expression": `order_id != ""`,
						},
					},
				}
			},
			wantContain: "filter/stateless transforms are not supported with join",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			body := validJoinPipelineBody()
			tt.modify(body)

			jsonBytes, err := json.Marshal(body)
			require.NoError(t, err)

			var pipelineBody pipelineJSON
			err = json.Unmarshal(jsonBytes, &pipelineBody)
			require.NoError(t, err)

			input := &EditPipelineInput{
				ID:   body["pipeline_id"].(string),
				Body: pipelineBody,
			}
			response, err := handler.editPipeline(context.Background(), input)

			require.Error(t, err)
			require.Nil(t, response)

			var errDetail *ErrorDetail
			require.ErrorAs(t, err, &errDetail)
			assert.Equal(t, http.StatusUnprocessableEntity, errDetail.Status)
			assert.Equal(t, "unprocessable_entity", errDetail.Code)
			if errDetail.Details != nil {
				if e, ok := errDetail.Details["error"].(string); ok {
					assert.Contains(t, e, tt.wantContain)
				}
			}
		})
	}
}

// validCreatePipelineBody returns a minimal valid v3 pipeline JSON for create (used as base for validation tests).
func validCreatePipelineBody() map[string]interface{} {
	return map[string]interface{}{
		"version":     "v3",
		"pipeline_id": "test-pipeline",
		"name":        "Test Pipeline",
		"sources": []map[string]interface{}{
			{
				"type":      "kafka",
				"source_id": "test-topic",
				"connection_params": map[string]interface{}{
					"brokers":   []string{"localhost:9092"},
					"mechanism": "NO_AUTH",
					"protocol":  "SASL_PLAINTEXT",
				},
				"topic": "test-topic",
				"schema_fields": []map[string]interface{}{
					{
						"name": "id",
						"type": "string",
					},
				},
			},
		},
		"sink": map[string]interface{}{
			"type": "clickhouse",
			"connection_params": map[string]interface{}{
				"host":      "localhost",
				"port":      "9000",
				"http_port": "8123",
				"database":  "test_db",
				"username":  "default",
				"password":  "x",
				"secure":    false,
			},
			"table":          "test_table",
			"max_batch_size": 1000,
			"max_delay_time": "60s",
		},
	}
}

// validJoinPipelineBody returns a valid v3 two-source Kafka pipeline with join enabled.
func validJoinPipelineBody() map[string]interface{} {
	connParams := map[string]interface{}{
		"brokers":   []string{"localhost:9092"},
		"mechanism": "NO_AUTH",
		"protocol":  "SASL_PLAINTEXT",
	}
	return map[string]interface{}{
		"version":     "v3",
		"pipeline_id": "test-pipeline",
		"name":        "Test Pipeline",
		"sources": []map[string]interface{}{
			{
				"type":              "kafka",
				"source_id":         "orders",
				"connection_params": connParams,
				"topic":             "orders",
				"schema_fields": []map[string]interface{}{
					{"name": "order_id", "type": "string"},
					{"name": "customer_id", "type": "string"},
				},
			},
			{
				"type":              "kafka",
				"source_id":         "users",
				"connection_params": connParams,
				"topic":             "users",
				"schema_fields": []map[string]interface{}{
					{"name": "user_id", "type": "string"},
					{"name": "email", "type": "string"},
				},
			},
		},
		"join": map[string]interface{}{
			"enabled":      true,
			"type":         "temporal",
			"left_source":  map[string]interface{}{"source_id": "orders", "key": "customer_id", "time_window": "30s"},
			"right_source": map[string]interface{}{"source_id": "users", "key": "user_id", "time_window": "30s"},
			"output_fields": []map[string]interface{}{
				{"source_id": "orders", "name": "order_id", "output_name": "ORDER_ID"},
				{"source_id": "users", "name": "email"},
			},
		},
		"sink": map[string]interface{}{
			"type": "clickhouse",
			"connection_params": map[string]interface{}{
				"host":      "localhost",
				"port":      "9000",
				"http_port": "8123",
				"database":  "test_db",
				"username":  "default",
				"password":  "x",
				"secure":    false,
			},
			"table":          "joined",
			"max_batch_size": 500,
			"max_delay_time": "2s",
			"mapping": []map[string]interface{}{
				{"name": "ORDER_ID", "column_name": "order_id", "column_type": "String"},
				{"name": "email", "column_name": "email", "column_type": "String"},
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
	// Add sink mapping with an unsupported ClickHouse column type
	sinkMap := body["sink"].(map[string]interface{})
	sinkMap["mapping"] = []map[string]interface{}{
		{
			"name":        "id",
			"column_name": "id",
			"column_type": "Unsupported",
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
	// Add stateless transform with an invalid expression
	body["transforms"] = []map[string]interface{}{
		{
			"type":      "stateless",
			"source_id": "test-topic",
			"config": map[string]interface{}{
				"transforms": []map[string]interface{}{
					{
						"expression":  "invalid ??? syntax",
						"output_name": "out",
						"output_type": "string",
					},
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
	body["transforms"] = []map[string]interface{}{
		{
			"type":      "stateless",
			"source_id": "test-topic",
			"config": map[string]interface{}{
				"transforms": []map[string]interface{}{
					{
						"expression":  "lower(id)",
						"output_name": "out",
						"output_type": "string",
					},
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
