package mapper

import (
	"context"
	"errors"
	"testing"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// mockDBClient is a mock implementation of DBClient interface for testing
type mockDBClient struct {
	getMapping      func(ctx context.Context, pipelineID, mappingType string) (*models.Mapping, error)
	getMappingCalls int
}

func (m *mockDBClient) GetMapping(ctx context.Context, pipelineID, mappingType string) (*models.Mapping, error) {
	m.getMappingCalls++
	if m.getMapping != nil {
		return m.getMapping(ctx, pipelineID, mappingType)
	}
	return nil, errors.New("not implemented")
}

func TestNewMappingStore(t *testing.T) {
	dbClient := &mockDBClient{}
	pipelineID := "pipeline-123"
	mappingType := "one_to_one"

	store := NewMappingStore(dbClient, pipelineID, mappingType)

	require.NotNil(t, store)

	// Verify the store is of the correct type
	mappingStore, ok := store.(*MappingStore)
	require.True(t, ok)
	assert.Equal(t, pipelineID, mappingStore.pipelineID)
	assert.Equal(t, mappingType, mappingStore.mappingType)
	assert.Equal(t, dbClient, mappingStore.dbClient)
	assert.Nil(t, mappingStore.mapping)
}

func TestMappingStore_GetMapping_Success(t *testing.T) {
	expectedMapping := &models.Mapping{
		ID:   "mapping-123",
		Type: "one_to_one",
		Fields: []models.MappingField{
			{
				SourceID:         "source1",
				SourceField:      "user_name",
				SourceType:       "string",
				DestinationField: "name",
				DestinationType:  "String",
			},
		},
		PipelineID: "pipeline-123",
	}

	dbClient := &mockDBClient{
		getMapping: func(ctx context.Context, pipelineID, mappingType string) (*models.Mapping, error) {
			assert.Equal(t, "pipeline-123", pipelineID)
			assert.Equal(t, "one_to_one", mappingType)
			return expectedMapping, nil
		},
	}

	store := NewMappingStore(dbClient, "pipeline-123", "one_to_one")

	mapping, err := store.GetMapping(context.Background())
	require.NoError(t, err)
	assert.Equal(t, expectedMapping, mapping)
	assert.Equal(t, 1, dbClient.getMappingCalls)
}

func TestMappingStore_GetMapping_Error(t *testing.T) {
	expectedError := errors.New("database connection failed")

	dbClient := &mockDBClient{
		getMapping: func(ctx context.Context, pipelineID, mappingType string) (*models.Mapping, error) {
			return nil, expectedError
		},
	}

	store := NewMappingStore(dbClient, "pipeline-123", "one_to_one")

	mapping, err := store.GetMapping(context.Background())
	require.Error(t, err)
	assert.Nil(t, mapping)
	assert.Equal(t, expectedError, err)
	assert.Equal(t, 1, dbClient.getMappingCalls)
}

func TestMappingStore_GetMapping_Caching(t *testing.T) {
	expectedMapping := &models.Mapping{
		ID:   "mapping-123",
		Type: "one_to_one",
		Fields: []models.MappingField{
			{
				SourceID:         "source1",
				SourceField:      "user_name",
				SourceType:       "string",
				DestinationField: "name",
				DestinationType:  "String",
			},
		},
		PipelineID: "pipeline-123",
	}

	dbClient := &mockDBClient{
		getMapping: func(ctx context.Context, pipelineID, mappingType string) (*models.Mapping, error) {
			return expectedMapping, nil
		},
	}

	store := NewMappingStore(dbClient, "pipeline-123", "one_to_one")

	// First call - should hit the database
	mapping1, err := store.GetMapping(context.Background())
	require.NoError(t, err)
	assert.Equal(t, expectedMapping, mapping1)
	assert.Equal(t, 1, dbClient.getMappingCalls)

	// Second call - should use cached value
	mapping2, err := store.GetMapping(context.Background())
	require.NoError(t, err)
	assert.Equal(t, expectedMapping, mapping2)
	assert.Equal(t, 1, dbClient.getMappingCalls) // Should still be 1

	// Third call - should still use cached value
	mapping3, err := store.GetMapping(context.Background())
	require.NoError(t, err)
	assert.Equal(t, expectedMapping, mapping3)
	assert.Equal(t, 1, dbClient.getMappingCalls) // Should still be 1

	// Verify all returned mappings are the same instance
	assert.Same(t, mapping1, mapping2)
	assert.Same(t, mapping2, mapping3)
}

func TestMappingStore_GetMapping_ContextCancellation(t *testing.T) {
	dbClient := &mockDBClient{
		getMapping: func(ctx context.Context, pipelineID, mappingType string) (*models.Mapping, error) {
			// Simulate checking context
			if ctx.Err() != nil {
				return nil, ctx.Err()
			}
			return &models.Mapping{
				ID:         "mapping-123",
				Type:       "one_to_one",
				PipelineID: pipelineID,
			}, nil
		},
	}

	store := NewMappingStore(dbClient, "pipeline-123", "one_to_one")

	// Create a canceled context
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	mapping, err := store.GetMapping(ctx)
	require.Error(t, err)
	assert.Nil(t, mapping)
	assert.Equal(t, context.Canceled, err)
}

func TestMappingStore_GetMapping_DifferentStores(t *testing.T) {
	mapping1 := &models.Mapping{
		ID:         "mapping-1",
		Type:       "one_to_one",
		PipelineID: "pipeline-1",
	}

	mapping2 := &models.Mapping{
		ID:         "mapping-2",
		Type:       "many_to_one",
		PipelineID: "pipeline-2",
	}

	dbClient := &mockDBClient{
		getMapping: func(ctx context.Context, pipelineID, mappingType string) (*models.Mapping, error) {
			if pipelineID == "pipeline-1" && mappingType == "one_to_one" {
				return mapping1, nil
			}
			if pipelineID == "pipeline-2" && mappingType == "many_to_one" {
				return mapping2, nil
			}
			return nil, errors.New("mapping not found")
		},
	}

	store1 := NewMappingStore(dbClient, "pipeline-1", "one_to_one")
	store2 := NewMappingStore(dbClient, "pipeline-2", "many_to_one")

	// Get mapping from first store
	result1, err := store1.GetMapping(context.Background())
	require.NoError(t, err)
	assert.Equal(t, mapping1, result1)

	// Get mapping from second store
	result2, err := store2.GetMapping(context.Background())
	require.NoError(t, err)
	assert.Equal(t, mapping2, result2)

	// Verify each store has its own cache
	assert.NotEqual(t, result1, result2)
	assert.Equal(t, 2, dbClient.getMappingCalls)
}
