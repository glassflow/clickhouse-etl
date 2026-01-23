package configs

import (
	"context"
	"errors"
	"fmt"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

type DBClient interface {
	GetStatelessTransformationConfig(ctx context.Context, pipelineID, sourceID, sourceSchemaVersion string) (*models.TransformationConfig, error)
	GetJoinConfig(ctx context.Context, pipelineID, sourceID, sourceSchemaVersion string) (*models.JoinConfig, error)
	GetSinkConfig(ctx context.Context, pipelineID, sourceID, sourceSchemaVersion string) (*models.SinkConfig, error)
}

type ConfigStoreInterface interface {
	GetStatelessTransformationConfig(ctx context.Context, pipelineID, sourceID, sourceSchemaVersion string) (*models.TransformationConfig, error)
	GetJoinConfig(ctx context.Context, pipelineID, sourceID, sourceSchemaVersion string) (*models.JoinConfig, error)
	GetSinkConfig(ctx context.Context, pipelineID, sourceID, sourceSchemaVersion string) (*models.SinkConfig, error)
}

type ConfigStore struct {
	dbClient                      DBClient
	pipelineID                    string
	sourceID                      string
	statelessTransfromationConigs map[string]*models.TransformationConfig
	joinConfigs                   map[string]*models.JoinConfig
	sinkConfigs                   map[string]*models.SinkConfig
}

func NewConfigStore(dbClient DBClient, pipelineID, sourceID string) ConfigStoreInterface {
	return &ConfigStore{
		dbClient:                      dbClient,
		pipelineID:                    pipelineID,
		sourceID:                      sourceID,
		statelessTransfromationConigs: make(map[string]*models.TransformationConfig),
		joinConfigs:                   make(map[string]*models.JoinConfig),
		sinkConfigs:                   make(map[string]*models.SinkConfig),
	}
}

func (s *ConfigStore) GetStatelessTransformationConfig(ctx context.Context, pipelineID, sourceID, sourceSchemaVersion string) (*models.TransformationConfig, error) {
	if config, ok := s.statelessTransfromationConigs[sourceSchemaVersion]; ok {
		return config, nil
	}

	config, err := s.dbClient.GetStatelessTransformationConfig(ctx, pipelineID, sourceID, sourceSchemaVersion)
	if err != nil {
		if errors.Is(err, models.ErrRecordNotFound) {
			return nil, models.ErrConfigNotFound
		}
		return nil, fmt.Errorf("get stateless transformation config: %w", err)
	}

	s.statelessTransfromationConigs[sourceSchemaVersion] = config

	return config, nil
}

func (s *ConfigStore) GetJoinConfig(ctx context.Context, pipelineID, sourceID, sourceSchemaVersion string) (*models.JoinConfig, error) {
	if config, ok := s.joinConfigs[sourceSchemaVersion]; ok {
		return config, nil
	}

	config, err := s.dbClient.GetJoinConfig(ctx, pipelineID, sourceID, sourceSchemaVersion)
	if err != nil {
		if errors.Is(err, models.ErrRecordNotFound) {
			return nil, models.ErrConfigNotFound
		}
		return nil, fmt.Errorf("get join config: %w", err)
	}

	s.joinConfigs[sourceSchemaVersion] = config

	return config, nil
}

func (s *ConfigStore) GetSinkConfig(ctx context.Context, pipelineID, sourceID, sourceSchemaVersion string) (*models.SinkConfig, error) {
	if config, ok := s.sinkConfigs[sourceSchemaVersion]; ok {
		return config, nil
	}

	config, err := s.dbClient.GetSinkConfig(ctx, pipelineID, sourceID, sourceSchemaVersion)
	if err != nil {
		if errors.Is(err, models.ErrRecordNotFound) {
			return nil, models.ErrConfigNotFound
		}
		return nil, fmt.Errorf("get sink config: %w", err)
	}

	s.sinkConfigs[sourceSchemaVersion] = config

	return config, nil
}
