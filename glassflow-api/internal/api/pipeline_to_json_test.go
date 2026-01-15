package api

import (
	"testing"
	"time"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestToPipelineJSON_BasicConfig(t *testing.T) {
	// Test case 1: Basic config with SchemaFields, SchemaVersion, SourceID, and TableMapping
	pipelineConfig := models.PipelineConfig{
		ID:   "test-pipeline-1",
		Name: "Test Pipeline",
		Ingestor: models.IngestorComponentConfig{
			Type:     internal.KafkaIngestorType,
			Provider: "confluent",
			KafkaConnectionParams: models.KafkaConnectionParamsConfig{
				Brokers:       []string{"localhost:9092"},
				SASLProtocol:  "SASL_PLAINTEXT",
				SASLMechanism: "PLAIN",
				SASLUsername:  "user",
				SASLPassword:  "password",
			},
			KafkaTopics: []models.KafkaTopicsConfig{
				{
					Name:                       "users",
					ConsumerGroupInitialOffset: "earliest",
					Replicas:                   1,
					Deduplication: models.DeduplicationConfig{
						Enabled: true,
						ID:      "event_id",
						Type:    "string",
						Window:  *models.NewJSONDuration(1 * time.Hour),
					},
					OutputStreamID:      "stream-1",
					OutputStreamSubject: "subject-1",
				},
			},
		},
		Sink: models.SinkComponentConfig{
			Type:     internal.ClickHouseSinkType,
			StreamID: "stream-1",
			SourceID: "users",
			Batch: models.BatchConfig{
				MaxBatchSize: 1000,
				MaxDelayTime: *models.NewJSONDuration(60 * time.Second),
			},
			ClickHouseConnectionParams: models.ClickHouseConnectionParamsConfig{
				Host:     "localhost",
				Port:     "9000",
				HttpPort: "8123",
				Database: "default",
				Username: "default",
				Password: "password",
				Table:    "users_table",
				Secure:   false,
			},
			Config: []models.Mapping{
				{
					SourceField:      "user_id",
					SourceType:       "string",
					DestinationField: "user_id",
					DestinationType:  "UUID",
				},
				{
					SourceField:      "name",
					SourceType:       "string",
					DestinationField: "name",
					DestinationType:  "String",
				},
			},
		},
		Join: models.JoinComponentConfig{
			Enabled: false,
		},
		Filter: models.FilterComponentConfig{
			Enabled: false,
		},
		StatelessTransformation: models.StatelessTransformation{
			Enabled: false,
		},
		SchemaVersions: []models.SchemaVersion{
			{
				SourceID:  "users",
				VersionID: "1101",
				DataType:  models.SchemaDataFormatJSON,
				Fields: []models.Field{
					{Name: "event_id", Type: "string"},
					{Name: "user_id", Type: "string"},
					{Name: "name", Type: "string"},
				},
			},
		},
		Metadata: models.PipelineMetadata{
			Tags: []string{"test"},
		},
	}

	result := toPipelineJSON(pipelineConfig)

	// Verify basic fields
	assert.Equal(t, "test-pipeline-1", result.PipelineID)
	assert.Equal(t, "Test Pipeline", result.Name)
	assert.Equal(t, "v2", result.Version)

	// Verify source configuration
	assert.Equal(t, internal.KafkaIngestorType, result.Source.Kind)
	assert.Equal(t, "confluent", result.Source.Provider)
	assert.Len(t, result.Source.Topics, 1)

	// Verify topic has SchemaVersion and SchemaFields
	topic := result.Source.Topics[0]
	assert.Equal(t, "users", topic.Topic)
	assert.Equal(t, "1101", topic.SchemaVersion)
	assert.Len(t, topic.SchemaFields, 3)
	assert.Equal(t, "event_id", topic.SchemaFields[0].Name)
	assert.Equal(t, "user_id", topic.SchemaFields[1].Name)
	assert.Equal(t, "name", topic.SchemaFields[2].Name)

	// Verify deduplication
	assert.True(t, topic.Deduplication.Enabled)
	assert.Equal(t, "event_id", topic.Deduplication.ID)

	// Verify sink has SourceID and TableMapping
	assert.Equal(t, "users", result.Sink.SourceID)
	assert.Len(t, result.Sink.TableMapping, 2)
	assert.Equal(t, "user_id", result.Sink.TableMapping[0].Name)
	assert.Equal(t, "user_id", result.Sink.TableMapping[0].ColumnName)
	assert.Equal(t, "UUID", result.Sink.TableMapping[0].ColumnType)
}

func TestToPipelineJSON_WithSchemaRegistry(t *testing.T) {
	// Test case 2: Config with SchemaRegistry in topics
	pipelineConfig := models.PipelineConfig{
		ID:   "test-pipeline-2",
		Name: "Test Pipeline with Schema Registry",
		Ingestor: models.IngestorComponentConfig{
			Type:     internal.KafkaIngestorType,
			Provider: "confluent",
			KafkaConnectionParams: models.KafkaConnectionParamsConfig{
				Brokers:       []string{"localhost:9092"},
				SASLProtocol:  "SASL_PLAINTEXT",
				SASLMechanism: "PLAIN",
				SASLUsername:  "user",
				SASLPassword:  "password",
			},
			KafkaTopics: []models.KafkaTopicsConfig{
				{
					Name:                       "events",
					ConsumerGroupInitialOffset: "latest",
					Replicas:                   3,
					SchemaRegistryConfig: models.SchemaRegistryConfig{
						URL:       "http://schema-registry:8081",
						APIKey:    "api-key",
						APISecret: "api-secret",
					},
					Deduplication: models.DeduplicationConfig{
						Enabled: false,
					},
					OutputStreamID:      "stream-2",
					OutputStreamSubject: "subject-2",
				},
			},
		},
		Sink: models.SinkComponentConfig{
			Type:     internal.ClickHouseSinkType,
			StreamID: "stream-2",
			SourceID: "events",
			Batch: models.BatchConfig{
				MaxBatchSize: 500,
				MaxDelayTime: *models.NewJSONDuration(30 * time.Second),
			},
			ClickHouseConnectionParams: models.ClickHouseConnectionParamsConfig{
				Host:     "localhost",
				Port:     "9000",
				HttpPort: "8123",
				Database: "default",
				Username: "default",
				Password: "password",
				Table:    "events_table",
				Secure:   true,
			},
			Config: []models.Mapping{
				{
					SourceField:      "event_id",
					SourceType:       "string",
					DestinationField: "id",
					DestinationType:  "String",
				},
			},
		},
		Mapper: models.MapperConfig{
			Type: internal.SchemaMapperJSONToCHType,
			Streams: map[string]models.StreamSchemaConfig{
				"events": {
					Fields: []models.StreamDataField{
						{FieldName: "event_id", FieldType: "string"},
						{FieldName: "timestamp", FieldType: "int64"},
					},
				},
			},
			SinkMapping: []models.SinkMappingConfig{
				{
					StreamName: "events",
					FieldName:  "event_id",
					ColumnName: "id",
					ColumnType: "String",
				},
			},
		},
		Join: models.JoinComponentConfig{
			Enabled: false,
		},
		Filter: models.FilterComponentConfig{
			Enabled: false,
		},
		StatelessTransformation: models.StatelessTransformation{
			Enabled: false,
		},
		SchemaVersions: []models.SchemaVersion{
			{
				SourceID:  "events",
				VersionID: "2001",
				DataType:  models.SchemaDataFormatJSON,
				Fields: []models.Field{
					{Name: "event_id", Type: "string"},
					{Name: "timestamp", Type: "int64"},
				},
			},
		},
	}

	result := toPipelineJSON(pipelineConfig)

	// Verify SchemaRegistry configuration
	topic := result.Source.Topics[0]
	assert.Equal(t, "http://schema-registry:8081", topic.SchemaRegistry.URL)
	assert.Equal(t, "api-key", topic.SchemaRegistry.APIKey)
	assert.Equal(t, "api-secret", topic.SchemaRegistry.APISecret)

	// Verify schema version
	assert.Equal(t, "2001", topic.SchemaVersion)
	assert.Len(t, topic.SchemaFields, 2)
}

func TestToPipelineJSON_WithStatelessTransformation(t *testing.T) {
	// Test case 3: Config with enabled StatelessTransformation
	pipelineConfig := models.PipelineConfig{
		ID:   "test-pipeline-3",
		Name: "Test Pipeline with Transformation",
		Ingestor: models.IngestorComponentConfig{
			Type:     internal.KafkaIngestorType,
			Provider: "confluent",
			KafkaConnectionParams: models.KafkaConnectionParamsConfig{
				Brokers:       []string{"localhost:9092"},
				SASLProtocol:  "SASL_PLAINTEXT",
				SASLMechanism: "PLAIN",
				SASLUsername:  "user",
				SASLPassword:  "password",
			},
			KafkaTopics: []models.KafkaTopicsConfig{
				{
					Name:                       "users",
					ConsumerGroupInitialOffset: "earliest",
					Replicas:                   1,
					Deduplication: models.DeduplicationConfig{
						Enabled: true,
						ID:      "event_id",
						Type:    "string",
						Window:  *models.NewJSONDuration(1 * time.Hour),
					},
					OutputStreamID:      "stream-3",
					OutputStreamSubject: "subject-3",
				},
			},
		},
		Sink: models.SinkComponentConfig{
			Type:     internal.ClickHouseSinkType,
			StreamID: "transform-stream-1",
			SourceID: "transform-1",
			Batch: models.BatchConfig{
				MaxBatchSize: 1000,
				MaxDelayTime: *models.NewJSONDuration(60 * time.Second),
			},
			ClickHouseConnectionParams: models.ClickHouseConnectionParamsConfig{
				Host:     "localhost",
				Port:     "9000",
				HttpPort: "8123",
				Database: "default",
				Username: "default",
				Password: "password",
				Table:    "transformed_users",
				Secure:   false,
			},
			Config: []models.Mapping{
				{
					SourceField:      "user_id",
					SourceType:       "string",
					DestinationField: "user_id",
					DestinationType:  "UUID",
				},
				{
					SourceField:      "name_upper",
					SourceType:       "string",
					DestinationField: "name",
					DestinationType:  "String",
				},
			},
		},
		Mapper: models.MapperConfig{
			Type: internal.SchemaMapperJSONToCHType,
			Streams: map[string]models.StreamSchemaConfig{
				"users": {
					Fields: []models.StreamDataField{
						{FieldName: "user_id", FieldType: "string"},
						{FieldName: "name", FieldType: "string"},
						{FieldName: "event_id", FieldType: "string"},
					},
				},
				"transform-1": {
					Fields: []models.StreamDataField{
						{FieldName: "user_id", FieldType: "string"},
						{FieldName: "name_upper", FieldType: "string"},
						{FieldName: "event_id", FieldType: "string"},
					},
				},
			},
			SinkMapping: []models.SinkMappingConfig{
				{
					StreamName: "transform-1",
					FieldName:  "user_id",
					ColumnName: "user_id",
					ColumnType: "UUID",
				},
				{
					StreamName: "transform-1",
					FieldName:  "name_upper",
					ColumnName: "name",
					ColumnType: "String",
				},
			},
		},
		Join: models.JoinComponentConfig{
			Enabled: false,
		},
		Filter: models.FilterComponentConfig{
			Enabled: false,
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
		SchemaVersions: []models.SchemaVersion{
			{
				SourceID:  "users",
				VersionID: "1101",
				DataType:  models.SchemaDataFormatJSON,
				Fields: []models.Field{
					{Name: "event_id", Type: "string"},
					{Name: "user_id", Type: "string"},
					{Name: "name", Type: "string"},
				},
			},
			{
				SourceID:  "transform-1",
				VersionID: "1",
				DataType:  models.SchemaDataFormatJSON,
				Fields: []models.Field{
					{Name: "event_id", Type: "string"},
					{Name: "user_id", Type: "string"},
					{Name: "name_upper", Type: "string"},
				},
			},
		},
	}

	result := toPipelineJSON(pipelineConfig)

	// Verify StatelessTransformation is enabled
	assert.True(t, result.StatelessTransformation.Enabled)
	assert.Equal(t, "transform-1", result.StatelessTransformation.ID)
	assert.Equal(t, "expr_lang_transform", result.StatelessTransformation.Type)
	assert.Equal(t, "users", result.StatelessTransformation.SourceID)

	// Verify transformation config
	require.Len(t, result.StatelessTransformation.Config.Transform, 3)
	assert.Equal(t, "user_id", result.StatelessTransformation.Config.Transform[0].Expression)
	assert.Equal(t, "user_id", result.StatelessTransformation.Config.Transform[0].OutputName)
	assert.Equal(t, "string", result.StatelessTransformation.Config.Transform[0].OutputType)
	assert.Equal(t, "upper(name)", result.StatelessTransformation.Config.Transform[1].Expression)
	assert.Equal(t, "name_upper", result.StatelessTransformation.Config.Transform[1].OutputName)

	// Verify schema versions - both source and transformation
	assert.Len(t, pipelineConfig.SchemaVersions, 2)

	// Source schema
	sourceSchema, found := models.GetSchemaVersion(pipelineConfig.SchemaVersions, "users")
	require.True(t, found)
	assert.Equal(t, "1101", sourceSchema.VersionID)
	assert.Len(t, sourceSchema.Fields, 3)

	// Transformation schema
	transformSchema, found := models.GetSchemaVersion(pipelineConfig.SchemaVersions, "transform-1")
	require.True(t, found)
	assert.Equal(t, "1", transformSchema.VersionID)
	assert.Len(t, transformSchema.Fields, 3)

	// Verify sink configuration uses transformation output
	assert.Equal(t, "transform-1", result.Sink.SourceID)
	assert.Len(t, result.Sink.TableMapping, 2)
}

func TestToPipelineJSON_WithJoin(t *testing.T) {
	// Test case 4: Config with enabled Join
	pipelineConfig := models.PipelineConfig{
		ID:   "test-pipeline-4",
		Name: "Test Pipeline with Join",
		Ingestor: models.IngestorComponentConfig{
			Type:     internal.KafkaIngestorType,
			Provider: "confluent",
			KafkaConnectionParams: models.KafkaConnectionParamsConfig{
				Brokers:       []string{"localhost:9092"},
				SASLProtocol:  "SASL_PLAINTEXT",
				SASLMechanism: "PLAIN",
				SASLUsername:  "user",
				SASLPassword:  "password",
			},
			KafkaTopics: []models.KafkaTopicsConfig{
				{
					Name:                       "users",
					ConsumerGroupInitialOffset: "earliest",
					Replicas:                   1,
					Deduplication: models.DeduplicationConfig{
						Enabled: true,
						ID:      "event_id",
						Type:    "string",
						Window:  *models.NewJSONDuration(24 * time.Hour),
					},
					OutputStreamID:      "stream-users",
					OutputStreamSubject: "subject-users",
				},
				{
					Name:                       "events",
					ConsumerGroupInitialOffset: "earliest",
					Replicas:                   1,
					Deduplication: models.DeduplicationConfig{
						Enabled: true,
						ID:      "event_id",
						Type:    "string",
						Window:  *models.NewJSONDuration(1 * time.Hour),
					},
					OutputStreamID:      "stream-events",
					OutputStreamSubject: "subject-events",
				},
			},
		},
		Join: models.JoinComponentConfig{
			Type:    internal.TemporalJoinType,
			Enabled: true,
			Sources: []models.JoinSourceConfig{
				{
					SourceID:    "events",
					StreamID:    "stream-events-dedup",
					JoinKey:     "event_id",
					Window:      *models.NewJSONDuration(1 * time.Hour),
					Orientation: internal.JoinLeft,
				},
				{
					SourceID:    "users",
					StreamID:    "stream-users-dedup",
					JoinKey:     "event_id",
					Window:      *models.NewJSONDuration(24 * time.Hour),
					Orientation: internal.JoinRight,
				},
			},
			OutputStreamID:        "joined-stream",
			NATSLeftConsumerName:  "left-consumer",
			NATSRightConsumerName: "right-consumer",
			LeftBufferTTL:         *models.NewJSONDuration(1 * time.Hour),
			RightBufferTTL:        *models.NewJSONDuration(24 * time.Hour),
			Config: []models.JoinRule{
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
		Sink: models.SinkComponentConfig{
			Type:     internal.ClickHouseSinkType,
			StreamID: "joined-stream",
			SourceID: "join-1",
			Batch: models.BatchConfig{
				MaxBatchSize: 1000,
				MaxDelayTime: *models.NewJSONDuration(60 * time.Second),
			},
			ClickHouseConnectionParams: models.ClickHouseConnectionParamsConfig{
				Host:     "localhost",
				Port:     "9000",
				HttpPort: "8123",
				Database: "default",
				Username: "default",
				Password: "password",
				Table:    "joined_table",
				Secure:   false,
			},
			Config: []models.Mapping{
				{
					SourceField:      "user_id",
					SourceType:       "string",
					DestinationField: "user_id",
					DestinationType:  "UUID",
				},
				{
					SourceField:      "user_name",
					SourceType:       "string",
					DestinationField: "name",
					DestinationType:  "String",
				},
				{
					SourceField:      "event_name",
					SourceType:       "string",
					DestinationField: "event",
					DestinationType:  "String",
				},
			},
		},
		Mapper: models.MapperConfig{
			Type: internal.SchemaMapperJSONToCHType,
			Streams: map[string]models.StreamSchemaConfig{
				"users": {
					Fields: []models.StreamDataField{
						{FieldName: "event_id", FieldType: "string"},
						{FieldName: "user_id", FieldType: "string"},
						{FieldName: "name", FieldType: "string"},
					},
					JoinKeyField: "event_id",
				},
				"events": {
					Fields: []models.StreamDataField{
						{FieldName: "event_id", FieldType: "string"},
						{FieldName: "name", FieldType: "string"},
					},
					JoinKeyField: "event_id",
				},
				"join-1": {
					Fields: []models.StreamDataField{
						{FieldName: "event_name", FieldType: "string"},
						{FieldName: "user_id", FieldType: "string"},
						{FieldName: "user_name", FieldType: "string"},
					},
				},
			},
			SinkMapping: []models.SinkMappingConfig{
				{
					StreamName: "join-1",
					FieldName:  "user_id",
					ColumnName: "user_id",
					ColumnType: "UUID",
				},
				{
					StreamName: "join-1",
					FieldName:  "user_name",
					ColumnName: "name",
					ColumnType: "String",
				},
				{
					StreamName: "join-1",
					FieldName:  "event_name",
					ColumnName: "event",
					ColumnType: "String",
				},
			},
		},
		Filter: models.FilterComponentConfig{
			Enabled: false,
		},
		StatelessTransformation: models.StatelessTransformation{
			Enabled: false,
		},
		SchemaVersions: []models.SchemaVersion{
			{
				SourceID:  "users",
				VersionID: "1101",
				DataType:  models.SchemaDataFormatJSON,
				Fields: []models.Field{
					{Name: "event_id", Type: "string"},
					{Name: "user_id", Type: "string"},
					{Name: "name", Type: "string"},
				},
			},
			{
				SourceID:  "events",
				VersionID: "2001",
				DataType:  models.SchemaDataFormatJSON,
				Fields: []models.Field{
					{Name: "event_id", Type: "string"},
					{Name: "name", Type: "string"},
				},
			},
			{
				SourceID:  "join-1",
				VersionID: "1",
				DataType:  models.SchemaDataFormatJSON,
				Fields: []models.Field{
					{Name: "event_name", Type: "string"},
					{Name: "user_id", Type: "string"},
					{Name: "user_name", Type: "string"},
				},
			},
		},
	}

	result := toPipelineJSON(pipelineConfig)

	// Verify Join is enabled
	assert.True(t, result.Join.Enabled)
	assert.Equal(t, internal.TemporalJoinType, result.Join.Kind)

	// Verify join sources
	require.Len(t, result.Join.Sources, 2)

	// Find left and right sources
	var leftSource, rightSource *joinSource
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
	require.Len(t, result.Join.Rules, 3)
	assert.Equal(t, "events", result.Join.Rules[0].SourceID)
	assert.Equal(t, "name", result.Join.Rules[0].SourceName)
	assert.Equal(t, "event_name", result.Join.Rules[0].OutputName)

	assert.Equal(t, "users", result.Join.Rules[1].SourceID)
	assert.Equal(t, "name", result.Join.Rules[1].SourceName)
	assert.Equal(t, "user_name", result.Join.Rules[1].OutputName)

	// Verify schema versions - all three sources
	assert.Len(t, pipelineConfig.SchemaVersions, 3)

	// Users schema
	usersSchema, found := models.GetSchemaVersion(pipelineConfig.SchemaVersions, "users")
	require.True(t, found)
	assert.Equal(t, "1101", usersSchema.VersionID)
	assert.Len(t, usersSchema.Fields, 3)

	// Events schema
	eventsSchema, found := models.GetSchemaVersion(pipelineConfig.SchemaVersions, "events")
	require.True(t, found)
	assert.Equal(t, "2001", eventsSchema.VersionID)
	assert.Len(t, eventsSchema.Fields, 2)

	// Join schema
	joinSchema, found := models.GetSchemaVersion(pipelineConfig.SchemaVersions, "join-1")
	require.True(t, found)
	assert.Equal(t, "1", joinSchema.VersionID)
	assert.Len(t, joinSchema.Fields, 3)

	// Verify topics have correct schema versions
	assert.Len(t, result.Source.Topics, 2)

	var usersTopic, eventsTopic *kafkaTopic
	for i := range result.Source.Topics {
		if result.Source.Topics[i].Topic == "users" {
			usersTopic = &result.Source.Topics[i]
		} else if result.Source.Topics[i].Topic == "events" {
			eventsTopic = &result.Source.Topics[i]
		}
	}

	require.NotNil(t, usersTopic)
	require.NotNil(t, eventsTopic)

	assert.Equal(t, "1101", usersTopic.SchemaVersion)
	assert.Len(t, usersTopic.SchemaFields, 3)

	assert.Equal(t, "2001", eventsTopic.SchemaVersion)
	assert.Len(t, eventsTopic.SchemaFields, 2)

	// Verify sink uses join output
	assert.Equal(t, "join-1", result.Sink.SourceID)
	assert.Len(t, result.Sink.TableMapping, 3)

	// Verify schema fields include all streams
	assert.GreaterOrEqual(t, len(result.Schema.Fields), 3)

	// Check that join output fields are in schema
	foundEventName := false
	foundUserName := false
	foundUserID := false

	for _, field := range result.Schema.Fields {
		if field.SourceID == "join-1" {
			switch field.Name {
			case "event_name":
				foundEventName = true
			case "user_name":
				foundUserName = true
			case "user_id":
				foundUserID = true
			}
		}
	}

	assert.True(t, foundEventName, "event_name field should be in schema")
	assert.True(t, foundUserName, "user_name field should be in schema")
	assert.True(t, foundUserID, "user_id field should be in schema")
}

func TestToPipelineJSON_EmptySchemaVersion(t *testing.T) {
	// Test case with no schema versions
	pipelineConfig := models.PipelineConfig{
		ID:   "test-pipeline-5",
		Name: "Test Pipeline No Schema",
		Ingestor: models.IngestorComponentConfig{
			Type:     internal.KafkaIngestorType,
			Provider: "confluent",
			KafkaConnectionParams: models.KafkaConnectionParamsConfig{
				Brokers:       []string{"localhost:9092"},
				SASLProtocol:  "SASL_PLAINTEXT",
				SASLMechanism: "PLAIN",
				SASLUsername:  "user",
				SASLPassword:  "password",
			},
			KafkaTopics: []models.KafkaTopicsConfig{
				{
					Name:                       "test",
					ConsumerGroupInitialOffset: "earliest",
					Replicas:                   1,
					Deduplication: models.DeduplicationConfig{
						Enabled: false,
					},
					OutputStreamID:      "stream-test",
					OutputStreamSubject: "subject-test",
				},
			},
		},
		Sink: models.SinkComponentConfig{
			Type:     internal.ClickHouseSinkType,
			StreamID: "stream-test",
			Batch: models.BatchConfig{
				MaxBatchSize: 1000,
				MaxDelayTime: *models.NewJSONDuration(60 * time.Second),
			},
			ClickHouseConnectionParams: models.ClickHouseConnectionParamsConfig{
				Host:     "localhost",
				Port:     "9000",
				HttpPort: "8123",
				Database: "default",
				Username: "default",
				Password: "password",
				Table:    "test_table",
				Secure:   false,
			},
		},
		Mapper: models.MapperConfig{
			Type:        internal.SchemaMapperJSONToCHType,
			Streams:     map[string]models.StreamSchemaConfig{},
			SinkMapping: []models.SinkMappingConfig{},
		},
		Join: models.JoinComponentConfig{
			Enabled: false,
		},
		Filter: models.FilterComponentConfig{
			Enabled: false,
		},
		StatelessTransformation: models.StatelessTransformation{
			Enabled: false,
		},
		SchemaVersions: []models.SchemaVersion{}, // Empty schema versions
	}

	result := toPipelineJSON(pipelineConfig)

	// Verify topic has empty schema version and fields
	topic := result.Source.Topics[0]
	assert.Equal(t, "", topic.SchemaVersion)
	assert.Nil(t, topic.SchemaFields)
}
