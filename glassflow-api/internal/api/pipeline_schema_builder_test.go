package api

import (
	"testing"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Helper function to create a minimal valid pipeline JSON for testing
func createTestPipelineJSON(pipelineID string) pipelineJSON {
	return pipelineJSON{
		PipelineID: pipelineID,
		Name:       "Test Pipeline",
		Source: pipelineSource{
			Kind:     "kafka",
			Provider: "confluent",
			Topics: []kafkaTopic{
				{
					ID:    "test-topic",
					Topic: "test-topic",
				},
			},
		},
		SchemaV2: pipelineSchema{
			Sources: []SchemaSource{
				{
					ID:            "test-topic",
					DataType:      "json",
					SchemaType:    "internal",
					SchemaVersion: "1",
					Fields: []Field{
						{Name: "id", Type: "string"},
						{Name: "name", Type: "string"},
					},
				},
			},
			Mappings: []SchemaMapping{
				{
					SourceID:   "test-topic",
					Name:       "id",
					ColumnName: "id",
					ColumnType: "String",
				},
				{
					SourceID:   "test-topic",
					Name:       "name",
					ColumnName: "name",
					ColumnType: "String",
				},
			},
		},
	}
}

func TestSchemaConfigBuilder_Build_Success(t *testing.T) {
	pipeline := createTestPipelineJSON("test-pipeline-001")

	builder := NewSchemaConfigBuilder(pipeline)
	schemaConfig, mapping, err := builder.Build()

	require.NoError(t, err)
	assert.NotEmpty(t, schemaConfig.Schemas)
	assert.NotEmpty(t, schemaConfig.Versions)
	assert.NotEmpty(t, mapping.Fields)

	// Should have: kafka source = 1 schema
	assert.Equal(t, 1, len(schemaConfig.Schemas))

	// Verify schema names
	schemaNames := make(map[string]bool)
	for _, s := range schemaConfig.Schemas {
		schemaNames[s.SourceName] = true
	}
	assert.True(t, schemaNames["test-topic"], "Should have kafka source schema")
}

func TestSchemaConfigBuilder_MismatchedSourcesAndTopics(t *testing.T) {
	pipeline := createTestPipelineJSON("test-pipeline-002")
	// Add extra topic without corresponding schema
	pipeline.Source.Topics = append(pipeline.Source.Topics, kafkaTopic{
		ID:    "extra-topic",
		Topic: "extra-topic",
	})

	builder := NewSchemaConfigBuilder(pipeline)
	_, _, err := builder.Build()

	require.Error(t, err)
	assert.Contains(t, err.Error(), "number of schema sources must match number of topics")
}

func TestSchemaConfigBuilder_WithTransformation(t *testing.T) {
	pipeline := createTestPipelineJSON("test-pipeline-003")

	// Add stateless transformation
	pipeline.StatelessTransformation = models.StatelessTransformation{
		Enabled: true,
		ID:      "transform-1",
		Config: models.StatelessTransformationsConfig{
			Transform: []models.Transform{
				{
					Expression: `id`,
					OutputName: "user_id",
					OutputType: "string",
				},
			},
		},
	}

	builder := NewSchemaConfigBuilder(pipeline)
	schemaConfig, mapping, err := builder.Build()

	require.NoError(t, err)
	assert.NotNil(t, mapping)

	// Should have: kafka source = 1 schema (transformation doesn't create additional schemas in new implementation)
	assert.Equal(t, 1, len(schemaConfig.Schemas))

	// Verify kafka source schema exists
	var foundSourceSchema bool
	for _, s := range schemaConfig.Schemas {
		if s.SourceName == "test-topic" {
			foundSourceSchema = true
			assert.Equal(t, models.SchemaTypeKafka, s.SchemaType)
			break
		}
	}

	assert.True(t, foundSourceSchema, "Should have kafka source schema")
}

func TestSchemaConfigBuilder_WithJoin(t *testing.T) {
	pipeline := createTestPipelineJSON("test-pipeline-004")

	// Add second topic for join
	pipeline.Source.Topics = append(pipeline.Source.Topics, kafkaTopic{
		ID:    "topic-2",
		Topic: "topic-2",
	})

	pipeline.SchemaV2.Sources = append(pipeline.SchemaV2.Sources, SchemaSource{
		ID:            "topic-2",
		DataType:      "json",
		SchemaType:    "internal",
		SchemaVersion: "1",
		Fields: []Field{
			{Name: "id", Type: "string"},
			{Name: "value", Type: "int32"},
		},
	})

	// Enable join
	pipeline.Join = pipelineJoin{
		Enabled: true,
		Kind:    "temporal",
		Sources: []joinSource{
			{
				SourceID:    "test-topic",
				JoinKey:     "id",
				Window:      *models.NewJSONDuration(60),
				Orientation: "left",
			},
			{
				SourceID:    "topic-2",
				JoinKey:     "id",
				Window:      *models.NewJSONDuration(60),
				Orientation: "right",
			},
		},
	}

	// Update mappings to include both sources
	pipeline.SchemaV2.Mappings = append(pipeline.SchemaV2.Mappings, SchemaMapping{
		SourceID:   "topic-2",
		Name:       "value",
		ColumnName: "value",
		ColumnType: "Int32",
	})

	builder := NewSchemaConfigBuilder(pipeline)
	schemaConfig, mapping, err := builder.Build()

	require.NoError(t, err)
	assert.Equal(t, "many_to_one", mapping.Type)
	assert.Equal(t, 2, len(schemaConfig.Schemas)) // 2 sources
	assert.Equal(t, 3, len(mapping.Fields))
}

func TestSchemaConfigBuilder_InvalidJoinKey(t *testing.T) {
	pipeline := createTestPipelineJSON("test-pipeline-005")

	// Enable join with invalid key
	pipeline.Join = pipelineJoin{
		Enabled: true,
		Sources: []joinSource{
			{
				SourceID: "test-topic",
				JoinKey:  "nonexistent_field", // This field doesn't exist in schema
			},
		},
	}

	builder := NewSchemaConfigBuilder(pipeline)
	_, _, err := builder.Build()

	require.Error(t, err)
	assert.Contains(t, err.Error(), "join key")
}

func TestSchemaConfigBuilder_InvalidDedupKey(t *testing.T) {
	pipeline := createTestPipelineJSON("test-pipeline-006")

	// Enable deduplication with invalid key
	pipeline.Source.Topics[0].Deduplication = topicDedupConfig{
		Enabled: true,
		ID:      "nonexistent_field", // This field doesn't exist in schema
		Window:  *models.NewJSONDuration(60),
	}

	builder := NewSchemaConfigBuilder(pipeline)
	_, _, err := builder.Build()

	require.Error(t, err)
	assert.Contains(t, err.Error(), "deduplication key")
}

func TestSchemaConfigBuilder_WithFilter(t *testing.T) {
	pipeline := createTestPipelineJSON("test-pipeline-007")

	// Enable filter
	pipeline.Filter = pipelineFilter{
		Enabled:    true,
		Expression: "id == \"123\"",
	}

	builder := NewSchemaConfigBuilder(pipeline)
	schemaConfig, mapping, err := builder.Build()

	require.NoError(t, err)
	assert.NotNil(t, schemaConfig)
	assert.NotNil(t, mapping)
}

func TestSchemaConfigBuilder_FilterWithMultipleTopics(t *testing.T) {
	pipeline := createTestPipelineJSON("test-pipeline-008")

	// Add second topic
	pipeline.Source.Topics = append(pipeline.Source.Topics, kafkaTopic{
		ID:    "topic-2",
		Topic: "topic-2",
	})

	pipeline.SchemaV2.Sources = append(pipeline.SchemaV2.Sources, SchemaSource{
		ID:            "topic-2",
		DataType:      "json",
		SchemaType:    "internal",
		SchemaVersion: "1",
		Fields:        []Field{{Name: "id", Type: "string"}},
	})

	// Enable filter (should fail with multiple topics)
	pipeline.Filter = pipelineFilter{
		Enabled:    true,
		Expression: "id == \"123\"",
	}

	builder := NewSchemaConfigBuilder(pipeline)
	_, _, err := builder.Build()

	require.Error(t, err)
	assert.Contains(t, err.Error(), "filtering supports only one source topic")
}

func TestSchemaConfigBuilder_EmptyMappings(t *testing.T) {
	pipeline := createTestPipelineJSON("test-pipeline-009")
	pipeline.SchemaV2.Mappings = []SchemaMapping{} // Empty mappings

	builder := NewSchemaConfigBuilder(pipeline)
	_, _, err := builder.Build()

	require.Error(t, err)
	assert.Contains(t, err.Error(), "at least one schema mapping must be defined")
}

func TestSchemaConfigBuilder_MappingFieldNotInSource(t *testing.T) {
	pipeline := createTestPipelineJSON("test-pipeline-010")

	// Add mapping for field that doesn't exist in source
	pipeline.SchemaV2.Mappings = append(pipeline.SchemaV2.Mappings, SchemaMapping{
		SourceID:   "test-topic",
		Name:       "nonexistent_field",
		ColumnName: "field",
		ColumnType: "String",
	})

	builder := NewSchemaConfigBuilder(pipeline)
	_, _, err := builder.Build()

	require.Error(t, err)
	assert.Contains(t, err.Error(), "not found in fields for source_id")
}

func TestSchemaConfigBuilder_ExternalSchema(t *testing.T) {
	pipeline := createTestPipelineJSON("test-pipeline-011")

	// Configure external schema
	pipeline.SchemaV2.Sources[0].SchemaType = "external"
	pipeline.Source.SchemaRegistryConfig = schemaRegistryConfig{
		URL:    "https://schema-registry.example.com",
		Key:    "api-key",
		Secret: "api-secret",
	}

	builder := NewSchemaConfigBuilder(pipeline)
	schemaConfig, mapping, err := builder.Build()

	require.NoError(t, err)
	assert.NotNil(t, mapping)

	// Verify external schema config
	assert.Equal(t, "https://schema-registry.example.com",
		schemaConfig.Schemas[0].ExternalSchemaConfig.URL)
}

func TestSchemaConfigBuilder_WithComplexPipeline(t *testing.T) {
	pipeline := pipelineJSON{
		PipelineID: "complex-pipeline",
		Name:       "Complex Test Pipeline",
		Source: pipelineSource{
			Kind:     "kafka",
			Provider: "confluent",
			Topics: []kafkaTopic{
				{
					ID:    "orders",
					Topic: "orders",
					Deduplication: topicDedupConfig{
						Enabled: true,
						ID:      "order_id",
						Window:  *models.NewJSONDuration(300),
					},
				},
				{
					ID:    "customers",
					Topic: "customers",
				},
			},
		},
		Join: pipelineJoin{
			Enabled: true,
			Kind:    "temporal",
			Sources: []joinSource{
				{
					SourceID:    "orders",
					JoinKey:     "customer_id",
					Window:      *models.NewJSONDuration(60),
					Orientation: "left",
				},
				{
					SourceID:    "customers",
					JoinKey:     "id",
					Window:      *models.NewJSONDuration(60),
					Orientation: "right",
				},
			},
		},
		Filter: pipelineFilter{
			Enabled: false, // Filter not compatible with join
		},
		SchemaV2: pipelineSchema{
			Sources: []SchemaSource{
				{
					ID:            "orders",
					DataType:      "json",
					SchemaType:    "internal",
					SchemaVersion: "1",
					Fields: []Field{
						{Name: "order_id", Type: "string"},
						{Name: "customer_id", Type: "string"},
						{Name: "amount", Type: "float64"},
					},
				},
				{
					ID:            "customers",
					DataType:      "json",
					SchemaType:    "internal",
					SchemaVersion: "1",
					Fields: []Field{
						{Name: "id", Type: "string"},
						{Name: "name", Type: "string"},
					},
				},
			},
			Mappings: []SchemaMapping{
				{
					SourceID:   "orders",
					Name:       "order_id",
					ColumnName: "order_id",
					ColumnType: "String",
				},
				{
					SourceID:   "orders",
					Name:       "amount",
					ColumnName: "amount",
					ColumnType: "Float64",
				},
				{
					SourceID:   "customers",
					Name:       "name",
					ColumnName: "customer_name",
					ColumnType: "String",
				},
			},
		},
	}

	builder := NewSchemaConfigBuilder(pipeline)
	schemaConfig, mapping, err := builder.Build()

	require.NoError(t, err)

	// Verify all schemas created
	assert.Equal(t, 2, len(schemaConfig.Schemas)) // orders + customers

	// Verify mapping type is many_to_one (join)
	assert.Equal(t, "many_to_one", mapping.Type)

	// Verify all mappings present
	assert.Equal(t, 3, len(mapping.Fields))
}
