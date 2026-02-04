package schemav2

import (
	"context"
	"errors"
	"fmt"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

type DBClient interface {
	GetSchemaVersion(ctx context.Context, pipelineID, sourceID, versionID string) (*models.SchemaVersion, error)
	GetLatestSchemaVersion(ctx context.Context, pipelineID, sourceID string) (*models.SchemaVersion, error)
	SaveNewSchemaVersion(ctx context.Context, pipelineID, sourceID, oldVersionID, newVersionID string) error
}

type Store interface {
	GetSchemaVersion(ctx context.Context, versionID string) (*models.SchemaVersion, error)
	GetLatestSchemaVersion(ctx context.Context) (*models.SchemaVersion, error)
	SaveSchemaVersion(ctx context.Context, latestSchemaVersionID, newSchemaVersionID string) error
}

type SchemaStore struct {
	dbClient      DBClient
	pipelineID    string
	sourceID      string
	versions      map[string]*models.SchemaVersion
	latestVersion string
}

func NewSchemaStore(dbClient DBClient, pipelineID, sourceID string) Store {
	return &SchemaStore{
		dbClient:   dbClient,
		pipelineID: pipelineID,
		sourceID:   sourceID,
		versions:   make(map[string]*models.SchemaVersion),
	}
}

func (s *SchemaStore) GetSchemaVersion(ctx context.Context, version string) (*models.SchemaVersion, error) {
	if v, ok := s.versions[version]; ok {
		return v, nil
	}

	schemaVersion, err := s.dbClient.GetSchemaVersion(ctx, s.pipelineID, s.sourceID, version)
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

	latestVersion, err := s.dbClient.GetLatestSchemaVersion(ctx, s.pipelineID, s.sourceID)
	if err != nil {
		return nil, fmt.Errorf("get latest schema version: %w", err)
	}

	s.latestVersion = latestVersion.VersionID
	if _, ok := s.versions[s.latestVersion]; !ok {
		s.versions[s.latestVersion] = latestVersion
	}

	return latestVersion, nil
}

func (s *SchemaStore) SaveSchemaVersion(ctx context.Context, latestSchemaVersionID, newSchemaVersionID string) error {
	err := s.dbClient.SaveNewSchemaVersion(ctx, s.pipelineID, s.sourceID, latestSchemaVersionID, newSchemaVersionID)
	if err != nil {
		return fmt.Errorf("save schema version: %w", err)
	}

	s.versions[newSchemaVersionID] = s.versions[latestSchemaVersionID]
	s.versions[newSchemaVersionID].VersionID = newSchemaVersionID
	s.latestVersion = newSchemaVersionID

	return nil
}
