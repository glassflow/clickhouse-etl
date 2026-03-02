package testutils

import (
	"context"
	"fmt"
	"log/slog"
	"sync"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

// MockDBClient is an in-memory mock implementation of schemav2.DBClient for e2e tests
type MockDBClient struct {
	mu       sync.RWMutex
	versions map[string]*models.SchemaVersion // key: "pipelineID:sourceID:versionID"
	latest   map[string]string                // key: "pipelineID:sourceID" -> versionID
	logger   *slog.Logger
}

// NewMockDBClient creates a new mock DB client
func NewMockDBClient() *MockDBClient {
	return &MockDBClient{
		versions: make(map[string]*models.SchemaVersion),
		latest:   make(map[string]string),
	}
}

func (m *MockDBClient) SetLogger(logger *slog.Logger) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if logger == nil {
		return fmt.Errorf("logger cannot be nil")
	}

	m.logger = logger
	return nil
}

func (m *MockDBClient) key(pipelineID, sourceID, versionID string) string {
	return fmt.Sprintf("%s:%s:%s", pipelineID, sourceID, versionID)
}

func (m *MockDBClient) latestKey(pipelineID, sourceID string) string {
	return fmt.Sprintf("%s:%s", pipelineID, sourceID)
}

// AddSchemaVersion adds a schema version to the mock store
func (m *MockDBClient) AddSchemaVersion(pipelineID string, sv models.SchemaVersion) {
	m.mu.Lock()
	defer m.mu.Unlock()

	key := m.key(pipelineID, sv.SourceID, sv.VersionID)
	m.versions[key] = &sv

	// Update latest version
	latestKey := m.latestKey(pipelineID, sv.SourceID)
	m.latest[latestKey] = sv.VersionID
}

// GetSchemaVersion implements DBClient interface
func (m *MockDBClient) GetSchemaVersion(ctx context.Context, pipelineID, sourceID, versionID string) (*models.SchemaVersion, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	m.logger.Debug("Getting schema version",
		slog.String("pipelineID", pipelineID),
		slog.String("sourceID", sourceID),
		slog.String("versionID", versionID),
	)

	key := m.key(pipelineID, sourceID, versionID)
	if sv, ok := m.versions[key]; ok {
		m.logger.Debug("Found schema version",
			slog.String("pipelineID", pipelineID),
			slog.String("sourceID", sourceID),
			slog.String("versionID", versionID),
			slog.Any("schemaVersion", sv),
		)
		return sv, nil
	}

	m.logger.Debug("Schema version not found",
		slog.String("pipelineID", pipelineID),
		slog.String("sourceID", sourceID),
		slog.String("versionID", versionID),
	)

	return nil, models.ErrSchemaVerionNotFound
}

// GetLatestSchemaVersion implements DBClient interface
func (m *MockDBClient) GetLatestSchemaVersion(ctx context.Context, pipelineID, sourceID string) (*models.SchemaVersion, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	m.logger.Debug("Getting latest schema version",
		slog.String("pipelineID", pipelineID),
		slog.String("sourceID", sourceID),
	)

	latestKey := m.latestKey(pipelineID, sourceID)
	versionID, ok := m.latest[latestKey]
	if !ok {
		m.logger.Debug("Latest schema version key was not found",
			slog.String("pipelineID", pipelineID),
			slog.String("sourceID", sourceID),
		)
		return nil, models.ErrRecordNotFound
	}

	key := m.key(pipelineID, sourceID, versionID)
	if sv, ok := m.versions[key]; ok {
		m.logger.Debug("Found latest schema version",
			slog.String("pipelineID", pipelineID),
			slog.String("sourceID", sourceID),
			slog.String("versionID", versionID),
			slog.Any("schemaVersion", sv),
		)
		return sv, nil
	}

	m.logger.Debug("Latest schema version not found",
		slog.String("pipelineID", pipelineID),
		slog.String("sourceID", sourceID),
	)

	return nil, models.ErrRecordNotFound
}

// SaveNewSchemaVersion implements DBClient interface
func (m *MockDBClient) SaveNewSchemaVersion(ctx context.Context, pipelineID, sourceID, oldVersionID, newVersionID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Get the old version to copy fields
	oldKey := m.key(pipelineID, sourceID, oldVersionID)
	oldSV, ok := m.versions[oldKey]
	if !ok {
		return fmt.Errorf("old schema version %s not found", oldVersionID)
	}

	// Create new version with same fields
	newSV := &models.SchemaVersion{
		SourceID:  sourceID,
		VersionID: newVersionID,
		DataType:  oldSV.DataType,
		Fields:    oldSV.Fields,
	}

	newKey := m.key(pipelineID, sourceID, newVersionID)
	m.versions[newKey] = newSV

	// Update latest
	latestKey := m.latestKey(pipelineID, sourceID)
	m.latest[latestKey] = newVersionID

	return nil
}

// Clear removes all stored schema versions
func (m *MockDBClient) Clear() {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.versions = make(map[string]*models.SchemaVersion)
	m.latest = make(map[string]string)
}

// MockSchemaRegistryClient is a mock implementation of SchemaRegistryClient for e2e tests
type MockSchemaRegistryClient struct {
	mu      sync.RWMutex
	schemas map[int][]models.Field // key: schemaID -> fields
	logger  *slog.Logger
}

// NewMockSchemaRegistryClient creates a new mock schema registry client
func NewMockSchemaRegistryClient(logger *slog.Logger) *MockSchemaRegistryClient {
	return &MockSchemaRegistryClient{
		schemas: make(map[int][]models.Field),
		logger:  logger,
	}
}

// AddSchema adds a schema to the mock registry
func (m *MockSchemaRegistryClient) AddSchema(schemaID int, fields []models.Field) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.schemas[schemaID] = fields
}

// GetSchema implements SchemaRegistryClient interface
func (m *MockSchemaRegistryClient) GetSchema(ctx context.Context, schemaID int) ([]models.Field, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	m.logger.Debug("Requested schema",
		slog.Int("schemaID", schemaID),
	)

	if fields, ok := m.schemas[schemaID]; ok {
		m.logger.Debug("Found schema",
			slog.Int("schemaID", schemaID),
			slog.Any("fields", fields),
		)
		return fields, nil
	}

	m.logger.Debug("Schema not found",
		slog.Int("schemaID", schemaID),
	)

	return nil, models.ErrSchemaNotFound
}

// Clear removes all stored schemas
func (m *MockSchemaRegistryClient) Clear() {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.schemas = make(map[int][]models.Field)
}
