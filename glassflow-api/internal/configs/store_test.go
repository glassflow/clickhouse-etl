package configs

import (
	"context"
	"errors"
	"testing"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/configs/mocks"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/stretchr/testify/assert"
)

func TestConfigStore_GetStatelessTransformationConfig(t *testing.T) {
	ctx := context.Background()
	pipelineID := "test-pipeline"
	sourceID := "test-source"
	sourceSchemaVersion := "1"

	transformConfig := &models.TransformationConfig{
		SourceID:              sourceID,
		SourceSchemaVersionID: sourceSchemaVersion,
		TransfromationID:      "transform-1",
		OutputSchemaVersionID: "1",
		Config: []models.Transform{
			{Expression: "user_id", OutputName: "user_id", OutputType: "string"},
		},
	}

	t.Run("returns cached config", func(t *testing.T) {
		mockDB := mocks.NewMockDBClient()
		store := NewConfigStore(mockDB, pipelineID, sourceID).(*ConfigStore)

		// Pre-populate cache
		store.statelessTransfromationConigs[sourceSchemaVersion] = transformConfig

		result, err := store.GetStatelessTransformationConfig(ctx, pipelineID, sourceID, sourceSchemaVersion)

		assert.NoError(t, err)
		assert.Equal(t, transformConfig, result)
	})

	t.Run("fetches from database when not cached", func(t *testing.T) {
		mockDB := mocks.NewMockDBClient()
		mockDB.GetStatelessTransformationConfigFunc = func(ctx context.Context, pipelineIDArg, sourceIDArg, sourceSchemaVersionArg string) (*models.TransformationConfig, error) {
			return transformConfig, nil
		}

		store := NewConfigStore(mockDB, pipelineID, sourceID)

		result, err := store.GetStatelessTransformationConfig(ctx, pipelineID, sourceID, sourceSchemaVersion)

		assert.NoError(t, err)
		assert.Equal(t, transformConfig, result)
	})

	t.Run("returns error on database failure", func(t *testing.T) {
		mockDB := mocks.NewMockDBClient()
		dbErr := errors.New("database error")
		mockDB.GetStatelessTransformationConfigFunc = func(ctx context.Context, pipelineIDArg, sourceIDArg, sourceSchemaVersionArg string) (*models.TransformationConfig, error) {
			return nil, dbErr
		}

		store := NewConfigStore(mockDB, pipelineID, sourceID)

		result, err := store.GetStatelessTransformationConfig(ctx, pipelineID, sourceID, sourceSchemaVersion)

		assert.Error(t, err)
		assert.Nil(t, result)
		assert.Contains(t, err.Error(), "get stateless transformation config")
	})

	t.Run("returns ErrRecordNotFound", func(t *testing.T) {
		mockDB := mocks.NewMockDBClient()
		dbErr := models.ErrRecordNotFound
		mockDB.GetStatelessTransformationConfigFunc = func(ctx context.Context, pipelineIDArg, sourceIDArg, sourceSchemaVersionArg string) (*models.TransformationConfig, error) {
			return nil, dbErr
		}

		store := NewConfigStore(mockDB, pipelineID, sourceID)

		result, err := store.GetStatelessTransformationConfig(ctx, pipelineID, sourceID, sourceSchemaVersion)

		assert.Error(t, err)
		assert.True(t, errors.Is(err, models.ErrConfigNotFound))
		assert.Nil(t, result)
	})

	t.Run("caches fetched config", func(t *testing.T) {
		mockDB := mocks.NewMockDBClient()
		callCount := 0
		mockDB.GetStatelessTransformationConfigFunc = func(ctx context.Context, pipelineIDArg, sourceIDArg, sourceSchemaVersionArg string) (*models.TransformationConfig, error) {
			callCount++
			return transformConfig, nil
		}

		store := NewConfigStore(mockDB, pipelineID, sourceID)

		// First call - fetches from DB
		result1, err := store.GetStatelessTransformationConfig(ctx, pipelineID, sourceID, sourceSchemaVersion)
		assert.NoError(t, err)
		assert.Equal(t, transformConfig, result1)

		// Second call - should use cache (no additional DB call expected)
		result2, err := store.GetStatelessTransformationConfig(ctx, pipelineID, sourceID, sourceSchemaVersion)
		assert.NoError(t, err)
		assert.Equal(t, transformConfig, result2)

		// Verify DB was only called once
		assert.Equal(t, 1, callCount)
	})
}

func TestConfigStore_GetJoinConfig(t *testing.T) {
	ctx := context.Background()
	pipelineID := "test-pipeline"
	sourceID1 := "users-1"
	schemaVersionID1 := "1101"
	sourceID2 := "events-1"
	schemaVersionID2 := "2001"

	joinConfigs := []models.JoinConfig{
		{
			SourceID:              sourceID1,
			SourceSchemaVersionID: schemaVersionID1,
			JoinID:                "join-1",
			OutputSchemaVersionID: "1",
			Config: []models.JoinRule{
				{SourceID: sourceID1, SourceName: "name", OutputName: "name"},
				{SourceID: sourceID1, SourceName: "user_id", OutputName: "user_id"},
			},
		},
		{
			SourceID:              sourceID2,
			SourceSchemaVersionID: schemaVersionID2,
			JoinID:                "join-1",
			OutputSchemaVersionID: "1",
			Config: []models.JoinRule{
				{SourceID: sourceID2, SourceName: "name", OutputName: "event"},
			},
		},
	}

	expectedAuxConfig := &models.JoinAuxConfig{
		OutputSchemaVersionID: "1",
		SourceJoinRules: map[string]map[string]string{
			sourceID1: {
				"name":    "name",
				"user_id": "user_id",
			},
			sourceID2: {
				"name": "event",
			},
		},
	}

	t.Run("returns cached config", func(t *testing.T) {
		mockDB := mocks.NewMockDBClient()
		store := NewConfigStore(mockDB, pipelineID, sourceID1).(*ConfigStore)

		// Pre-populate cache
		cacheKey := sourceID1 + schemaVersionID1 + sourceID2 + schemaVersionID2
		store.joinConfigs[cacheKey] = expectedAuxConfig

		result, err := store.GetJoinConfig(ctx, sourceID1, schemaVersionID1, sourceID2, schemaVersionID2)

		assert.NoError(t, err)
		assert.Equal(t, expectedAuxConfig, result)
	})

	t.Run("fetches from database when not cached", func(t *testing.T) {
		mockDB := mocks.NewMockDBClient()
		mockDB.GetJoinConfigsFunc = func(ctx context.Context, pipelineIDArg, sourceID1Arg, schemaVersionID1Arg, sourceID2Arg, schemaVersionID2Arg string) ([]models.JoinConfig, error) {
			return joinConfigs, nil
		}

		store := NewConfigStore(mockDB, pipelineID, sourceID1)

		result, err := store.GetJoinConfig(ctx, sourceID1, schemaVersionID1, sourceID2, schemaVersionID2)

		assert.NoError(t, err)
		assert.Equal(t, expectedAuxConfig, result)
	})

	t.Run("returns error on database failure", func(t *testing.T) {
		mockDB := mocks.NewMockDBClient()
		dbErr := errors.New("database error")
		mockDB.GetJoinConfigsFunc = func(ctx context.Context, pipelineIDArg, sourceID1Arg, schemaVersionID1Arg, sourceID2Arg, schemaVersionID2Arg string) ([]models.JoinConfig, error) {
			return nil, dbErr
		}

		store := NewConfigStore(mockDB, pipelineID, sourceID1)

		result, err := store.GetJoinConfig(ctx, sourceID1, schemaVersionID1, sourceID2, schemaVersionID2)

		assert.Error(t, err)
		assert.Nil(t, result)
		assert.Contains(t, err.Error(), "get join config")
	})

	t.Run("returns ErrRecordNotFound", func(t *testing.T) {
		mockDB := mocks.NewMockDBClient()
		dbErr := models.ErrRecordNotFound
		mockDB.GetJoinConfigsFunc = func(ctx context.Context, pipelineIDArg, sourceID1Arg, schemaVersionID1Arg, sourceID2Arg, schemaVersionID2Arg string) ([]models.JoinConfig, error) {
			return nil, dbErr
		}

		store := NewConfigStore(mockDB, pipelineID, sourceID1)

		result, err := store.GetJoinConfig(ctx, sourceID1, schemaVersionID1, sourceID2, schemaVersionID2)

		assert.Error(t, err)
		assert.True(t, errors.Is(err, models.ErrConfigNotFound))
		assert.Nil(t, result)
	})

	t.Run("caches fetched config", func(t *testing.T) {
		mockDB := mocks.NewMockDBClient()
		callCount := 0
		mockDB.GetJoinConfigsFunc = func(ctx context.Context, pipelineIDArg, sourceID1Arg, schemaVersionID1Arg, sourceID2Arg, schemaVersionID2Arg string) ([]models.JoinConfig, error) {
			callCount++
			return joinConfigs, nil
		}

		store := NewConfigStore(mockDB, pipelineID, sourceID1)

		// First call - fetches from DB
		result1, err := store.GetJoinConfig(ctx, sourceID1, schemaVersionID1, sourceID2, schemaVersionID2)
		assert.NoError(t, err)
		assert.Equal(t, expectedAuxConfig, result1)

		// Second call - should use cache (no additional DB call expected)
		result2, err := store.GetJoinConfig(ctx, sourceID1, schemaVersionID1, sourceID2, schemaVersionID2)
		assert.NoError(t, err)
		assert.Equal(t, expectedAuxConfig, result2)

		// Verify DB was only called once
		assert.Equal(t, 1, callCount)
	})
}

func TestConfigStore_GetSinkConfig(t *testing.T) {
	ctx := context.Background()
	pipelineID := "test-pipeline"
	sourceID := "test-source"
	sourceSchemaVersion := "1"

	sinkConfig := &models.SinkConfig{
		SourceID:              sourceID,
		SourceSchemaVersionID: sourceSchemaVersion,
		Config: []models.Mapping{
			{
				SourceField:      "user_id",
				SourceType:       "string",
				DestinationField: "user_id",
				DestinationType:  "UUID",
			},
		},
	}

	t.Run("returns cached config", func(t *testing.T) {
		mockDB := mocks.NewMockDBClient()
		store := NewConfigStore(mockDB, pipelineID, sourceID).(*ConfigStore)

		// Pre-populate cache
		store.sinkConfigs[sourceSchemaVersion] = sinkConfig

		result, err := store.GetSinkConfig(ctx, pipelineID, sourceID, sourceSchemaVersion)

		assert.NoError(t, err)
		assert.Equal(t, sinkConfig, result)
	})

	t.Run("fetches from database when not cached", func(t *testing.T) {
		mockDB := mocks.NewMockDBClient()
		mockDB.GetSinkConfigFunc = func(ctx context.Context, pipelineIDArg, sourceIDArg, sourceSchemaVersionArg string) (*models.SinkConfig, error) {
			return sinkConfig, nil
		}

		store := NewConfigStore(mockDB, pipelineID, sourceID)

		result, err := store.GetSinkConfig(ctx, pipelineID, sourceID, sourceSchemaVersion)

		assert.NoError(t, err)
		assert.Equal(t, sinkConfig, result)
	})

	t.Run("returns error on database failure", func(t *testing.T) {
		mockDB := mocks.NewMockDBClient()
		dbErr := errors.New("database error")
		mockDB.GetSinkConfigFunc = func(ctx context.Context, pipelineIDArg, sourceIDArg, sourceSchemaVersionArg string) (*models.SinkConfig, error) {
			return nil, dbErr
		}

		store := NewConfigStore(mockDB, pipelineID, sourceID)

		result, err := store.GetSinkConfig(ctx, pipelineID, sourceID, sourceSchemaVersion)

		assert.Error(t, err)
		assert.Nil(t, result)
		assert.Contains(t, err.Error(), "get sink config")
	})

	t.Run("returns ErrRecordNotFound", func(t *testing.T) {
		mockDB := mocks.NewMockDBClient()
		dbErr := models.ErrRecordNotFound
		mockDB.GetSinkConfigFunc = func(ctx context.Context, pipelineIDArg, sourceIDArg, sourceSchemaVersionArg string) (*models.SinkConfig, error) {
			return nil, dbErr
		}

		store := NewConfigStore(mockDB, pipelineID, sourceID)

		result, err := store.GetSinkConfig(ctx, pipelineID, sourceID, sourceSchemaVersion)

		assert.Error(t, err)
		assert.True(t, errors.Is(err, models.ErrConfigNotFound))
		assert.Nil(t, result)
	})

	t.Run("caches fetched config", func(t *testing.T) {
		mockDB := mocks.NewMockDBClient()
		callCount := 0
		mockDB.GetSinkConfigFunc = func(ctx context.Context, pipelineIDArg, sourceIDArg, sourceSchemaVersionArg string) (*models.SinkConfig, error) {
			callCount++
			return sinkConfig, nil
		}

		store := NewConfigStore(mockDB, pipelineID, sourceID)

		// First call - fetches from DB
		result1, err := store.GetSinkConfig(ctx, pipelineID, sourceID, sourceSchemaVersion)
		assert.NoError(t, err)
		assert.Equal(t, sinkConfig, result1)

		// Second call - should use cache (no additional DB call expected)
		result2, err := store.GetSinkConfig(ctx, pipelineID, sourceID, sourceSchemaVersion)
		assert.NoError(t, err)
		assert.Equal(t, sinkConfig, result2)

		// Verify DB was only called once
		assert.Equal(t, 1, callCount)
	})
}

func TestNewConfigStore(t *testing.T) {
	mockDB := mocks.NewMockDBClient()
	pipelineID := "test-pipeline"
	sourceID := "test-source"

	store := NewConfigStore(mockDB, pipelineID, sourceID)

	assert.NotNil(t, store)
}
