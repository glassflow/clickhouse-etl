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
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
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

func TestBuildPipelineSchemaV2(t *testing.T) {
	tests := []struct {
		name             string
		schemas          []models.SchemaV2
		versions         []models.SchemaVersion
		mapping          models.Mapping
		expectedSources  int
		expectedMappings int
		validate         func(t *testing.T, result pipelineSchema)
	}{
		{
			name: "single kafka source with internal schema",
			schemas: []models.SchemaV2{
				{
					ID:         "schema-1",
					SourceName: "test-topic",
					ConfigType: models.SchemaConfigTypeInternal,
					DataFormat: models.SchemaDataFormatJSON,
					SchemaType: models.SchemaTypeKafka,
				},
				{
					ID:         "schema-sink",
					SourceName: "sink",
					ConfigType: models.SchemaConfigTypeInternal,
					DataFormat: models.SchemaDataFormatJSON,
					SchemaType: models.SchemaTypeClickHouse,
				},
			},
			versions: []models.SchemaVersion{
				{
					ID:       "version-1",
					SchemaID: "schema-1",
					Version:  "1.0",
					Status:   "active",
					SchemaFields: models.SchemaFields{
						Fields: []models.Field{
							{Name: "id", Type: "string"},
							{Name: "name", Type: "string"},
							{Name: "age", Type: "int32"},
						},
					},
				},
			},
			mapping: models.Mapping{
				ID:   "mapping-1",
				Type: "source",
				Fields: []models.MappingField{
					{
						SourceID:         "test-topic",
						SourceField:      "id",
						SourceType:       "string",
						DestinationField: "user_id",
						DestinationType:  "String",
					},
					{
						SourceID:         "test-topic",
						SourceField:      "name",
						SourceType:       "string",
						DestinationField: "user_name",
						DestinationType:  "String",
					},
				},
			},
			expectedSources:  1,
			expectedMappings: 2,
			validate: func(t *testing.T, result pipelineSchema) {
				require.Len(t, result.Sources, 1)
				source := result.Sources[0]
				assert.Equal(t, "test-topic", source.ID)
				assert.Equal(t, "json", source.DataType)
				assert.Equal(t, "internal", source.SchemaType)
				assert.Equal(t, "1.0", source.SchemaVersion)
				assert.Len(t, source.Fields, 3)

				// Verify fields
				fieldNames := make(map[string]string)
				for _, f := range source.Fields {
					fieldNames[f.Name] = f.Type
				}
				assert.Equal(t, "string", fieldNames["id"])
				assert.Equal(t, "string", fieldNames["name"])
				assert.Equal(t, "int32", fieldNames["age"])

				// Verify mappings
				require.Len(t, result.Mappings, 2)
				assert.Equal(t, "test-topic", result.Mappings[0].SourceID)
				assert.Equal(t, "id", result.Mappings[0].Name)
				assert.Equal(t, "user_id", result.Mappings[0].ColumnName)
				assert.Equal(t, "String", result.Mappings[0].ColumnType)
			},
		},
		{
			name: "multiple sources with external schema registry",
			schemas: []models.SchemaV2{
				{
					ID:         "schema-1",
					SourceName: "orders",
					ConfigType: models.SchemaConfigTypeExternal,
					DataFormat: models.SchemaDataFormatAVRO,
					SchemaType: models.SchemaTypeKafka,
					ExternalSchemaConfig: models.SchemaRegistryConfig{
						Type: models.SchemaRegistryTypeConfluent,
						URL:  "https://registry.example.com",
					},
				},
				{
					ID:         "schema-2",
					SourceName: "users",
					ConfigType: models.SchemaConfigTypeInternal,
					DataFormat: models.SchemaDataFormatJSON,
					SchemaType: models.SchemaTypeKafka,
				},
				{
					ID:         "schema-sink",
					SourceName: "sink",
					ConfigType: models.SchemaConfigTypeInternal,
					DataFormat: models.SchemaDataFormatJSON,
					SchemaType: models.SchemaTypeClickHouse,
				},
			},
			versions: []models.SchemaVersion{
				{
					ID:       "version-1",
					SchemaID: "schema-1",
					Version:  "2.1",
					Status:   "active",
					SchemaFields: models.SchemaFields{
						Fields: []models.Field{
							{Name: "order_id", Type: "string"},
							{Name: "amount", Type: "float64"},
						},
					},
				},
				{
					ID:       "version-2",
					SchemaID: "schema-2",
					Version:  "1.0",
					Status:   "active",
					SchemaFields: models.SchemaFields{
						Fields: []models.Field{
							{Name: "user_id", Type: "string"},
							{Name: "email", Type: "string"},
						},
					},
				},
			},
			mapping: models.Mapping{
				ID:   "mapping-2",
				Type: "join",
				Fields: []models.MappingField{
					{
						SourceID:         "orders",
						SourceField:      "order_id",
						SourceType:       "string",
						DestinationField: "order_id",
						DestinationType:  "String",
					},
					{
						SourceID:         "users",
						SourceField:      "user_id",
						SourceType:       "string",
						DestinationField: "user_id",
						DestinationType:  "String",
					},
				},
			},
			expectedSources:  2,
			expectedMappings: 2,
			validate: func(t *testing.T, result pipelineSchema) {
				require.Len(t, result.Sources, 2)

				// Find sources by ID
				var ordersSource, usersSource *SchemaSource
				for i := range result.Sources {
					switch result.Sources[i].ID {
					case "orders":
						ordersSource = &result.Sources[i]
					case "users":
						usersSource = &result.Sources[i]
					}
				}

				require.NotNil(t, ordersSource)
				require.NotNil(t, usersSource)

				// Verify orders source (external)
				assert.Equal(t, "avro", ordersSource.DataType)
				assert.Equal(t, "external", ordersSource.SchemaType)
				assert.Equal(t, "2.1", ordersSource.SchemaVersion)
				assert.Len(t, ordersSource.Fields, 2)

				// Verify users source (internal)
				assert.Equal(t, "json", usersSource.DataType)
				assert.Equal(t, "internal", usersSource.SchemaType)
				assert.Equal(t, "1.0", usersSource.SchemaVersion)
				assert.Len(t, usersSource.Fields, 2)
			},
		},
		{
			name: "schema without version is skipped",
			schemas: []models.SchemaV2{
				{
					ID:         "schema-1",
					SourceName: "topic-with-version",
					ConfigType: models.SchemaConfigTypeInternal,
					DataFormat: models.SchemaDataFormatJSON,
					SchemaType: models.SchemaTypeKafka,
				},
				{
					ID:         "schema-2",
					SourceName: "topic-without-version",
					ConfigType: models.SchemaConfigTypeInternal,
					DataFormat: models.SchemaDataFormatJSON,
					SchemaType: models.SchemaTypeKafka,
				},
			},
			versions: []models.SchemaVersion{
				{
					ID:       "version-1",
					SchemaID: "schema-1",
					Version:  "1.0",
					Status:   "active",
					SchemaFields: models.SchemaFields{
						Fields: []models.Field{
							{Name: "id", Type: "string"},
						},
					},
				},
				// schema-2 has no version
			},
			mapping: models.Mapping{
				Fields: []models.MappingField{},
			},
			expectedSources:  1, // Only schema-1 should be included
			expectedMappings: 0,
			validate: func(t *testing.T, result pipelineSchema) {
				require.Len(t, result.Sources, 1)
				assert.Equal(t, "topic-with-version", result.Sources[0].ID)
			},
		},
		{
			name: "clickhouse sink schemas are excluded",
			schemas: []models.SchemaV2{
				{
					ID:         "schema-1",
					SourceName: "kafka-topic",
					ConfigType: models.SchemaConfigTypeInternal,
					DataFormat: models.SchemaDataFormatJSON,
					SchemaType: models.SchemaTypeKafka,
				},
				{
					ID:         "schema-2",
					SourceName: "nats-stream",
					ConfigType: models.SchemaConfigTypeInternal,
					DataFormat: models.SchemaDataFormatJSON,
					SchemaType: models.SchemaTypeNATS,
				},
				{
					ID:         "schema-sink",
					SourceName: "sink",
					ConfigType: models.SchemaConfigTypeInternal,
					DataFormat: models.SchemaDataFormatJSON,
					SchemaType: models.SchemaTypeClickHouse,
				},
			},
			versions: []models.SchemaVersion{
				{
					ID:       "version-1",
					SchemaID: "schema-1",
					Version:  "1.0",
					SchemaFields: models.SchemaFields{
						Fields: []models.Field{{Name: "id", Type: "string"}},
					},
				},
				{
					ID:       "version-2",
					SchemaID: "schema-2",
					Version:  "1.0",
					SchemaFields: models.SchemaFields{
						Fields: []models.Field{{Name: "value", Type: "int32"}},
					},
				},
			},
			mapping: models.Mapping{
				Fields: []models.MappingField{},
			},
			expectedSources:  2, // Only kafka and nats, sink excluded
			expectedMappings: 0,
			validate: func(t *testing.T, result pipelineSchema) {
				require.Len(t, result.Sources, 2)
				for _, source := range result.Sources {
					assert.NotEqual(t, "sink", source.ID, "Sink should be excluded from sources")
				}
			},
		},
		{
			name:             "empty schemas and mappings",
			schemas:          []models.SchemaV2{},
			versions:         []models.SchemaVersion{},
			mapping:          models.Mapping{Fields: []models.MappingField{}},
			expectedSources:  0,
			expectedMappings: 0,
			validate: func(t *testing.T, result pipelineSchema) {
				assert.Empty(t, result.Sources)
				assert.Empty(t, result.Mappings)
			},
		},
		{
			name: "protobuf data format",
			schemas: []models.SchemaV2{
				{
					ID:         "schema-1",
					SourceName: "events",
					ConfigType: models.SchemaConfigTypeExternal,
					DataFormat: models.SchemaDataFormatProtobuf,
					SchemaType: models.SchemaTypeKafka,
				},
			},
			versions: []models.SchemaVersion{
				{
					ID:       "version-1",
					SchemaID: "schema-1",
					Version:  "3.0",
					SchemaFields: models.SchemaFields{
						Fields: []models.Field{
							{Name: "event_id", Type: "string"},
							{Name: "timestamp", Type: "int64"},
						},
					},
				},
			},
			mapping: models.Mapping{
				Fields: []models.MappingField{
					{
						SourceID:         "events",
						SourceField:      "event_id",
						SourceType:       "string",
						DestinationField: "id",
						DestinationType:  "String",
					},
				},
			},
			expectedSources:  1,
			expectedMappings: 1,
			validate: func(t *testing.T, result pipelineSchema) {
				require.Len(t, result.Sources, 1)
				assert.Equal(t, "protobuf", result.Sources[0].DataType)
				assert.Equal(t, "external", result.Sources[0].SchemaType)
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := buildPipelineSchemaV2(tt.schemas, tt.versions, tt.mapping)

			assert.Len(t, result.Sources, tt.expectedSources, "unexpected number of sources")
			assert.Len(t, result.Mappings, tt.expectedMappings, "unexpected number of mappings")

			if tt.validate != nil {
				tt.validate(t, result)
			}
		})
	}
}
