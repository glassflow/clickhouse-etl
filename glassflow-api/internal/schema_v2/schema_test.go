package schemav2

import (
	"context"
	"encoding/binary"
	"encoding/json"
	"errors"
	"testing"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/schema_v2/mocks"
	"github.com/stretchr/testify/assert"
)

func TestNewSchema(t *testing.T) {
	t.Run("creates schema with external registry", func(t *testing.T) {
		mockDB := mocks.NewMockDBClient()
		mockSR := mocks.NewMockSchemaRegistryClient()

		schema, err := NewSchema("pipeline-1", "source-1", mockDB, mockSR)

		assert.NoError(t, err)
		assert.NotNil(t, schema)
		assert.True(t, schema.external)
		assert.Equal(t, "pipeline-1", schema.pipelineID)
		assert.Equal(t, "source-1", schema.sourceID)
	})

	t.Run("creates schema without external registry", func(t *testing.T) {
		mockDB := mocks.NewMockDBClient()

		schema, err := NewSchema("pipeline-1", "source-1", mockDB, nil)

		assert.NoError(t, err)
		assert.NotNil(t, schema)
		assert.False(t, schema.external)
	})

	t.Run("returns error when dbClient is nil", func(t *testing.T) {
		schema, err := NewSchema("pipeline-1", "source-1", nil, nil)

		assert.Error(t, err)
		assert.Nil(t, schema)
		assert.Contains(t, err.Error(), "dbClient cannot be nil")
	})
}

func TestSchema_ValidateInternalSchema(t *testing.T) {
	ctx := context.Background()
	pipelineID := "test-pipeline"
	sourceID := "test-source"

	currentVersion := &models.SchemaVersion{
		SourceID:  sourceID,
		VersionID: "1",
		DataType:  models.SchemaDataFormatJSON,
		Fields: []models.Field{
			{Name: "field1", Type: "string"},
			{Name: "field2", Type: "int"},
		},
	}

	validData := []byte(`{"field1": "value1", "field2": 42}`)

	t.Run("validates correct JSON data", func(t *testing.T) {
		mockDB := mocks.NewMockDBClient()
		mockDB.GetLatestSchemaVersionFunc = func(ctx context.Context, pipelineIDArg, sourceIDArg string) (*models.SchemaVersion, error) {
			return currentVersion, nil
		}

		schema, _ := NewSchema(pipelineID, sourceID, mockDB, nil)

		versionID, err := schema.Validate(ctx, validData)

		assert.NoError(t, err)
		assert.Equal(t, "1", versionID)
	})

	t.Run("returns error when schema version not found", func(t *testing.T) {
		mockDB := mocks.NewMockDBClient()
		mockDB.GetLatestSchemaVersionFunc = func(ctx context.Context, pipelineIDArg, sourceIDArg string) (*models.SchemaVersion, error) {
			return nil, errors.New("not found")
		}

		schema, _ := NewSchema(pipelineID, sourceID, mockDB, nil)

		versionID, err := schema.Validate(ctx, validData)

		assert.Error(t, err)
		assert.Empty(t, versionID)
		assert.Contains(t, err.Error(), "failed to get latest schema version")
	})

	t.Run("returns error for unsupported data format", func(t *testing.T) {
		unsupportedVersion := &models.SchemaVersion{
			SourceID:  sourceID,
			VersionID: "1",
			DataType:  "avro",
			Fields:    []models.Field{},
		}

		mockDB := mocks.NewMockDBClient()
		mockDB.GetLatestSchemaVersionFunc = func(ctx context.Context, pipelineIDArg, sourceIDArg string) (*models.SchemaVersion, error) {
			return unsupportedVersion, nil
		}

		schema, _ := NewSchema(pipelineID, sourceID, mockDB, nil)

		versionID, err := schema.Validate(ctx, validData)

		assert.Error(t, err)
		assert.Empty(t, versionID)
		assert.Contains(t, err.Error(), "unsupported schema data format")
	})
}

func TestSchema_ValidateExternalSchema(t *testing.T) {
	ctx := context.Background()
	pipelineID := "test-pipeline"
	sourceID := "test-source"
	schemaID := 100

	// Create valid message with schema ID
	data := make([]byte, 10)
	data[0] = 0 // Magic byte
	binary.BigEndian.PutUint32(data[1:5], uint32(schemaID))

	existingVersion := &models.SchemaVersion{
		SourceID:  sourceID,
		VersionID: "100",
		DataType:  models.SchemaDataFormatJSON,
		Fields: []models.Field{
			{Name: "field1", Type: "string"},
		},
	}

	t.Run("validates with existing schema version", func(t *testing.T) {
		mockDB := mocks.NewMockDBClient()
		mockSR := mocks.NewMockSchemaRegistryClient()
		mockDB.GetSchemaVersionFunc = func(ctx context.Context, pipelineIDArg, sourceIDArg, versionIDArg string) (*models.SchemaVersion, error) {
			return existingVersion, nil
		}

		schema, _ := NewSchema(pipelineID, sourceID, mockDB, mockSR)

		versionID, err := schema.Validate(ctx, data)

		assert.NoError(t, err)
		assert.Equal(t, "100", versionID)
	})

	t.Run("validates and saves new schema version", func(t *testing.T) {
		newFields := []models.Field{
			{Name: "field1", Type: "string"},
			{Name: "field2", Type: "int"},
		}

		latestVersion := &models.SchemaVersion{
			SourceID:  sourceID,
			VersionID: "99",
			DataType:  models.SchemaDataFormatJSON,
			Fields: []models.Field{
				{Name: "field1", Type: "string"},
			},
		}

		mockDB := mocks.NewMockDBClient()
		mockSR := mocks.NewMockSchemaRegistryClient()

		// Schema version not found - triggers new version creation
		mockDB.GetSchemaVersionFunc = func(ctx context.Context, pipelineIDArg, sourceIDArg, versionIDArg string) (*models.SchemaVersion, error) {
			return nil, models.ErrSchemaVerionNotFound
		}

		// Get schema from registry
		mockSR.GetSchemaFunc = func(ctx context.Context, schemaIDArg int) ([]models.Field, error) {
			return newFields, nil
		}

		// Get latest version for validation
		mockDB.GetLatestSchemaVersionFunc = func(ctx context.Context, pipelineIDArg, sourceIDArg string) (*models.SchemaVersion, error) {
			return latestVersion, nil
		}

		// Save new version
		mockDB.SaveNewSchemaVersionFunc = func(ctx context.Context, pipelineIDArg, sourceIDArg, oldVersionIDArg, newVersionIDArg string) error {
			return nil
		}

		schema, _ := NewSchema(pipelineID, sourceID, mockDB, mockSR)

		versionID, err := schema.Validate(ctx, data)

		assert.NoError(t, err)
		assert.Equal(t, "100", versionID)
	})

	t.Run("returns error when schema not found in registry", func(t *testing.T) {
		mockDB := mocks.NewMockDBClient()
		mockSR := mocks.NewMockSchemaRegistryClient()

		mockDB.GetSchemaVersionFunc = func(ctx context.Context, pipelineIDArg, sourceIDArg, versionIDArg string) (*models.SchemaVersion, error) {
			return nil, models.ErrSchemaVerionNotFound
		}

		mockSR.GetSchemaFunc = func(ctx context.Context, schemaIDArg int) ([]models.Field, error) {
			return nil, models.ErrSchemaNotFound
		}

		schema, _ := NewSchema(pipelineID, sourceID, mockDB, mockSR)

		versionID, err := schema.Validate(ctx, data)

		assert.Error(t, err)
		assert.Equal(t, "100", versionID)
		assert.True(t, errors.Is(err, models.ErrSchemaNotFound))
	})

	t.Run("returns error when new schema has no fields", func(t *testing.T) {
		mockDB := mocks.NewMockDBClient()
		mockSR := mocks.NewMockSchemaRegistryClient()

		mockDB.GetSchemaVersionFunc = func(ctx context.Context, pipelineIDArg, sourceIDArg, versionIDArg string) (*models.SchemaVersion, error) {
			return nil, models.ErrSchemaVerionNotFound
		}

		mockSR.GetSchemaFunc = func(ctx context.Context, schemaIDArg int) ([]models.Field, error) {
			return []models.Field{}, nil
		}

		schema, _ := NewSchema(pipelineID, sourceID, mockDB, mockSR)

		versionID, err := schema.Validate(ctx, data)

		assert.Error(t, err)
		assert.Equal(t, "100", versionID)
		assert.Contains(t, err.Error(), "has no fields")
	})

	t.Run("returns error on invalid message format", func(t *testing.T) {
		mockDB := mocks.NewMockDBClient()
		mockSR := mocks.NewMockSchemaRegistryClient()

		invalidData := []byte{0, 1} // Too short

		schema, _ := NewSchema(pipelineID, sourceID, mockDB, mockSR)

		versionID, err := schema.Validate(ctx, invalidData)

		assert.Error(t, err)
		assert.Empty(t, versionID)
		assert.Contains(t, err.Error(), "extract schema version")
	})
}

func TestSchema_Get(t *testing.T) {
	ctx := context.Background()
	pipelineID := "test-pipeline"
	sourceID := "test-source"
	versionID := "1"

	schemaVersion := &models.SchemaVersion{
		SourceID:  sourceID,
		VersionID: versionID,
		DataType:  models.SchemaDataFormatJSON,
		Fields: []models.Field{
			{Name: "user_id", Type: "string"},
			{Name: "name", Type: "string"},
			{Name: "age", Type: "int"},
		},
	}

	testData := map[string]any{
		"user_id": "123",
		"name":    "John Doe",
		"age":     30,
	}
	jsonData, _ := json.Marshal(testData)

	t.Run("gets string value by key", func(t *testing.T) {
		mockDB := mocks.NewMockDBClient()
		mockDB.GetSchemaVersionFunc = func(ctx context.Context, pipelineIDArg, sourceIDArg, versionIDArg string) (*models.SchemaVersion, error) {
			return schemaVersion, nil
		}

		schema, _ := NewSchema(pipelineID, sourceID, mockDB, nil)

		value, err := schema.Get(ctx, versionID, "name", jsonData)

		assert.NoError(t, err)
		assert.Equal(t, "John Doe", value)
	})

	t.Run("gets numeric value by key", func(t *testing.T) {
		mockDB := mocks.NewMockDBClient()
		mockDB.GetSchemaVersionFunc = func(ctx context.Context, pipelineIDArg, sourceIDArg, versionIDArg string) (*models.SchemaVersion, error) {
			return schemaVersion, nil
		}

		schema, _ := NewSchema(pipelineID, sourceID, mockDB, nil)

		value, err := schema.Get(ctx, versionID, "age", jsonData)

		assert.NoError(t, err)
		assert.Equal(t, float64(30), value) // JSON unmarshals numbers as float64
	})

	t.Run("returns error when key not in schema", func(t *testing.T) {
		mockDB := mocks.NewMockDBClient()
		mockDB.GetSchemaVersionFunc = func(ctx context.Context, pipelineIDArg, sourceIDArg, versionIDArg string) (*models.SchemaVersion, error) {
			return schemaVersion, nil
		}

		schema, _ := NewSchema(pipelineID, sourceID, mockDB, nil)

		value, err := schema.Get(ctx, versionID, "invalid_field", jsonData)

		assert.Error(t, err)
		assert.Nil(t, value)
		assert.Contains(t, err.Error(), "not found in schema version")
	})

	t.Run("returns error when key not in data", func(t *testing.T) {
		emptyData := []byte(`{"other_field": "value"}`)

		mockDB := mocks.NewMockDBClient()
		mockDB.GetSchemaVersionFunc = func(ctx context.Context, pipelineIDArg, sourceIDArg, versionIDArg string) (*models.SchemaVersion, error) {
			return schemaVersion, nil
		}

		schema, _ := NewSchema(pipelineID, sourceID, mockDB, nil)

		value, err := schema.Get(ctx, versionID, "name", emptyData)

		assert.Error(t, err)
		assert.Nil(t, value)
		assert.Contains(t, err.Error(), "not found in data")
	})

	t.Run("returns error when schema version not found", func(t *testing.T) {
		mockDB := mocks.NewMockDBClient()
		mockDB.GetSchemaVersionFunc = func(ctx context.Context, pipelineIDArg, sourceIDArg, versionIDArg string) (*models.SchemaVersion, error) {
			return nil, models.ErrSchemaVerionNotFound
		}

		schema, _ := NewSchema(pipelineID, sourceID, mockDB, nil)

		value, err := schema.Get(ctx, versionID, "name", jsonData)

		assert.Error(t, err)
		assert.Nil(t, value)
		assert.Contains(t, err.Error(), "get schema version")
	})

	t.Run("handles nested JSON structures", func(t *testing.T) {
		nestedSchema := &models.SchemaVersion{
			SourceID:  sourceID,
			VersionID: versionID,
			DataType:  models.SchemaDataFormatJSON,
			Fields: []models.Field{
				{Name: "user", Type: "object"},
			},
		}

		nestedData := []byte(`{"user": {"name": "John", "age": 30}}`)

		mockDB := mocks.NewMockDBClient()
		mockDB.GetSchemaVersionFunc = func(ctx context.Context, pipelineIDArg, sourceIDArg, versionIDArg string) (*models.SchemaVersion, error) {
			return nestedSchema, nil
		}

		schema, _ := NewSchema(pipelineID, sourceID, mockDB, nil)

		value, err := schema.Get(ctx, versionID, "user", nestedData)

		assert.NoError(t, err)
		assert.NotNil(t, value)

		userMap, ok := value.(map[string]interface{})
		assert.True(t, ok)
		assert.Equal(t, "John", userMap["name"])
	})
}

func TestExtractSchemaVersion(t *testing.T) {
	t.Run("extracts schema version from valid data", func(t *testing.T) {
		data := make([]byte, 10)
		data[0] = 0 // Magic byte
		binary.BigEndian.PutUint32(data[1:5], 12345)

		version, err := extractSchemaVersion(data)

		assert.NoError(t, err)
		assert.Equal(t, 12345, version)
	})

	t.Run("returns error for data too short", func(t *testing.T) {
		data := []byte{0, 1, 2}

		version, err := extractSchemaVersion(data)

		assert.Error(t, err)
		assert.Equal(t, 0, version)
		assert.Contains(t, err.Error(), "message too short")
	})

	t.Run("returns error for invalid magic byte", func(t *testing.T) {
		data := make([]byte, 10)
		data[0] = 1 // Invalid magic byte

		version, err := extractSchemaVersion(data)

		assert.Error(t, err)
		assert.Equal(t, 0, version)
		assert.Contains(t, err.Error(), "invalid magic byte")
	})
}
