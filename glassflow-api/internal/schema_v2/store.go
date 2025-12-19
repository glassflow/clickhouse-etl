package schemav2

import (
	"context"
	"fmt"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

var ErrSchemaVerionNotFound = fmt.Errorf("schema version not found")

//go:generate mockgen -destination ./mocks/dbclient_mock.go -package mocks . DBClient
type DBClient interface {
	GetSchema(ctx context.Context, schemaID string) (*models.SchemaV2, error)
	GetSchemaVersion(ctx context.Context, schemaID, version string) (*models.SchemaVersion, error)
	GetLatestSchemaVersion(ctx context.Context, schemaID string) (*models.SchemaVersion, error)
	SaveSchemaVersion(ctx context.Context, schemaVersion models.SchemaVersion, sourceMappings, destinationMappings []*models.SchemaMapping) error
	GetMappingsBySchema(ctx context.Context, sourceID, schemaID string, orientation models.MappingOrintation) ([]*models.SchemaMapping, error)
}

type Store interface {
	GetSchema(ctx context.Context, schemaID string) (*models.SchemaV2, error)
	GetSchemaVersion(ctx context.Context, name, version string) (*models.SchemaVersion, error)
	GetLatestSchemaVersion(ctx context.Context, name string) (*models.SchemaVersion, error)
	SaveSchemaVersion(ctx context.Context, schemaVersion models.SchemaVersion, sourceMappings, destinationMappings []*models.SchemaMapping) error
	GetSourceMapppings(ctx context.Context, schemaID, version string) ([]*models.SchemaMapping, error)
	GetDestinationMappings(ctx context.Context, schemaID, version string) ([]*models.SchemaMapping, error)
}

type SchemaStore struct {
	schemas             map[string]*models.SchemaV2
	schemaVersions      map[string]map[string]*models.SchemaVersion
	latestVersions      map[string]string
	sourceMappings      map[string][]*models.SchemaMapping
	destinationMappings map[string][]*models.SchemaMapping
	dbStoreClient       DBClient
}

func NewSchemaStore(dbClient DBClient) Store {
	return &SchemaStore{
		schemas:             make(map[string]*models.SchemaV2),
		schemaVersions:      make(map[string]map[string]*models.SchemaVersion),
		latestVersions:      make(map[string]string),
		sourceMappings:      make(map[string][]*models.SchemaMapping),
		destinationMappings: make(map[string][]*models.SchemaMapping),
		dbStoreClient:       dbClient,
	}
}

// GetSchema retrieves a schema by its ID
func (s *SchemaStore) GetSchema(ctx context.Context, schemaID string) (*models.SchemaV2, error) {
	// Check local cache first
	if schema, ok := s.schemas[schemaID]; ok {
		return schema, nil
	}

	// Fetch from database
	schema, err := s.dbStoreClient.GetSchema(ctx, schemaID)
	if err != nil {
		return nil, fmt.Errorf("failed to get schema from DB: %w", err)
	}

	if schema == nil {
		return nil, fmt.Errorf("schema not found for ID: %s", schemaID)
	}

	// Cache the result locally
	s.schemas[schemaID] = schema

	return schema, nil
}

// GetSchemaVersion retrieves a specific schema version by schema ID and version
func (s *SchemaStore) GetSchemaVersion(ctx context.Context, schemaID, version string) (*models.SchemaVersion, error) {
	// Check local cache first
	if versions, ok := s.schemaVersions[schemaID]; ok {
		if schemaVersion, ok := versions[version]; ok {
			return schemaVersion, nil
		}
	}

	// Fetch from database
	schemaVersion, err := s.dbStoreClient.GetSchemaVersion(ctx, schemaID, version)
	if err != nil {
		return nil, fmt.Errorf("failed to get schema version from DB: %w", err)
	}

	if schemaVersion == nil {
		return nil, ErrSchemaVerionNotFound
	}

	// Cache the result locally
	if s.schemaVersions[schemaID] == nil {
		s.schemaVersions[schemaID] = make(map[string]*models.SchemaVersion)
	}
	s.schemaVersions[schemaID][version] = schemaVersion

	return schemaVersion, nil
}

// GetLatestSchemaVersion retrieves the latest version of a schema by schema ID
func (s *SchemaStore) GetLatestSchemaVersion(ctx context.Context, schemaID string) (*models.SchemaVersion, error) {
	// Check if we have latest version cached
	if latestVersion, ok := s.latestVersions[schemaID]; ok {
		// Try to get it from the version cache
		if schemaVersion, ok := s.schemaVersions[schemaID][latestVersion]; ok {
			return schemaVersion, nil
		}
	}

	// Fetch from database
	schemaVersion, err := s.dbStoreClient.GetLatestSchemaVersion(ctx, schemaID)
	if err != nil {
		return nil, fmt.Errorf("failed to get latest schema version from DB: %w", err)
	}

	if schemaVersion == nil {
		return nil, ErrSchemaVerionNotFound
	}

	// Cache the result locally
	if s.schemaVersions[schemaID] == nil {
		s.schemaVersions[schemaID] = make(map[string]*models.SchemaVersion)
	}
	s.schemaVersions[schemaID][schemaVersion.Version] = schemaVersion
	s.latestVersions[schemaID] = schemaVersion.Version

	return schemaVersion, nil
}

// SaveSchemaVersion saves a schema version to both the database and local cache
func (s *SchemaStore) SaveSchemaVersion(ctx context.Context, schemaVersion models.SchemaVersion, srcMappings []*models.SchemaMapping, dstMappings []*models.SchemaMapping) error {
	// Save to database
	err := s.dbStoreClient.SaveSchemaVersion(ctx, schemaVersion, srcMappings, dstMappings)
	if err != nil {
		return fmt.Errorf("failed to save schema version to DB: %w", err)
	}

	// Cache locally
	if s.schemaVersions[schemaVersion.SchemaID] == nil {
		s.schemaVersions[schemaVersion.SchemaID] = make(map[string]*models.SchemaVersion)
	}
	s.schemaVersions[schemaVersion.SchemaID][schemaVersion.Version] = &schemaVersion

	return nil
}

// GetSourceMappping retrieves a schema mapping for a given ID and schema ID and source orientation
func (s *SchemaStore) GetSourceMapppings(ctx context.Context, schemaID, version string) ([]*models.SchemaMapping, error) {
	schemaVersion, err := s.GetSchemaVersion(ctx, schemaID, version)
	if err != nil {
		return nil, fmt.Errorf("get schema version: %w", err)
	}

	mappings, ok := s.sourceMappings[schemaVersion.ID]
	if ok {
		return mappings, nil
	}

	mappings, err = s.dbStoreClient.GetMappingsBySchema(ctx, schemaID, version, models.MappingOrientationSource)
	if err != nil {
		return nil, fmt.Errorf("failed to get source schema mapping from DB: %w", err)
	}

	s.sourceMappings[schemaVersion.ID] = mappings

	return mappings, nil
}

// GetDestinationMapping retrieves a schema mapping for a given ID and schema ID and destination orientation
func (s *SchemaStore) GetDestinationMappings(ctx context.Context, schemaID, version string) ([]*models.SchemaMapping, error) {
	schemaVersion, err := s.GetSchemaVersion(ctx, schemaID, version)
	if err != nil {
		return nil, fmt.Errorf("get schema version: %w", err)
	}

	mappings, ok := s.destinationMappings[schemaVersion.ID]
	if ok {
		return mappings, nil
	}

	mappings, err = s.dbStoreClient.GetMappingsBySchema(ctx, schemaID, version, models.MappingOrientationDestination)
	if err != nil {
		return nil, fmt.Errorf("failed to get destination schema mapping from DB: %w", err)
	}

	s.destinationMappings[schemaVersion.ID] = mappings

	return mappings, nil
}
