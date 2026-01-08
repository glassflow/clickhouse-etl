package mapper

import (
	"context"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

type DBClient interface {
	GetMapping(ctx context.Context, pipelineID, mappingType string) (*models.Mapping, error)
}

type Store interface {
	GetMapping(ctx context.Context) (*models.Mapping, error)
}

type MappingStore struct {
	dbClient    DBClient
	pipelineID  string
	mappingType string
	mapping     *models.Mapping
}

func NewMappingStore(dbClient DBClient, pipelineID, mappingType string) Store {
	return &MappingStore{
		dbClient:    dbClient,
		pipelineID:  pipelineID,
		mappingType: mappingType,
	}
}

func (s *MappingStore) GetMapping(ctx context.Context) (*models.Mapping, error) {
	if s.mapping != nil {
		return s.mapping, nil
	}

	mapping, err := s.dbClient.GetMapping(ctx, s.pipelineID, s.mappingType)
	if err != nil {
		return nil, err
	}

	s.mapping = mapping
	return mapping, nil
}
