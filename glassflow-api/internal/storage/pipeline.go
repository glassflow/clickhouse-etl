package storage

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/service"
	"github.com/nats-io/nats.go/jetstream"
)

func (s *Storage) InsertPipeline(ctx context.Context, p models.PipelineConfig) error {
	pc, err := json.Marshal(p)
	if err != nil {
		return fmt.Errorf("marshal kv pipeline: %w", err)
	}

	_, err = s.kv.Create(ctx, p.ID, pc)
	if err != nil {
		if errors.Is(err, jetstream.ErrKeyExists) {
			return service.ErrIDExists
		}
		return fmt.Errorf("add pipeline in kv: %w", err)
	}

	return nil
}

func (s *Storage) GetPipeline(ctx context.Context, id string) (*models.PipelineConfig, error) {
	entry, err := s.kv.Get(ctx, id)
	if err != nil {
		if errors.Is(err, jetstream.ErrKeyNotFound) {
			return nil, service.ErrPipelineNotExists
		}
		return nil, fmt.Errorf("get pipeline from kv: %w", err)
	}

	var p models.PipelineConfig
	err = json.Unmarshal(entry.Value(), &p)
	if err != nil {
		return nil, fmt.Errorf("unmarshal loaded entry: %w", err)
	}

	return &p, nil
}
