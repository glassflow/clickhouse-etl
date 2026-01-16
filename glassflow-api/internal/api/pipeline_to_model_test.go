package api

import (
	"testing"
	"time"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPipelineJSON_ToModel_BasicConfig(t *testing.T) {
	// Test case 1: Basic config with SchemaFields, SchemaVersion, SourceID, and TableMapping
	pipelineJSON := pipelineJSON{
		PipelineID: "test-pipeline-1",
		Name:       "Test Pipeline",
		Source: pipelineSource{
			Kind:     internal.KafkaIngestorType,
			Provider: "confluent",
			ConnectionParams: sourceConnectionParams{
				Brokers:       []string{"localhost:9092"},
				SASLProtocol:  "SASL_PLAINTEXT",
				SASLMechanism: "PLAIN",
				SASLUsername:  "user",
				SASLPassword:  "password",
			},
			Topics: []kafkaTopic{
				{
					Topic:                      "users",
					ConsumerGroupInitialOffset: "earliest",
					Replicas:                   1,
					Deduplication: topicDedupConfig{
						Enabled: true,
						ID:      "event_id",
						Type:    "string",
						Window:  *models.NewJSONDuration(1 * time.Hour),
					},
					SchemaVersion: "1101",
					SchemaFields: []models.Field{
						{Name: "event_id", Type: "string"},
						{Name: "user_id", Type: "string"},
						{Name: "name", Type: "string"},
					},
				},
			},
		},
		Sink: clickhouseSink{
			Kind:         internal.ClickHouseSinkType,
			Host:         "localhost",
			Port:         "9000",
			HttpPort:     "8123",
			Database:     "default",
			Username:     "default",
			Password:     "password",
			Table:        "users_table",
			Secure:       false,
			MaxBatchSize: 1000,
			MaxDelayTime: *models.NewJSONDuration(60 * time.Second),
			SourceID:     "users",
			TableMapping: []tableMappingEntry{
				{
					Name:       "user_id",
					ColumnName: "user_id",
					ColumnType: "UUID",
				},
				{
					Name:       "name",
					ColumnName: "name",
					ColumnType: "String",
				},
			},
		},
		Join: pipelineJoin{
			Enabled: false,
		},
		Filter: pipelineFilter{
			Enabled: false,
		},
		StatelessTransformation: models.StatelessTransformation{
			Enabled: false,
		},
		Metadata: models.PipelineMetadata{
			Tags: []string{"test"},
		},
	}

	result, err := pipelineJSON.toModel()
	require.NoError(t, err)

	// Verify basic fields
	assert.Equal(t, "test-pipeline-1", result.ID)
	assert.Equal(t, "Test Pipeline", result.Name)

	// Verify SchemaVersions were created
	require.Len(t, result.SchemaVersions, 1)

	// Verify source schema version
	sourceSchema := result.SchemaVersions[pipelineJSON.Source.Topics[0].Topic]
	assert.Equal(t, "users", sourceSchema.SourceID)
	assert.Equal(t, "1101", sourceSchema.VersionID)
	require.Len(t, sourceSchema.Fields, 3)
	assert.Equal(t, "event_id", sourceSchema.Fields[0].Name)
	assert.Equal(t, "user_id", sourceSchema.Fields[1].Name)
	assert.Equal(t, "name", sourceSchema.Fields[2].Name)

	// Verify Ingestor component config
	assert.Equal(t, internal.KafkaIngestorType, result.Ingestor.Type)
	assert.Equal(t, "confluent", result.Ingestor.Provider)
	require.Len(t, result.Ingestor.KafkaTopics, 1)

	topic := result.Ingestor.KafkaTopics[0]
	assert.Equal(t, "users", topic.Name)
	assert.Equal(t, "earliest", topic.ConsumerGroupInitialOffset)
	assert.Equal(t, 1, topic.Replicas)
	assert.True(t, topic.Deduplication.Enabled)
	assert.Equal(t, "event_id", topic.Deduplication.ID)
	assert.Equal(t, "string", topic.Deduplication.Type)
	assert.Equal(t, 1*time.Hour, topic.Deduplication.Window.Duration())

	// Verify Sink component config
	assert.Equal(t, internal.ClickHouseSinkType, result.Sink.Type)
	assert.Equal(t, "users", result.Sink.SourceID)
	assert.Equal(t, "localhost", result.Sink.ClickHouseConnectionParams.Host)
	assert.Equal(t, "9000", result.Sink.ClickHouseConnectionParams.Port)
	assert.Equal(t, "users_table", result.Sink.ClickHouseConnectionParams.Table)

	// Verify sink mappings
	require.Len(t, result.Sink.Config, 2)
	assert.Equal(t, "user_id", result.Sink.Config[0].SourceField)
	assert.Equal(t, "string", result.Sink.Config[0].SourceType)
	assert.Equal(t, "user_id", result.Sink.Config[0].DestinationField)
	assert.Equal(t, "UUID", result.Sink.Config[0].DestinationType)

	assert.Equal(t, "name", result.Sink.Config[1].SourceField)
	assert.Equal(t, "string", result.Sink.Config[1].SourceType)
	assert.Equal(t, "name", result.Sink.Config[1].DestinationField)
	assert.Equal(t, "String", result.Sink.Config[1].DestinationType)

	// Verify Join is disabled
	assert.False(t, result.Join.Enabled)

	// Verify Filter is disabled
	assert.False(t, result.Filter.Enabled)

	// Verify StatelessTransformation is disabled
	assert.False(t, result.StatelessTransformation.Enabled)
}

func TestPipelineJSON_ToModel_WithSchemaRegistry(t *testing.T) {
	// Test case 2: Config with SchemaRegistry in topics
	pipelineJSON := pipelineJSON{
		PipelineID: "test-pipeline-2",
		Name:       "Test Pipeline with Schema Registry",
		Source: pipelineSource{
			Kind:     internal.KafkaIngestorType,
			Provider: "confluent",
			ConnectionParams: sourceConnectionParams{
				Brokers:       []string{"localhost:9092"},
				SASLProtocol:  "SASL_PLAINTEXT",
				SASLMechanism: "PLAIN",
				SASLUsername:  "user",
				SASLPassword:  "password",
			},
			Topics: []kafkaTopic{
				{
					Topic:                      "events",
					ConsumerGroupInitialOffset: "latest",
					Replicas:                   3,
					Deduplication: topicDedupConfig{
						Enabled: false,
					},
					SchemaRegistry: models.SchemaRegistryConfig{
						URL:       "http://schema-registry:8081",
						APIKey:    "api-key",
						APISecret: "api-secret",
					},
					SchemaVersion: "2001",
					SchemaFields: []models.Field{
						{Name: "event_id", Type: "string"},
						{Name: "timestamp", Type: "int64"},
					},
				},
			},
		},
		Sink: clickhouseSink{
			Kind:         internal.ClickHouseSinkType,
			Host:         "localhost",
			Port:         "9000",
			HttpPort:     "8123",
			Database:     "default",
			Username:     "default",
			Password:     "password",
			Table:        "events_table",
			Secure:       true,
			MaxBatchSize: 500,
			MaxDelayTime: *models.NewJSONDuration(30 * time.Second),
			SourceID:     "events",
			TableMapping: []tableMappingEntry{
				{
					Name:       "event_id",
					ColumnName: "id",
					ColumnType: "String",
				},
			},
		},
		Schema: schema{
			Fields: []schemaField{},
		},
		Join: pipelineJoin{
			Enabled: false,
		},
		Filter: pipelineFilter{
			Enabled: false,
		},
		StatelessTransformation: models.StatelessTransformation{
			Enabled: false,
		},
	}

	result, err := pipelineJSON.toModel()
	require.NoError(t, err)

	// Verify SchemaVersions were created
	require.Len(t, result.SchemaVersions, 1)

	sourceSchema := result.SchemaVersions[pipelineJSON.Source.Topics[0].Topic]
	assert.Equal(t, "events", sourceSchema.SourceID)
	assert.Equal(t, "2001", sourceSchema.VersionID)
	require.Len(t, sourceSchema.Fields, 2)

	// Verify Ingestor has SchemaRegistry config
	topic := result.Ingestor.KafkaTopics[0]
	assert.Equal(t, "http://schema-registry:8081", topic.SchemaRegistryConfig.URL)
	assert.Equal(t, "api-key", topic.SchemaRegistryConfig.APIKey)
	assert.Equal(t, "api-secret", topic.SchemaRegistryConfig.APISecret)

	// Verify topic settings
	assert.Equal(t, "events", topic.Name)
	assert.Equal(t, "latest", topic.ConsumerGroupInitialOffset)
	assert.Equal(t, 3, topic.Replicas)
	assert.False(t, topic.Deduplication.Enabled)

	// Verify Sink config
	assert.True(t, result.Sink.ClickHouseConnectionParams.Secure)
	assert.Equal(t, 500, result.Sink.Batch.MaxBatchSize)
	assert.Equal(t, 30*time.Second, result.Sink.Batch.MaxDelayTime.Duration())
}

func TestPipelineJSON_ToModel_WithStatelessTransformation(t *testing.T) {
	// Test case 3: Config with enabled StatelessTransformation
	pipelineJSON := pipelineJSON{
		PipelineID: "test-pipeline-3",
		Name:       "Test Pipeline with Transformation",
		Source: pipelineSource{
			Kind:     internal.KafkaIngestorType,
			Provider: "confluent",
			ConnectionParams: sourceConnectionParams{
				Brokers:       []string{"localhost:9092"},
				SASLProtocol:  "SASL_PLAINTEXT",
				SASLMechanism: "PLAIN",
				SASLUsername:  "user",
				SASLPassword:  "password",
			},
			Topics: []kafkaTopic{
				{
					Topic:                      "users",
					ConsumerGroupInitialOffset: "earliest",
					Replicas:                   1,
					Deduplication: topicDedupConfig{
						Enabled: true,
						ID:      "event_id",
						Type:    "string",
						Window:  *models.NewJSONDuration(1 * time.Hour),
					},
					SchemaVersion: "1101",
					SchemaFields: []models.Field{
						{Name: "event_id", Type: "string"},
						{Name: "user_id", Type: "string"},
						{Name: "name", Type: "string"},
					},
				},
			},
		},
		StatelessTransformation: models.StatelessTransformation{
			ID:       "transform-1",
			Type:     "expr_lang_transform",
			Enabled:  true,
			SourceID: "users",
			Config: models.StatelessTransformationsConfig{
				Transform: []models.Transform{
					{
						Expression: "user_id",
						OutputName: "user_id",
						OutputType: "string",
					},
					{
						Expression: "upper(name)",
						OutputName: "name_upper",
						OutputType: "string",
					},
					{
						Expression: "event_id",
						OutputName: "event_id",
						OutputType: "string",
					},
				},
			},
		},
		Sink: clickhouseSink{
			Kind:         internal.ClickHouseSinkType,
			Host:         "localhost",
			Port:         "9000",
			HttpPort:     "8123",
			Database:     "default",
			Username:     "default",
			Password:     "password",
			Table:        "transformed_users",
			Secure:       false,
			MaxBatchSize: 1000,
			MaxDelayTime: *models.NewJSONDuration(60 * time.Second),
			SourceID:     "transform-1",
			TableMapping: []tableMappingEntry{
				{
					Name:       "user_id",
					ColumnName: "user_id",
					ColumnType: "UUID",
				},
				{
					Name:       "name_upper",
					ColumnName: "name",
					ColumnType: "String",
				},
			},
		},
		Join: pipelineJoin{
			Enabled: false,
		},
		Filter: pipelineFilter{
			Enabled: false,
		},
	}

	result, err := pipelineJSON.toModel()
	require.NoError(t, err)

	// Verify SchemaVersions were created - both source and transformation
	require.Len(t, result.SchemaVersions, 2)

	// Verify source schema version
	sourceSchema, found := result.SchemaVersions["users"]
	require.True(t, found)
	assert.Equal(t, "1101", sourceSchema.VersionID)
	require.Len(t, sourceSchema.Fields, 3)
	assert.Equal(t, "event_id", sourceSchema.Fields[0].Name)
	assert.Equal(t, "user_id", sourceSchema.Fields[1].Name)
	assert.Equal(t, "name", sourceSchema.Fields[2].Name)

	// Verify transformation schema version
	transformSchema, found := result.SchemaVersions["transform-1"]
	require.True(t, found)
	require.Len(t, transformSchema.Fields, 3)
	assert.Equal(t, "user_id", transformSchema.Fields[0].Name)
	assert.Equal(t, "name_upper", transformSchema.Fields[1].Name)
	assert.Equal(t, "event_id", transformSchema.Fields[2].Name)

	// Verify StatelessTransformation component config
	assert.True(t, result.StatelessTransformation.Enabled)
	assert.Equal(t, "transform-1", result.StatelessTransformation.ID)
	assert.Equal(t, "expr_lang_transform", result.StatelessTransformation.Type)
	assert.Equal(t, "users", result.StatelessTransformation.SourceID)

	require.Len(t, result.StatelessTransformation.Config.Transform, 3)
	assert.Equal(t, "user_id", result.StatelessTransformation.Config.Transform[0].Expression)
	assert.Equal(t, "user_id", result.StatelessTransformation.Config.Transform[0].OutputName)
	assert.Equal(t, "string", result.StatelessTransformation.Config.Transform[0].OutputType)

	assert.Equal(t, "upper(name)", result.StatelessTransformation.Config.Transform[1].Expression)
	assert.Equal(t, "name_upper", result.StatelessTransformation.Config.Transform[1].OutputName)
	assert.Equal(t, "string", result.StatelessTransformation.Config.Transform[1].OutputType)

	// Verify Sink uses transformation output
	assert.Equal(t, "transform-1", result.Sink.SourceID)
	require.Len(t, result.Sink.Config, 2)
	assert.Equal(t, "user_id", result.Sink.Config[0].SourceField)
	assert.Equal(t, "string", result.Sink.Config[0].SourceType)
	assert.Equal(t, "name_upper", result.Sink.Config[1].SourceField)
	assert.Equal(t, "string", result.Sink.Config[1].SourceType)
}

func TestPipelineJSON_ToModel_WithJoin(t *testing.T) {
	// Test case 4: Config with enabled Join
	pipelineJSON := pipelineJSON{
		PipelineID: "test-pipeline-4",
		Name:       "Test Pipeline with Join",
		Source: pipelineSource{
			Kind:     internal.KafkaIngestorType,
			Provider: "confluent",
			ConnectionParams: sourceConnectionParams{
				Brokers:       []string{"localhost:9092"},
				SASLProtocol:  "SASL_PLAINTEXT",
				SASLMechanism: "PLAIN",
				SASLUsername:  "user",
				SASLPassword:  "password",
			},
			Topics: []kafkaTopic{
				{
					Topic:                      "users",
					ConsumerGroupInitialOffset: "earliest",
					Replicas:                   1,
					Deduplication: topicDedupConfig{
						Enabled: true,
						ID:      "event_id",
						Type:    "string",
						Window:  *models.NewJSONDuration(24 * time.Hour),
					},
					SchemaVersion: "1101",
					SchemaFields: []models.Field{
						{Name: "event_id", Type: "string"},
						{Name: "user_id", Type: "string"},
						{Name: "name", Type: "string"},
					},
				},
				{
					Topic:                      "events",
					ConsumerGroupInitialOffset: "earliest",
					Replicas:                   1,
					Deduplication: topicDedupConfig{
						Enabled: true,
						ID:      "event_id",
						Type:    "string",
						Window:  *models.NewJSONDuration(1 * time.Hour),
					},
					SchemaVersion: "2001",
					SchemaFields: []models.Field{
						{Name: "event_id", Type: "string"},
						{Name: "name", Type: "string"},
					},
				},
			},
		},
		Join: pipelineJoin{
			ID:      "join-1",
			Kind:    internal.TemporalJoinType,
			Enabled: true,
			Sources: []joinSource{
				{
					SourceID:    "events",
					JoinKey:     "event_id",
					Window:      *models.NewJSONDuration(1 * time.Hour),
					Orientation: internal.JoinLeft,
				},
				{
					SourceID:    "users",
					JoinKey:     "event_id",
					Window:      *models.NewJSONDuration(24 * time.Hour),
					Orientation: internal.JoinRight,
				},
			},
			Rules: []models.JoinRule{
				{
					SourceID:   "events",
					SourceName: "name",
					OutputName: "event_name",
				},
				{
					SourceID:   "users",
					SourceName: "name",
					OutputName: "user_name",
				},
				{
					SourceID:   "users",
					SourceName: "user_id",
					OutputName: "user_id",
				},
			},
		},
		Sink: clickhouseSink{
			Kind:         internal.ClickHouseSinkType,
			Host:         "localhost",
			Port:         "9000",
			HttpPort:     "8123",
			Database:     "default",
			Username:     "default",
			Password:     "password",
			Table:        "joined_table",
			Secure:       false,
			MaxBatchSize: 1000,
			MaxDelayTime: *models.NewJSONDuration(60 * time.Second),
			SourceID:     "join-1",
			TableMapping: []tableMappingEntry{
				{
					Name:       "user_id",
					ColumnName: "user_id",
					ColumnType: "UUID",
				},
				{
					Name:       "user_name",
					ColumnName: "name",
					ColumnType: "String",
				},
				{
					Name:       "event_name",
					ColumnName: "event",
					ColumnType: "String",
				},
			},
		},
		Filter: pipelineFilter{
			Enabled: false,
		},
		StatelessTransformation: models.StatelessTransformation{
			Enabled: false,
		},
	}

	result, err := pipelineJSON.toModel()
	require.NoError(t, err)

	// Verify SchemaVersions were created - all three sources (users, events, join)
	require.Len(t, result.SchemaVersions, 3)

	// Verify users schema version
	usersSchema, found := result.SchemaVersions["users"]
	require.True(t, found)
	assert.Equal(t, "1101", usersSchema.VersionID)
	require.Len(t, usersSchema.Fields, 3)
	assert.Equal(t, "event_id", usersSchema.Fields[0].Name)
	assert.Equal(t, "user_id", usersSchema.Fields[1].Name)
	assert.Equal(t, "name", usersSchema.Fields[2].Name)

	// Verify events schema version
	eventsSchema, found := result.SchemaVersions["events"]
	require.True(t, found)
	assert.Equal(t, "2001", eventsSchema.VersionID)
	require.Len(t, eventsSchema.Fields, 2)
	assert.Equal(t, "event_id", eventsSchema.Fields[0].Name)
	assert.Equal(t, "name", eventsSchema.Fields[1].Name)

	// Verify join schema version
	joinSchema, found := result.SchemaVersions["join-1"]
	require.True(t, found)
	require.Len(t, joinSchema.Fields, 3)
	assert.Equal(t, "event_name", joinSchema.Fields[0].Name)
	assert.Equal(t, "string", joinSchema.Fields[0].Type)
	assert.Equal(t, "user_name", joinSchema.Fields[1].Name)
	assert.Equal(t, "string", joinSchema.Fields[1].Type)
	assert.Equal(t, "user_id", joinSchema.Fields[2].Name)
	assert.Equal(t, "string", joinSchema.Fields[2].Type)

	// Verify Ingestor has both topics
	require.Len(t, result.Ingestor.KafkaTopics, 2)

	var usersTopic, eventsTopic *models.KafkaTopicsConfig
	for i := range result.Ingestor.KafkaTopics {
		switch result.Ingestor.KafkaTopics[i].Name {
		case "users":
			usersTopic = &result.Ingestor.KafkaTopics[i]
		case "events":
			eventsTopic = &result.Ingestor.KafkaTopics[i]
		}
	}

	require.NotNil(t, usersTopic)
	require.NotNil(t, eventsTopic)

	assert.Equal(t, "users", usersTopic.Name)
	assert.True(t, usersTopic.Deduplication.Enabled)
	assert.Equal(t, "event_id", usersTopic.Deduplication.ID)
	assert.Equal(t, 24*time.Hour, usersTopic.Deduplication.Window.Duration())

	assert.Equal(t, "events", eventsTopic.Name)
	assert.True(t, eventsTopic.Deduplication.Enabled)
	assert.Equal(t, "event_id", eventsTopic.Deduplication.ID)
	assert.Equal(t, 1*time.Hour, eventsTopic.Deduplication.Window.Duration())

	// Verify Join component config
	assert.Equal(t, "join-1", result.Join.ID)
	assert.True(t, result.Join.Enabled)
	assert.Equal(t, internal.TemporalJoinType, result.Join.Type)
	require.Len(t, result.Join.Sources, 2)

	// Find left and right sources
	var leftSource, rightSource *models.JoinSourceConfig
	for i := range result.Join.Sources {
		switch result.Join.Sources[i].Orientation {
		case internal.JoinLeft:
			leftSource = &result.Join.Sources[i]
		case internal.JoinRight:
			rightSource = &result.Join.Sources[i]
		}
	}

	require.NotNil(t, leftSource)
	require.NotNil(t, rightSource)

	assert.Equal(t, "events", leftSource.SourceID)
	assert.Equal(t, "event_id", leftSource.JoinKey)
	assert.Equal(t, 1*time.Hour, leftSource.Window.Duration())

	assert.Equal(t, "users", rightSource.SourceID)
	assert.Equal(t, "event_id", rightSource.JoinKey)
	assert.Equal(t, 24*time.Hour, rightSource.Window.Duration())

	// Verify join rules
	require.Len(t, result.Join.Config, 3)
	assert.Equal(t, "events", result.Join.Config[0].SourceID)
	assert.Equal(t, "name", result.Join.Config[0].SourceName)
	assert.Equal(t, "event_name", result.Join.Config[0].OutputName)

	assert.Equal(t, "users", result.Join.Config[1].SourceID)
	assert.Equal(t, "name", result.Join.Config[1].SourceName)
	assert.Equal(t, "user_name", result.Join.Config[1].OutputName)

	assert.Equal(t, "users", result.Join.Config[2].SourceID)
	assert.Equal(t, "user_id", result.Join.Config[2].SourceName)
	assert.Equal(t, "user_id", result.Join.Config[2].OutputName)

	// Verify join buffer TTLs
	assert.Equal(t, 1*time.Hour, result.Join.LeftBufferTTL.Duration())
	assert.Equal(t, 24*time.Hour, result.Join.RightBufferTTL.Duration())

	// Verify Sink uses join output
	assert.Equal(t, "join-1", result.Sink.SourceID)
	require.Len(t, result.Sink.Config, 3)

	assert.Equal(t, "user_id", result.Sink.Config[0].SourceField)
	assert.Equal(t, "string", result.Sink.Config[0].SourceType)
	assert.Equal(t, "user_id", result.Sink.Config[0].DestinationField)
	assert.Equal(t, "UUID", result.Sink.Config[0].DestinationType)

	assert.Equal(t, "user_name", result.Sink.Config[1].SourceField)
	assert.Equal(t, "string", result.Sink.Config[1].SourceType)
	assert.Equal(t, "name", result.Sink.Config[1].DestinationField)
	assert.Equal(t, "String", result.Sink.Config[1].DestinationType)

	assert.Equal(t, "event_name", result.Sink.Config[2].SourceField)
	assert.Equal(t, "string", result.Sink.Config[2].SourceType)
	assert.Equal(t, "event", result.Sink.Config[2].DestinationField)
	assert.Equal(t, "String", result.Sink.Config[2].DestinationType)
}

func TestPipelineJSON_ToModel_ValidationErrors(t *testing.T) {
	t.Run("empty pipeline ID", func(t *testing.T) {
		pipelineJSON := pipelineJSON{
			PipelineID: "",
		}
		_, err := pipelineJSON.toModel()
		require.Error(t, err)
		assert.Contains(t, err.Error(), "pipeline ID cannot be empty")
	})

	t.Run("missing sink source_id in schema", func(t *testing.T) {
		pipelineJSON := pipelineJSON{
			PipelineID: "test",
			Source: pipelineSource{
				Kind:     internal.KafkaIngestorType,
				Provider: "confluent",
				ConnectionParams: sourceConnectionParams{
					Brokers:       []string{"localhost:9092"},
					SASLProtocol:  "SASL_PLAINTEXT",
					SASLMechanism: "PLAIN",
					SASLUsername:  "user",
					SASLPassword:  "password",
				},
				Topics: []kafkaTopic{
					{
						Topic:        "test",
						SchemaFields: []models.Field{{Name: "id", Type: "string"}},
					},
				},
			},
			Sink: clickhouseSink{
				Host:         "localhost",
				Port:         "9000",
				HttpPort:     "8123",
				Database:     "default",
				Username:     "default",
				Password:     "password",
				Table:        "test",
				MaxBatchSize: 1000,
				MaxDelayTime: *models.NewJSONDuration(60 * time.Second),
				SourceID:     "nonexistent",
				TableMapping: []tableMappingEntry{
					{Name: "id", ColumnName: "id", ColumnType: "String"},
				},
			},
			Schema: schema{
				Fields: []schemaField{
					{SourceID: "test", Name: "id", Type: "string", ColumnName: "id", ColumnType: "String"},
				},
			},
			Join:   pipelineJoin{Enabled: false},
			Filter: pipelineFilter{Enabled: false},
		}
		_, err := pipelineJSON.toModel()
		require.Error(t, err)
		assert.Contains(t, err.Error(), "schema version for sink source_id 'nonexistent' not found")
	})

	t.Run("mapping field not in schema", func(t *testing.T) {
		pipelineJSON := pipelineJSON{
			PipelineID: "test",
			Source: pipelineSource{
				Kind:     internal.KafkaIngestorType,
				Provider: "confluent",
				ConnectionParams: sourceConnectionParams{
					Brokers:       []string{"localhost:9092"},
					SASLProtocol:  "SASL_PLAINTEXT",
					SASLMechanism: "PLAIN",
					SASLUsername:  "user",
					SASLPassword:  "password",
				},
				Topics: []kafkaTopic{
					{
						Topic:         "test",
						SchemaVersion: "1",
						SchemaFields:  []models.Field{{Name: "id", Type: "string"}},
					},
				},
			},
			Sink: clickhouseSink{
				Host:         "localhost",
				Port:         "9000",
				HttpPort:     "8123",
				Database:     "default",
				Username:     "default",
				Password:     "password",
				Table:        "test",
				MaxBatchSize: 1000,
				MaxDelayTime: *models.NewJSONDuration(60 * time.Second),
				SourceID:     "test",
				TableMapping: []tableMappingEntry{
					{Name: "nonexistent", ColumnName: "id", ColumnType: "String"},
				},
			},
			Schema: schema{
				Fields: []schemaField{
					{SourceID: "test", Name: "id", Type: "string", ColumnName: "id", ColumnType: "String"},
				},
			},
			Join:   pipelineJoin{Enabled: false},
			Filter: pipelineFilter{Enabled: false},
		}
		_, err := pipelineJSON.toModel()
		require.Error(t, err)
		assert.Contains(t, err.Error(), "mapping field 'nonexistent' not found in schema")
	})
}
