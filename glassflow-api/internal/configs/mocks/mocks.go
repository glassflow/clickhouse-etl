package mocks

import (
	"context"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

type MockDBClient struct {
	GetStatelessTransformationConfigFunc func(ctx context.Context, pipelineID, sourceID, sourceSchemaVersion string) (*models.TransformationConfig, error)
	GetJoinConfigsFunc                   func(ctx context.Context, pipelineID, sourceID1, schemaVersionID1, sourceID2, schemaVersionID2 string) ([]models.JoinConfig, error)
	GetSinkConfigFunc                    func(ctx context.Context, pipelineID, sourceID, sourceSchemaVersion string) (*models.SinkConfig, error)
}

func NewMockDBClient() *MockDBClient {
	return &MockDBClient{}
}

func (m *MockDBClient) GetStatelessTransformationConfig(ctx context.Context, pipelineID, sourceID, sourceSchemaVersion string) (*models.TransformationConfig, error) {
	if m.GetStatelessTransformationConfigFunc != nil {
		return m.GetStatelessTransformationConfigFunc(ctx, pipelineID, sourceID, sourceSchemaVersion)
	}
	return nil, nil
}

func (m *MockDBClient) GetJoinConfigs(ctx context.Context, pipelineID, sourceID1, schemaVersionID1, sourceID2, schemaVersionID2 string) ([]models.JoinConfig, error) {
	if m.GetJoinConfigsFunc != nil {
		return m.GetJoinConfigsFunc(ctx, pipelineID, sourceID1, schemaVersionID1, sourceID2, schemaVersionID2)
	}
	return nil, nil
}

func (m *MockDBClient) GetSinkConfig(ctx context.Context, pipelineID, sourceID, sourceSchemaVersion string) (*models.SinkConfig, error) {
	if m.GetSinkConfigFunc != nil {
		return m.GetSinkConfigFunc(ctx, pipelineID, sourceID, sourceSchemaVersion)
	}
	return nil, nil
}
