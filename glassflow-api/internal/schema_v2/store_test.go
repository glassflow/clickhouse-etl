package schemav2

import (
	"context"
	"errors"
	"testing"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/schema_v2/mocks"
	"github.com/stretchr/testify/assert"
)

func TestSchemaStore_GetSchemaVersion(t *testing.T) {
	ctx := context.Background()
	pipelineID := "test-pipeline"
	sourceID := "test-source"
	versionID := "1"

	schemaVersion := &models.SchemaVersion{
		SourceID:  sourceID,
		VersionID: versionID,
		DataType:  models.SchemaDataFormatJSON,
		Fields: []models.Field{
			{Name: "field1", Type: "string"},
		},
	}

	t.Run("returns cached version", func(t *testing.T) {
		mockDB := mocks.NewMockDBClient()
		store := NewSchemaStore(mockDB, pipelineID, sourceID).(*SchemaStore)

		// Pre-populate cache
		store.versions[versionID] = schemaVersion

		result, err := store.GetSchemaVersion(ctx, versionID)

		assert.NoError(t, err)
		assert.Equal(t, schemaVersion, result)
	})

	t.Run("fetches from database when not cached", func(t *testing.T) {
		mockDB := mocks.NewMockDBClient()
		mockDB.GetSchemaVersionFunc = func(ctx context.Context, pipelineIDArg, sourceIDArg, versionIDArg string) (*models.SchemaVersion, error) {
			return schemaVersion, nil
		}

		store := NewSchemaStore(mockDB, pipelineID, sourceID)

		result, err := store.GetSchemaVersion(ctx, versionID)

		assert.NoError(t, err)
		assert.Equal(t, schemaVersion, result)
	})

	t.Run("returns error when schema not found", func(t *testing.T) {
		mockDB := mocks.NewMockDBClient()
		mockDB.GetSchemaVersionFunc = func(ctx context.Context, pipelineIDArg, sourceIDArg, versionIDArg string) (*models.SchemaVersion, error) {
			return nil, models.ErrSchemaVerionNotFound
		}

		store := NewSchemaStore(mockDB, pipelineID, sourceID)

		result, err := store.GetSchemaVersion(ctx, versionID)

		assert.Error(t, err)
		assert.Nil(t, result)
		assert.True(t, errors.Is(err, models.ErrSchemaVerionNotFound))
	})

	t.Run("returns error on database failure", func(t *testing.T) {
		mockDB := mocks.NewMockDBClient()
		dbErr := errors.New("database error")
		mockDB.GetSchemaVersionFunc = func(ctx context.Context, pipelineIDArg, sourceIDArg, versionIDArg string) (*models.SchemaVersion, error) {
			return nil, dbErr
		}

		store := NewSchemaStore(mockDB, pipelineID, sourceID)

		result, err := store.GetSchemaVersion(ctx, versionID)

		assert.Error(t, err)
		assert.Nil(t, result)
		assert.Contains(t, err.Error(), "get schema version")
	})

	t.Run("caches fetched version", func(t *testing.T) {
		mockDB := mocks.NewMockDBClient()
		callCount := 0
		mockDB.GetSchemaVersionFunc = func(ctx context.Context, pipelineIDArg, sourceIDArg, versionIDArg string) (*models.SchemaVersion, error) {
			callCount++
			return schemaVersion, nil
		}

		store := NewSchemaStore(mockDB, pipelineID, sourceID)

		// First call - fetches from DB
		result1, err := store.GetSchemaVersion(ctx, versionID)
		assert.NoError(t, err)
		assert.Equal(t, schemaVersion, result1)

		// Second call - should use cache (no DB call expected)
		result2, err := store.GetSchemaVersion(ctx, versionID)
		assert.NoError(t, err)
		assert.Equal(t, schemaVersion, result2)
	})
}

func TestSchemaStore_GetLatestSchemaVersion(t *testing.T) {
	ctx := context.Background()
	pipelineID := "test-pipeline"
	sourceID := "test-source"
	versionID := "2"

	latestVersion := &models.SchemaVersion{
		SourceID:  sourceID,
		VersionID: versionID,
		DataType:  models.SchemaDataFormatJSON,
		Fields: []models.Field{
			{Name: "field1", Type: "string"},
		},
	}

	t.Run("returns cached latest version", func(t *testing.T) {
		mockDB := mocks.NewMockDBClient()
		store := NewSchemaStore(mockDB, pipelineID, sourceID).(*SchemaStore)

		// Pre-populate cache
		store.latestVersion = versionID
		store.versions[versionID] = latestVersion

		result, err := store.GetLatestSchemaVersion(ctx)

		assert.NoError(t, err)
		assert.Equal(t, latestVersion, result)
	})

	t.Run("fetches from database when not cached", func(t *testing.T) {
		mockDB := mocks.NewMockDBClient()
		mockDB.GetLatestSchemaVersionFunc = func(ctx context.Context, pipelineIDArg, sourceIDArg string) (*models.SchemaVersion, error) {
			return latestVersion, nil
		}

		store := NewSchemaStore(mockDB, pipelineID, sourceID)

		result, err := store.GetLatestSchemaVersion(ctx)

		assert.NoError(t, err)
		assert.Equal(t, latestVersion, result)
	})

	t.Run("returns error on database failure", func(t *testing.T) {
		mockDB := mocks.NewMockDBClient()
		dbErr := errors.New("database error")
		mockDB.GetLatestSchemaVersionFunc = func(ctx context.Context, pipelineIDArg, sourceIDArg string) (*models.SchemaVersion, error) {
			return nil, dbErr
		}

		store := NewSchemaStore(mockDB, pipelineID, sourceID)

		result, err := store.GetLatestSchemaVersion(ctx)

		assert.Error(t, err)
		assert.Nil(t, result)
		assert.Contains(t, err.Error(), "get latest schema version")
	})

	t.Run("caches latest version", func(t *testing.T) {
		mockDB := mocks.NewMockDBClient()
		callCount := 0
		mockDB.GetLatestSchemaVersionFunc = func(ctx context.Context, pipelineIDArg, sourceIDArg string) (*models.SchemaVersion, error) {
			callCount++
			return latestVersion, nil
		}

		store := NewSchemaStore(mockDB, pipelineID, sourceID)

		// First call - fetches from DB
		result1, err := store.GetLatestSchemaVersion(ctx)
		assert.NoError(t, err)
		assert.Equal(t, latestVersion, result1)

		// Second call - should use cache (no DB call expected)
		result2, err := store.GetLatestSchemaVersion(ctx)
		assert.NoError(t, err)
		assert.Equal(t, latestVersion, result2)
	})
}

func TestSchemaStore_SaveSchemaVersion(t *testing.T) {
	ctx := context.Background()
	pipelineID := "test-pipeline"
	sourceID := "test-source"
	oldVersionID := "1"
	newVersionID := "2"

	oldVersion := &models.SchemaVersion{
		SourceID:  sourceID,
		VersionID: oldVersionID,
		DataType:  models.SchemaDataFormatJSON,
		Fields: []models.Field{
			{Name: "field1", Type: "string"},
		},
	}

	t.Run("saves new version successfully", func(t *testing.T) {
		mockDB := mocks.NewMockDBClient()
		mockDB.SaveNewSchemaVersionFunc = func(ctx context.Context, pipelineIDArg, sourceIDArg, oldVersionIDArg, newVersionIDArg string) error {
			return nil
		}

		store := NewSchemaStore(mockDB, pipelineID, sourceID).(*SchemaStore)
		store.versions[oldVersionID] = oldVersion

		err := store.SaveSchemaVersion(ctx, oldVersionID, newVersionID)

		assert.NoError(t, err)
		assert.Equal(t, newVersionID, store.latestVersion)
		assert.Equal(t, oldVersion, store.versions[newVersionID])
	})

	t.Run("returns error on database failure", func(t *testing.T) {
		mockDB := mocks.NewMockDBClient()
		dbErr := errors.New("database error")
		mockDB.SaveNewSchemaVersionFunc = func(ctx context.Context, pipelineIDArg, sourceIDArg, oldVersionIDArg, newVersionIDArg string) error {
			return dbErr
		}

		store := NewSchemaStore(mockDB, pipelineID, sourceID).(*SchemaStore)
		store.versions[oldVersionID] = oldVersion

		err := store.SaveSchemaVersion(ctx, oldVersionID, newVersionID)

		assert.Error(t, err)
		assert.Contains(t, err.Error(), "save schema version")
	})

	t.Run("updates cache with new version", func(t *testing.T) {
		mockDB := mocks.NewMockDBClient()
		mockDB.SaveNewSchemaVersionFunc = func(ctx context.Context, pipelineIDArg, sourceIDArg, oldVersionIDArg, newVersionIDArg string) error {
			return nil
		}

		store := NewSchemaStore(mockDB, pipelineID, sourceID).(*SchemaStore)
		store.versions[oldVersionID] = oldVersion
		store.latestVersion = oldVersionID

		err := store.SaveSchemaVersion(ctx, oldVersionID, newVersionID)

		assert.NoError(t, err)
		assert.Equal(t, newVersionID, store.latestVersion)
		assert.NotNil(t, store.versions[newVersionID])
		assert.Equal(t, store.versions[oldVersionID], store.versions[newVersionID])
	})
}
