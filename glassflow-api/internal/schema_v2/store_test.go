package schemav2

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.uber.org/mock/gomock"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/schema_v2/mocks"
)

func TestNewSchemaStore(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockDB := mocks.NewMockDBClient(ctrl)
	pipelineID := "test-pipeline"
	sourceName := "test-source"

	store := NewSchemaStore(mockDB, pipelineID, sourceName)

	assert.NotNil(t, store)
	schemaStore, ok := store.(*SchemaStore)
	require.True(t, ok)
	assert.Equal(t, pipelineID, schemaStore.pipelineID)
	assert.Equal(t, sourceName, schemaStore.sourceName)
	assert.NotNil(t, schemaStore.versions)
	assert.Empty(t, schemaStore.versions)
}

func TestSchemaStore_GetSchema(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockDB := mocks.NewMockDBClient(ctrl)
	pipelineID := "test-pipeline"
	sourceName := "test-source"
	ctx := context.Background()

	t.Run("success", func(t *testing.T) {
		expectedSchema := &models.SchemaV2{
			ID:         "schema-1",
			SourceName: sourceName,
			ConfigType: models.SchemaConfigTypeInternal,
			DataFormat: models.SchemaDataFormatJSON,
			SchemaType: models.SchemaTypeKafka,
		}

		mockDB.EXPECT().
			GetSchema(ctx, pipelineID, sourceName).
			Return(expectedSchema, nil)

		store := NewSchemaStore(mockDB, pipelineID, sourceName)
		schema, err := store.GetSchema(ctx)

		require.NoError(t, err)
		assert.Equal(t, expectedSchema, schema)

		// Verify schema is cached
		schemaStore := store.(*SchemaStore)
		assert.Equal(t, expectedSchema, schemaStore.schema)
	})

	t.Run("database error", func(t *testing.T) {
		expectedErr := errors.New("database error")

		mockDB.EXPECT().
			GetSchema(ctx, pipelineID, sourceName).
			Return(nil, expectedErr)

		store := NewSchemaStore(mockDB, pipelineID, sourceName)
		schema, err := store.GetSchema(ctx)

		require.Error(t, err)
		assert.Nil(t, schema)
		assert.Contains(t, err.Error(), "get schema")
	})
}

func TestSchemaStore_GetSchemaVersion(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockDB := mocks.NewMockDBClient(ctrl)
	pipelineID := "test-pipeline"
	sourceName := "test-source"
	ctx := context.Background()

	schemaID := "schema-1"
	version := "v1"

	t.Run("success from database", func(t *testing.T) {
		expectedVersion := &models.SchemaVersion{
			ID:       "version-1",
			SchemaID: schemaID,
			Version:  version,
			Status:   "active",
			SchemaFields: models.SchemaFields{
				Fields: []models.Field{
					{Name: "field1", Type: "string"},
				},
			},
		}

		mockDB.EXPECT().
			GetSchemaVersion(ctx, schemaID, version).
			Return(expectedVersion, nil)

		store := NewSchemaStore(mockDB, pipelineID, sourceName)
		schemaStore := store.(*SchemaStore)
		schemaStore.schema = &models.SchemaV2{ID: schemaID}

		schemaVersion, err := store.GetSchemaVersion(ctx, version)

		require.NoError(t, err)
		assert.Equal(t, expectedVersion, schemaVersion)

		// Verify version is cached
		assert.Equal(t, expectedVersion, schemaStore.versions[version])
	})

	t.Run("success from cache", func(t *testing.T) {
		cachedVersion := &models.SchemaVersion{
			ID:       "version-1",
			SchemaID: schemaID,
			Version:  version,
			Status:   "active",
		}

		// No DB call expected since version is in cache
		store := NewSchemaStore(mockDB, pipelineID, sourceName)
		schemaStore := store.(*SchemaStore)
		schemaStore.schema = &models.SchemaV2{ID: schemaID}
		schemaStore.versions[version] = cachedVersion

		schemaVersion, err := store.GetSchemaVersion(ctx, version)

		require.NoError(t, err)
		assert.Equal(t, cachedVersion, schemaVersion)
	})

	t.Run("version not found", func(t *testing.T) {
		mockDB.EXPECT().
			GetSchemaVersion(ctx, schemaID, version).
			Return(nil, models.ErrRecordNotFound)

		store := NewSchemaStore(mockDB, pipelineID, sourceName)
		schemaStore := store.(*SchemaStore)
		schemaStore.schema = &models.SchemaV2{ID: schemaID}

		schemaVersion, err := store.GetSchemaVersion(ctx, version)

		require.Error(t, err)
		assert.Nil(t, schemaVersion)
		assert.ErrorIs(t, err, models.ErrSchemaVerionNotFound)
	})

	t.Run("database error", func(t *testing.T) {
		expectedErr := errors.New("database error")

		mockDB.EXPECT().
			GetSchemaVersion(ctx, schemaID, version).
			Return(nil, expectedErr)

		store := NewSchemaStore(mockDB, pipelineID, sourceName)
		schemaStore := store.(*SchemaStore)
		schemaStore.schema = &models.SchemaV2{ID: schemaID}

		schemaVersion, err := store.GetSchemaVersion(ctx, version)

		require.Error(t, err)
		assert.Nil(t, schemaVersion)
		assert.Contains(t, err.Error(), "get schema version")
	})
}

func TestSchemaStore_GetLatestSchemaVersion(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockDB := mocks.NewMockDBClient(ctrl)
	pipelineID := "test-pipeline"
	sourceName := "test-source"
	ctx := context.Background()

	schemaID := "schema-1"
	latestVersionID := "v2"

	t.Run("success from database", func(t *testing.T) {
		expectedVersion := &models.SchemaVersion{
			ID:       "version-2",
			SchemaID: schemaID,
			Version:  latestVersionID,
			Status:   "active",
			SchemaFields: models.SchemaFields{
				Fields: []models.Field{
					{Name: "field1", Type: "string"},
					{Name: "field2", Type: "int"},
				},
			},
		}

		mockDB.EXPECT().
			GetLatestSchemaVersion(ctx, schemaID).
			Return(expectedVersion, nil)

		store := NewSchemaStore(mockDB, pipelineID, sourceName)
		schemaStore := store.(*SchemaStore)
		schemaStore.schema = &models.SchemaV2{ID: schemaID}

		schemaVersion, err := store.GetLatestSchemaVersion(ctx)

		require.NoError(t, err)
		assert.Equal(t, expectedVersion, schemaVersion)

		// Verify version is cached
		assert.Equal(t, latestVersionID, schemaStore.latestVersion)
		assert.Equal(t, expectedVersion, schemaStore.versions[latestVersionID])
	})

	t.Run("success from cache with latest version set", func(t *testing.T) {
		cachedVersion := &models.SchemaVersion{
			ID:       "version-2",
			SchemaID: schemaID,
			Version:  latestVersionID,
			Status:   "active",
		}

		// No DB call expected since latest version is cached
		store := NewSchemaStore(mockDB, pipelineID, sourceName)
		schemaStore := store.(*SchemaStore)
		schemaStore.schema = &models.SchemaV2{ID: schemaID}
		schemaStore.latestVersion = latestVersionID
		schemaStore.versions[latestVersionID] = cachedVersion

		schemaVersion, err := store.GetLatestSchemaVersion(ctx)

		require.NoError(t, err)
		assert.Equal(t, cachedVersion, schemaVersion)
	})

	t.Run("success with latest version set but version not cached", func(t *testing.T) {
		expectedVersion := &models.SchemaVersion{
			ID:       "version-2",
			SchemaID: schemaID,
			Version:  latestVersionID,
			Status:   "active",
		}

		mockDB.EXPECT().
			GetLatestSchemaVersion(ctx, schemaID).
			Return(expectedVersion, nil)

		store := NewSchemaStore(mockDB, pipelineID, sourceName)
		schemaStore := store.(*SchemaStore)
		schemaStore.schema = &models.SchemaV2{ID: schemaID}
		schemaStore.latestVersion = "v1" // Different version

		schemaVersion, err := store.GetLatestSchemaVersion(ctx)

		require.NoError(t, err)
		assert.Equal(t, expectedVersion, schemaVersion)
		assert.Equal(t, latestVersionID, schemaStore.latestVersion)
	})

	t.Run("database error", func(t *testing.T) {
		expectedErr := errors.New("database error")

		mockDB.EXPECT().
			GetLatestSchemaVersion(ctx, schemaID).
			Return(nil, expectedErr)

		store := NewSchemaStore(mockDB, pipelineID, sourceName)
		schemaStore := store.(*SchemaStore)
		schemaStore.schema = &models.SchemaV2{ID: schemaID}

		schemaVersion, err := store.GetLatestSchemaVersion(ctx)

		require.Error(t, err)
		assert.Nil(t, schemaVersion)
		assert.Contains(t, err.Error(), "get latest schema version")
	})
}

func TestSchemaStore_SaveSchemaVersion(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockDB := mocks.NewMockDBClient(ctrl)
	pipelineID := "test-pipeline"
	sourceName := "test-source"
	ctx := context.Background()

	schemaID := "schema-1"
	version := "v3"
	schemaFields := models.SchemaFields{
		Fields: []models.Field{
			{Name: "field1", Type: "string"},
			{Name: "field2", Type: "int"},
			{Name: "field3", Type: "bool"},
		},
	}

	t.Run("success", func(t *testing.T) {
		mockDB.EXPECT().
			SaveSchemaVersion(ctx, schemaID, version, schemaFields).
			Return(nil)

		store := NewSchemaStore(mockDB, pipelineID, sourceName)
		schemaStore := store.(*SchemaStore)
		schemaStore.schema = &models.SchemaV2{ID: schemaID}

		err := store.SaveSchemaVersion(ctx, version, schemaFields)

		require.NoError(t, err)

		// Verify version is cached
		cachedVersion, ok := schemaStore.versions[version]
		require.True(t, ok)
		assert.Equal(t, schemaID, cachedVersion.SchemaID)
		assert.Equal(t, version, cachedVersion.Version)
		assert.Equal(t, schemaFields, cachedVersion.SchemaFields)
	})

	t.Run("database error", func(t *testing.T) {
		expectedErr := errors.New("database error")

		mockDB.EXPECT().
			SaveSchemaVersion(ctx, schemaID, version, schemaFields).
			Return(expectedErr)

		store := NewSchemaStore(mockDB, pipelineID, sourceName)
		schemaStore := store.(*SchemaStore)
		schemaStore.schema = &models.SchemaV2{ID: schemaID}

		err := store.SaveSchemaVersion(ctx, version, schemaFields)

		require.Error(t, err)
		assert.Contains(t, err.Error(), "save schema version")

		// Verify version is not cached on error
		_, ok := schemaStore.versions[version]
		assert.False(t, ok)
	})

	t.Run("overwrites existing cached version", func(t *testing.T) {
		oldFields := models.SchemaFields{
			Fields: []models.Field{
				{Name: "old_field", Type: "string"},
			},
		}

		newFields := models.SchemaFields{
			Fields: []models.Field{
				{Name: "new_field", Type: "int"},
			},
		}

		mockDB.EXPECT().
			SaveSchemaVersion(ctx, schemaID, version, newFields).
			Return(nil)

		store := NewSchemaStore(mockDB, pipelineID, sourceName)
		schemaStore := store.(*SchemaStore)
		schemaStore.schema = &models.SchemaV2{ID: schemaID}
		schemaStore.versions[version] = &models.SchemaVersion{
			SchemaID:     schemaID,
			Version:      version,
			SchemaFields: oldFields,
		}

		err := store.SaveSchemaVersion(ctx, version, newFields)

		require.NoError(t, err)

		// Verify version is updated in cache
		cachedVersion, ok := schemaStore.versions[version]
		require.True(t, ok)
		assert.Equal(t, newFields, cachedVersion.SchemaFields)
	})
}
