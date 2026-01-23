package mocks

import (
	"context"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

type MockDBClient struct {
	GetStatelessTransformationConfigFunc func(ctx context.Context, pipelineID, sourceID, sourceSchemaVersion string) (*models.TransformationConfig, error)
	GetJoinConfigFunc                    func(ctx context.Context, pipelineID, sourceID, sourceSchemaVersion string) (*models.JoinConfig, error)
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

func (m *MockDBClient) GetJoinConfig(ctx context.Context, pipelineID, sourceID, sourceSchemaVersion string) (*models.JoinConfig, error) {
	if m.GetJoinConfigFunc != nil {
		return m.GetJoinConfigFunc(ctx, pipelineID, sourceID, sourceSchemaVersion)
	}
	return nil, nil
}

func (m *MockDBClient) GetSinkConfig(ctx context.Context, pipelineID, sourceID, sourceSchemaVersion string) (*models.SinkConfig, error) {
	if m.GetSinkConfigFunc != nil {
		return m.GetSinkConfigFunc(ctx, pipelineID, sourceID, sourceSchemaVersion)
	}
	return nil, nil
}
