package schemav2

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.uber.org/mock/gomock"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/schema_v2/mocks"
)

func TestSchemaStore_GetSchema(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockDBClient := mocks.NewMockDBClient(ctrl)
	store := NewSchemaStore(mockDBClient)

	ctx := context.Background()
	schemaID := "schema-1"
	expectedSchema := &models.SchemaV2{
		ID:         schemaID,
		SourceName: "test-schema",
	}

	t.Run("get from cache when available", func(t *testing.T) {
		// Pre-populate cache
		store.(*SchemaStore).schemas[schemaID] = expectedSchema

		// No DB call expected
		result, err := store.GetSchema(ctx, schemaID)

		require.NoError(t, err)
		assert.Equal(t, expectedSchema, result)
	})

	t.Run("get from DB and cache when not in cache", func(t *testing.T) {
		newSchemaID := "schema-2"
		newSchema := &models.SchemaV2{
			ID:         newSchemaID,
			SourceName: "test-schema-2",
		}

		mockDBClient.EXPECT().
			GetSchema(ctx, newSchemaID).
			Return(newSchema, nil).
			Times(1)

		result, err := store.GetSchema(ctx, newSchemaID)

		require.NoError(t, err)
		assert.Equal(t, newSchema, result)

		// Verify it was cached
		cachedSchema := store.(*SchemaStore).schemas[newSchemaID]
		assert.Equal(t, newSchema, cachedSchema)
	})

	t.Run("return error when DB call fails", func(t *testing.T) {
		errorSchemaID := "error-schema"
		expectedError := fmt.Errorf("database error")

		mockDBClient.EXPECT().
			GetSchema(ctx, errorSchemaID).
			Return(nil, expectedError).
			Times(1)

		result, err := store.GetSchema(ctx, errorSchemaID)

		require.Error(t, err)
		assert.Nil(t, result)
		assert.Contains(t, err.Error(), "failed to get schema from DB")
	})

	t.Run("return error when schema not found in DB", func(t *testing.T) {
		notFoundSchemaID := "not-found-schema"

		mockDBClient.EXPECT().
			GetSchema(ctx, notFoundSchemaID).
			Return(nil, nil).
			Times(1)

		result, err := store.GetSchema(ctx, notFoundSchemaID)

		require.Error(t, err)
		assert.Nil(t, result)
		assert.Contains(t, err.Error(), "schema not found for ID")
	})
}

func TestSchemaStore_GetSchemaVersion(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockDBClient := mocks.NewMockDBClient(ctrl)
	store := NewSchemaStore(mockDBClient)

	ctx := context.Background()
	schemaID := "schema-1"
	version := "v1"
	expectedSchemaVersion := &models.SchemaVersion{
		ID:       "sv-1",
		SchemaID: schemaID,
		Version:  version,
	}

	t.Run("get from cache when available", func(t *testing.T) {
		// Pre-populate cache
		store.(*SchemaStore).schemaVersions[schemaID] = map[string]*models.SchemaVersion{
			version: expectedSchemaVersion,
		}

		// No DB call expected
		result, err := store.GetSchemaVersion(ctx, schemaID, version)

		require.NoError(t, err)
		assert.Equal(t, expectedSchemaVersion, result)
	})

	t.Run("get from DB and cache when not in cache", func(t *testing.T) {
		newSchemaID := "schema-2"
		newVersion := "v2"
		newSchemaVersion := &models.SchemaVersion{
			ID:       "sv-2",
			SchemaID: newSchemaID,
			Version:  newVersion,
		}

		mockDBClient.EXPECT().
			GetSchemaVersion(ctx, newSchemaID, newVersion).
			Return(newSchemaVersion, nil).
			Times(1)

		result, err := store.GetSchemaVersion(ctx, newSchemaID, newVersion)

		require.NoError(t, err)
		assert.Equal(t, newSchemaVersion, result)

		// Verify it was cached
		cachedVersion := store.(*SchemaStore).schemaVersions[newSchemaID][newVersion]
		assert.Equal(t, newSchemaVersion, cachedVersion)
	})

	t.Run("return error when DB call fails", func(t *testing.T) {
		errorSchemaID := "error-schema"
		errorVersion := "v1"
		expectedError := fmt.Errorf("database error")

		mockDBClient.EXPECT().
			GetSchemaVersion(ctx, errorSchemaID, errorVersion).
			Return(nil, expectedError).
			Times(1)

		result, err := store.GetSchemaVersion(ctx, errorSchemaID, errorVersion)

		require.Error(t, err)
		assert.Nil(t, result)
		assert.Contains(t, err.Error(), "failed to get schema version from DB")
	})

	t.Run("return ErrSchemaVersionNotFound when schema version not found in DB", func(t *testing.T) {
		notFoundSchemaID := "not-found-schema"
		notFoundVersion := "v999"

		mockDBClient.EXPECT().
			GetSchemaVersion(ctx, notFoundSchemaID, notFoundVersion).
			Return(nil, nil).
			Times(1)

		result, err := store.GetSchemaVersion(ctx, notFoundSchemaID, notFoundVersion)

		require.Error(t, err)
		assert.Nil(t, result)
		assert.Equal(t, ErrSchemaVerionNotFound, err)
	})
}

func TestSchemaStore_GetLatestSchemaVersion(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockDBClient := mocks.NewMockDBClient(ctrl)
	store := NewSchemaStore(mockDBClient)

	ctx := context.Background()
	schemaID := "schema-1"
	latestVersion := "v3"
	expectedSchemaVersion := &models.SchemaVersion{
		ID:       "sv-3",
		SchemaID: schemaID,
		Version:  latestVersion,
	}

	t.Run("get from cache when latest version is cached", func(t *testing.T) {
		// Pre-populate cache
		store.(*SchemaStore).latestVersions[schemaID] = latestVersion
		store.(*SchemaStore).schemaVersions[schemaID] = map[string]*models.SchemaVersion{
			latestVersion: expectedSchemaVersion,
		}

		// No DB call expected
		result, err := store.GetLatestSchemaVersion(ctx, schemaID)

		require.NoError(t, err)
		assert.Equal(t, expectedSchemaVersion, result)
	})

	t.Run("get from DB and cache when not in cache", func(t *testing.T) {
		newSchemaID := "schema-2"
		newLatestVersion := "v5"
		newSchemaVersion := &models.SchemaVersion{
			ID:       "sv-5",
			SchemaID: newSchemaID,
			Version:  newLatestVersion,
		}

		mockDBClient.EXPECT().
			GetLatestSchemaVersion(ctx, newSchemaID).
			Return(newSchemaVersion, nil).
			Times(1)

		result, err := store.GetLatestSchemaVersion(ctx, newSchemaID)

		require.NoError(t, err)
		assert.Equal(t, newSchemaVersion, result)

		// Verify it was cached
		cachedVersion := store.(*SchemaStore).schemaVersions[newSchemaID][newLatestVersion]
		assert.Equal(t, newSchemaVersion, cachedVersion)
		assert.Equal(t, newLatestVersion, store.(*SchemaStore).latestVersions[newSchemaID])
	})

	t.Run("return error when DB call fails", func(t *testing.T) {
		errorSchemaID := "error-schema"
		expectedError := fmt.Errorf("database error")

		mockDBClient.EXPECT().
			GetLatestSchemaVersion(ctx, errorSchemaID).
			Return(nil, expectedError).
			Times(1)

		result, err := store.GetLatestSchemaVersion(ctx, errorSchemaID)

		require.Error(t, err)
		assert.Nil(t, result)
		assert.Contains(t, err.Error(), "failed to get latest schema version from DB")
	})

	t.Run("return ErrSchemaVersionNotFound when latest version not found in DB", func(t *testing.T) {
		notFoundSchemaID := "not-found-schema"

		mockDBClient.EXPECT().
			GetLatestSchemaVersion(ctx, notFoundSchemaID).
			Return(nil, nil).
			Times(1)

		result, err := store.GetLatestSchemaVersion(ctx, notFoundSchemaID)

		require.Error(t, err)
		assert.Nil(t, result)
		assert.Equal(t, ErrSchemaVerionNotFound, err)
	})
}

func TestSchemaStore_SaveSchemaVersion(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockDBClient := mocks.NewMockDBClient(ctrl)
	store := NewSchemaStore(mockDBClient)

	ctx := context.Background()
	schemaID := "schema-1"
	version := "v1"
	schemaVersion := models.SchemaVersion{
		ID:       "sv-1",
		SchemaID: schemaID,
		Version:  version,
	}
	sourceMappings := []*models.Mapping{
		{ID: "mapping-1", Type: "field"},
	}
	destinationMappings := []*models.Mapping{
		{ID: "mapping-2", Type: "field"},
	}

	t.Run("save successfully to DB and cache", func(t *testing.T) {
		mockDBClient.EXPECT().
			SaveSchemaVersion(ctx, schemaVersion, sourceMappings, destinationMappings).
			Return(nil).
			Times(1)

		err := store.SaveSchemaVersion(ctx, schemaVersion, sourceMappings, destinationMappings)

		require.NoError(t, err)

		// Verify it was cached
		cachedVersion := store.(*SchemaStore).schemaVersions[schemaID][version]
		assert.Equal(t, &schemaVersion, cachedVersion)
	})

	t.Run("return error when DB save fails", func(t *testing.T) {
		errorSchemaVersion := models.SchemaVersion{
			ID:       "sv-error",
			SchemaID: "error-schema",
			Version:  "v1",
		}
		expectedError := fmt.Errorf("database save error")

		mockDBClient.EXPECT().
			SaveSchemaVersion(ctx, errorSchemaVersion, sourceMappings, destinationMappings).
			Return(expectedError).
			Times(1)

		err := store.SaveSchemaVersion(ctx, errorSchemaVersion, sourceMappings, destinationMappings)

		require.Error(t, err)
		assert.Contains(t, err.Error(), "failed to save schema version to DB")
	})

	t.Run("cache schema version even when it's a new schema", func(t *testing.T) {
		newSchemaID := "new-schema"
		newVersion := "v1"
		newSchemaVersion := models.SchemaVersion{
			ID:       "sv-new",
			SchemaID: newSchemaID,
			Version:  newVersion,
		}

		mockDBClient.EXPECT().
			SaveSchemaVersion(ctx, newSchemaVersion, sourceMappings, destinationMappings).
			Return(nil).
			Times(1)

		err := store.SaveSchemaVersion(ctx, newSchemaVersion, sourceMappings, destinationMappings)

		require.NoError(t, err)

		// Verify it was cached
		cachedVersion := store.(*SchemaStore).schemaVersions[newSchemaID][newVersion]
		assert.Equal(t, &newSchemaVersion, cachedVersion)
	})
}

func TestSchemaStore_GetSourceMappings(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockDBClient := mocks.NewMockDBClient(ctrl)
	store := NewSchemaStore(mockDBClient)

	ctx := context.Background()
	schemaID := "schema-1"
	version := "v1"
	schemaVersionID := "sv-1"
	schemaVersion := &models.SchemaVersion{
		ID:       schemaVersionID,
		SchemaID: schemaID,
		Version:  version,
	}
	expectedMappings := []*models.Mapping{
		{ID: "mapping-1", Type: "field"},
		{ID: "mapping-2", Type: "transformation"},
	}

	t.Run("get from cache when available", func(t *testing.T) {
		// Pre-populate cache
		store.(*SchemaStore).schemaVersions[schemaID] = map[string]*models.SchemaVersion{
			version: schemaVersion,
		}
		store.(*SchemaStore).sourceMappings[schemaVersionID] = expectedMappings

		// No DB call expected for mappings
		result, err := store.GetSourceMapppings(ctx, schemaID, version)

		require.NoError(t, err)
		assert.Equal(t, expectedMappings, result)
	})

	t.Run("get from DB and cache when not in cache", func(t *testing.T) {
		newSchemaID := "schema-2"
		newVersion := "v2"
		newSchemaVersionID := "sv-2"
		newSchemaVersion := &models.SchemaVersion{
			ID:       newSchemaVersionID,
			SchemaID: newSchemaID,
			Version:  newVersion,
		}
		newMappings := []*models.Mapping{
			{ID: "mapping-3", Type: "field"},
		}

		// First, GetSchemaVersion will be called
		mockDBClient.EXPECT().
			GetSchemaVersion(ctx, newSchemaID, newVersion).
			Return(newSchemaVersion, nil).
			Times(1)

		mockDBClient.EXPECT().
			GetMappingsBySchema(ctx, newSchemaID, newVersion, models.MappingOrientationSource).
			Return(newMappings, nil).
			Times(1)

		result, err := store.GetSourceMapppings(ctx, newSchemaID, newVersion)

		require.NoError(t, err)
		assert.Equal(t, newMappings, result)

		// Verify it was cached
		cachedMappings := store.(*SchemaStore).sourceMappings[newSchemaVersionID]
		assert.Equal(t, newMappings, cachedMappings)
	})

	t.Run("return error when GetSchemaVersion fails", func(t *testing.T) {
		errorSchemaID := "error-schema"
		errorVersion := "v1"
		expectedError := fmt.Errorf("schema version error")

		mockDBClient.EXPECT().
			GetSchemaVersion(ctx, errorSchemaID, errorVersion).
			Return(nil, expectedError).
			Times(1)

		result, err := store.GetSourceMapppings(ctx, errorSchemaID, errorVersion)

		require.Error(t, err)
		assert.Nil(t, result)
		assert.Contains(t, err.Error(), "get schema version")
	})

	t.Run("return error when GetMappingsBySchema fails", func(t *testing.T) {
		errorSchemaID := "error-schema-2"
		errorVersion := "v1"
		errorSchemaVersionID := "sv-error"
		errorSchemaVersion := &models.SchemaVersion{
			ID:       errorSchemaVersionID,
			SchemaID: errorSchemaID,
			Version:  errorVersion,
		}
		expectedError := fmt.Errorf("mappings error")

		mockDBClient.EXPECT().
			GetSchemaVersion(ctx, errorSchemaID, errorVersion).
			Return(errorSchemaVersion, nil).
			Times(1)

		mockDBClient.EXPECT().
			GetMappingsBySchema(ctx, errorSchemaID, errorVersion, models.MappingOrientationSource).
			Return(nil, expectedError).
			Times(1)

		result, err := store.GetSourceMapppings(ctx, errorSchemaID, errorVersion)

		require.Error(t, err)
		assert.Nil(t, result)
		assert.Contains(t, err.Error(), "failed to get source schema mapping from DB")
	})
}

func TestSchemaStore_GetDestinationMappings(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockDBClient := mocks.NewMockDBClient(ctrl)
	store := NewSchemaStore(mockDBClient)

	ctx := context.Background()
	schemaID := "schema-1"
	version := "v1"
	schemaVersionID := "sv-1"
	schemaVersion := &models.SchemaVersion{
		ID:       schemaVersionID,
		SchemaID: schemaID,
		Version:  version,
	}
	expectedMappings := []*models.Mapping{
		{ID: "mapping-1", Type: "field"},
		{ID: "mapping-2", Type: "transformation"},
	}

	t.Run("get from cache when available", func(t *testing.T) {
		// Pre-populate cache
		store.(*SchemaStore).schemaVersions[schemaID] = map[string]*models.SchemaVersion{
			version: schemaVersion,
		}
		store.(*SchemaStore).destinationMappings[schemaVersionID] = expectedMappings

		// No DB call expected for mappings
		result, err := store.GetDestinationMappings(ctx, schemaID, version)

		require.NoError(t, err)
		assert.Equal(t, expectedMappings, result)
	})

	t.Run("get from DB and cache when not in cache", func(t *testing.T) {
		newSchemaID := "schema-2"
		newVersion := "v2"
		newSchemaVersionID := "sv-2"
		newSchemaVersion := &models.SchemaVersion{
			ID:       newSchemaVersionID,
			SchemaID: newSchemaID,
			Version:  newVersion,
		}
		newMappings := []*models.Mapping{
			{ID: "mapping-3", Type: "field"},
		}

		// First, GetSchemaVersion will be called
		mockDBClient.EXPECT().
			GetSchemaVersion(ctx, newSchemaID, newVersion).
			Return(newSchemaVersion, nil).
			Times(1)

		mockDBClient.EXPECT().
			GetMappingsBySchema(ctx, newSchemaID, newVersion, models.MappingOrientationDestination).
			Return(newMappings, nil).
			Times(1)

		result, err := store.GetDestinationMappings(ctx, newSchemaID, newVersion)

		require.NoError(t, err)
		assert.Equal(t, newMappings, result)

		// Verify it was cached
		cachedMappings := store.(*SchemaStore).destinationMappings[newSchemaVersionID]
		assert.Equal(t, newMappings, cachedMappings)
	})

	t.Run("return error when GetSchemaVersion fails", func(t *testing.T) {
		errorSchemaID := "error-schema"
		errorVersion := "v1"
		expectedError := fmt.Errorf("schema version error")

		mockDBClient.EXPECT().
			GetSchemaVersion(ctx, errorSchemaID, errorVersion).
			Return(nil, expectedError).
			Times(1)

		result, err := store.GetDestinationMappings(ctx, errorSchemaID, errorVersion)

		require.Error(t, err)
		assert.Nil(t, result)
		assert.Contains(t, err.Error(), "get schema version")
	})

	t.Run("return error when GetMappingsBySchema fails", func(t *testing.T) {
		errorSchemaID := "error-schema-2"
		errorVersion := "v1"
		errorSchemaVersionID := "sv-error"
		errorSchemaVersion := &models.SchemaVersion{
			ID:       errorSchemaVersionID,
			SchemaID: errorSchemaID,
			Version:  errorVersion,
		}
		expectedError := fmt.Errorf("mappings error")

		mockDBClient.EXPECT().
			GetSchemaVersion(ctx, errorSchemaID, errorVersion).
			Return(errorSchemaVersion, nil).
			Times(1)

		mockDBClient.EXPECT().
			GetMappingsBySchema(ctx, errorSchemaID, errorVersion, models.MappingOrientationDestination).
			Return(nil, expectedError).
			Times(1)

		result, err := store.GetDestinationMappings(ctx, errorSchemaID, errorVersion)

		require.Error(t, err)
		assert.Nil(t, result)
		assert.Contains(t, err.Error(), "failed to get destination schema mapping from DB")
	})
}

func TestNewSchemaStore(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockDBClient := mocks.NewMockDBClient(ctrl)

	store := NewSchemaStore(mockDBClient)

	require.NotNil(t, store)

	schemaStore, ok := store.(*SchemaStore)
	require.True(t, ok)

	assert.NotNil(t, schemaStore.schemas)
	assert.NotNil(t, schemaStore.schemaVersions)
	assert.NotNil(t, schemaStore.latestVersions)
	assert.NotNil(t, schemaStore.sourceMappings)
	assert.NotNil(t, schemaStore.destinationMappings)
	assert.Equal(t, mockDBClient, schemaStore.dbStoreClient)
}

// Integration test to verify cache consistency across multiple operations
func TestSchemaStore_CacheConsistency(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockDBClient := mocks.NewMockDBClient(ctrl)
	store := NewSchemaStore(mockDBClient)

	ctx := context.Background()
	schemaID := "schema-1"
	version := "v1"
	schemaVersionID := "sv-1"

	schemaVersion := &models.SchemaVersion{
		ID:        schemaVersionID,
		SchemaID:  schemaID,
		Version:   version,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	sourceMappings := []*models.Mapping{
		{ID: "src-mapping-1", Type: "field"},
	}

	destinationMappings := []*models.Mapping{
		{ID: "dst-mapping-1", Type: "field"},
	}

	// Save schema version
	mockDBClient.EXPECT().
		SaveSchemaVersion(ctx, *schemaVersion, sourceMappings, destinationMappings).
		Return(nil).
		Times(1)

	err := store.SaveSchemaVersion(ctx, *schemaVersion, sourceMappings, destinationMappings)
	require.NoError(t, err)

	// Get schema version should return from cache without DB call
	result, err := store.GetSchemaVersion(ctx, schemaID, version)
	require.NoError(t, err)
	assert.Equal(t, schemaVersion, result)

	// Prepare for mappings retrieval
	mockDBClient.EXPECT().
		GetMappingsBySchema(ctx, schemaID, version, models.MappingOrientationSource).
		Return(sourceMappings, nil).
		Times(1)

	// Get source mappings - should fetch from DB first time
	srcMaps, err := store.GetSourceMapppings(ctx, schemaID, version)
	require.NoError(t, err)
	assert.Equal(t, sourceMappings, srcMaps)

	// Second call should use cache, no DB call
	srcMaps2, err := store.GetSourceMapppings(ctx, schemaID, version)
	require.NoError(t, err)
	assert.Equal(t, sourceMappings, srcMaps2)
}
