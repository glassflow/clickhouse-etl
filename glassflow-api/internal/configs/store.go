package configs

import (
	"context"
	"errors"
	"fmt"
	"sync"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

type DBClient interface {
	GetStatelessTransformationConfig(ctx context.Context, pipelineID, sourceID, sourceSchemaVersion string) (*models.TransformationConfig, error)
	GetJoinConfigs(ctx context.Context, pipelineID string, leftSourceID, leftSchemaVersionID, rightSourceID, rightSchemaVersionID string) ([]models.JoinConfig, error)
	GetSinkConfig(ctx context.Context, pipelineID, sourceID, sourceSchemaVersion string) (*models.SinkConfig, error)
}

type ConfigStoreInterface interface {
	GetStatelessTransformationConfig(ctx context.Context, pipelineID, sourceID, sourceSchemaVersion string) (*models.TransformationConfig, error)
	GetJoinConfig(ctx context.Context, leftSourceID, leftSchemaVersionID, rightSourceID, rightSchemaVersionID string) (*models.JoinAuxConfig, error)
	GetSinkConfig(ctx context.Context, sourceSchemaVersion string) (map[string]models.Mapping, error)
}

type ConfigStore struct {
	dbClient                      DBClient
	pipelineID                    string
	sourceID                      string
	mu                            sync.RWMutex
	statelessTransfromationConigs map[string]*models.TransformationConfig
	joinConfigs                   map[string]*models.JoinAuxConfig
	sinkConfigs                   map[string]map[string]models.Mapping
}

func NewConfigStore(dbClient DBClient, pipelineID, sourceID string) *ConfigStore {
	return &ConfigStore{
		dbClient:                      dbClient,
		pipelineID:                    pipelineID,
		sourceID:                      sourceID,
		statelessTransfromationConigs: make(map[string]*models.TransformationConfig),
		joinConfigs:                   make(map[string]*models.JoinAuxConfig),
		sinkConfigs:                   make(map[string]map[string]models.Mapping),
	}
}

func (s *ConfigStore) GetStatelessTransformationConfig(ctx context.Context, pipelineID, sourceID, sourceSchemaVersion string) (*models.TransformationConfig, error) {
	s.mu.RLock()
	if config, ok := s.statelessTransfromationConigs[sourceSchemaVersion]; ok {
		s.mu.RUnlock()
		return config, nil
	}
	s.mu.RUnlock()

	config, err := s.dbClient.GetStatelessTransformationConfig(ctx, pipelineID, sourceID, sourceSchemaVersion)
	if err != nil {
		if errors.Is(err, models.ErrRecordNotFound) {
			return nil, models.ErrConfigNotFound
		}
		return nil, fmt.Errorf("get stateless transformation config: %w", err)
	}

	s.mu.Lock()
	if cached, ok := s.statelessTransfromationConigs[sourceSchemaVersion]; ok {
		s.mu.Unlock()
		return cached, nil
	}
	s.statelessTransfromationConigs[sourceSchemaVersion] = config
	s.mu.Unlock()

	return config, nil
}

func (s *ConfigStore) GetJoinConfig(ctx context.Context, leftSourceID, leftSchemaVersionID, rightSourceID, rightSchemaVersionID string) (*models.JoinAuxConfig, error) {
	key := fmt.Sprintf("%s%s%s%s", leftSourceID, leftSchemaVersionID, rightSourceID, rightSchemaVersionID)
	s.mu.RLock()
	if config, ok := s.joinConfigs[key]; ok {
		s.mu.RUnlock()
		return config, nil
	}
	s.mu.RUnlock()

	configs, err := s.dbClient.GetJoinConfigs(ctx, s.pipelineID, leftSourceID, leftSchemaVersionID, rightSourceID, rightSchemaVersionID)
	if err != nil {
		if errors.Is(err, models.ErrRecordNotFound) {
			return nil, models.ErrConfigNotFound
		}
		return nil, fmt.Errorf("get join config: %w", err)
	}

	joinAuxCfg := models.NewJoinAuxConfig(configs)

	s.mu.Lock()
	if cached, ok := s.joinConfigs[key]; ok {
		s.mu.Unlock()
		return cached, nil
	}
	s.joinConfigs[key] = joinAuxCfg
	s.mu.Unlock()

	return joinAuxCfg, nil
}

func (s *ConfigStore) GetSinkConfig(ctx context.Context, sourceSchemaVersion string) (zero map[string]models.Mapping, _ error) {
	s.mu.RLock()
	if config, ok := s.sinkConfigs[sourceSchemaVersion]; ok {
		s.mu.RUnlock()
		return config, nil
	}
	s.mu.RUnlock()

	config, err := s.dbClient.GetSinkConfig(ctx, s.pipelineID, s.sourceID, sourceSchemaVersion)
	if err != nil {
		if errors.Is(err, models.ErrRecordNotFound) {
			return nil, models.ErrConfigNotFound
		}
		return nil, fmt.Errorf("get sink config: %w", err)
	}

	m := make(map[string]models.Mapping)
	for _, mapping := range config.Config {
		m[mapping.DestinationField] = mapping
	}

	s.mu.Lock()
	if cached, ok := s.sinkConfigs[sourceSchemaVersion]; ok {
		s.mu.Unlock()
		return cached, nil
	}
	s.sinkConfigs[sourceSchemaVersion] = m
	s.mu.Unlock()

	return m, nil
}
