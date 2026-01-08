package schemav2

import (
	"context"
	"errors"
	"fmt"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

//go:generate mockgen -destination ./mocks/dbclient_mock.go -package mocks . DBClient
type DBClient interface {
	GetSchema(ctx context.Context, pipelineID, sourceName string) (*models.SchemaV2, error)
	GetSchemaVersion(ctx context.Context, schemaID, version string) (*models.SchemaVersion, error)
	GetLatestSchemaVersion(ctx context.Context, schemaID string) (*models.SchemaVersion, error)
	SaveSchemaVersion(ctx context.Context, schemaID, versionID string, schemaFields models.SchemaFields) error
}

type Store interface {
	GetSchema(ctx context.Context) (*models.SchemaV2, error)
	GetSchemaVersion(ctx context.Context, version string) (*models.SchemaVersion, error)
	GetLatestSchemaVersion(ctx context.Context) (*models.SchemaVersion, error)
	SaveSchemaVersion(ctx context.Context, versionID string, schemaFields models.SchemaFields) error
}

type SchemaStore struct {
	dbClient      DBClient
	pipelineID    string
	sourceName    string
	schema        *models.SchemaV2
	versions      map[string]*models.SchemaVersion
	latestVersion string
}

func NewSchemaStore(dbClient DBClient, pipelineID, sourceName string) Store {
	return &SchemaStore{
		dbClient:   dbClient,
		pipelineID: pipelineID,
		sourceName: sourceName,
		versions:   make(map[string]*models.SchemaVersion),
	}
}

func (s *SchemaStore) GetSchema(ctx context.Context) (*models.SchemaV2, error) {
	schema, err := s.dbClient.GetSchema(ctx, s.pipelineID, s.sourceName)
	if err != nil {
		return nil, fmt.Errorf("get schema: %w", err)
	}

	s.schema = schema
	return schema, nil
}

func (s *SchemaStore) GetSchemaVersion(ctx context.Context, version string) (*models.SchemaVersion, error) {
	if v, ok := s.versions[version]; ok {
		return v, nil
	}

	schemaVersion, err := s.dbClient.GetSchemaVersion(ctx, s.schema.ID, version)
	if err != nil {
		if errors.Is(err, models.ErrRecordNotFound) {
			return nil, models.ErrSchemaVerionNotFound
		}
		return nil, fmt.Errorf("get schema version: %w", err)
	}

	s.versions[version] = schemaVersion

	return schemaVersion, nil
}

func (s *SchemaStore) GetLatestSchemaVersion(ctx context.Context) (*models.SchemaVersion, error) {
	if s.latestVersion != "" {
		if version, ok := s.versions[s.latestVersion]; ok {
			return version, nil
		}
	}

	latestVersion, err := s.dbClient.GetLatestSchemaVersion(ctx, s.schema.ID)
	if err != nil {
		return nil, fmt.Errorf("get latest schema version: %w", err)
	}

	s.latestVersion = latestVersion.Version
	if _, ok := s.versions[s.latestVersion]; !ok {
		s.versions[s.latestVersion] = latestVersion
	}

	return latestVersion, nil
}

func (s *SchemaStore) SaveSchemaVersion(ctx context.Context, version string, schemaFields models.SchemaFields) error {
	err := s.dbClient.SaveSchemaVersion(ctx, s.schema.ID, version, schemaFields)
	if err != nil {
		return fmt.Errorf("save schema version: %w", err)
	}

	s.versions[version] = &models.SchemaVersion{
		SchemaID:     s.schema.ID,
		Version:      version,
		SchemaFields: schemaFields,
	}

	return nil
}
