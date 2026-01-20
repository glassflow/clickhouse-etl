package mocks

import (
	"context"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

type MockDBClient struct {
	GetSchemaVersionFunc       func(ctx context.Context, pipelineID, sourceID, versionID string) (*models.SchemaVersion, error)
	GetLatestSchemaVersionFunc func(ctx context.Context, pipelineID, sourceID string) (*models.SchemaVersion, error)
	SaveNewSchemaVersionFunc   func(ctx context.Context, pipelineID, sourceID, oldVersionID, newVersionID string) error
}

func NewMockDBClient() *MockDBClient {
	return &MockDBClient{}
}

func (m *MockDBClient) GetSchemaVersion(ctx context.Context, pipelineID, sourceID, versionID string) (*models.SchemaVersion, error) {
	if m.GetSchemaVersionFunc != nil {
		return m.GetSchemaVersionFunc(ctx, pipelineID, sourceID, versionID)
	}
	return nil, nil
}

func (m *MockDBClient) GetLatestSchemaVersion(ctx context.Context, pipelineID, sourceID string) (*models.SchemaVersion, error) {
	if m.GetLatestSchemaVersionFunc != nil {
		return m.GetLatestSchemaVersionFunc(ctx, pipelineID, sourceID)
	}
	return nil, nil
}

func (m *MockDBClient) SaveNewSchemaVersion(ctx context.Context, pipelineID, sourceID, oldVersionID, newVersionID string) error {
	if m.SaveNewSchemaVersionFunc != nil {
		return m.SaveNewSchemaVersionFunc(ctx, pipelineID, sourceID, oldVersionID, newVersionID)
	}
	return nil
}

type MockSchemaRegistryClient struct {
	GetSchemaFunc func(ctx context.Context, schemaID int) ([]models.Field, error)
}

func NewMockSchemaRegistryClient() *MockSchemaRegistryClient {
	return &MockSchemaRegistryClient{}
}

func (m *MockSchemaRegistryClient) GetSchema(ctx context.Context, schemaID int) ([]models.Field, error) {
	if m.GetSchemaFunc != nil {
		return m.GetSchemaFunc(ctx, schemaID)
	}
	return nil, nil
}
