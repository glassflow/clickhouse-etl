package storage

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

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

// TODO: there must be a pagination setup when it is a "real" product
func (s *Storage) GetPipelines(ctx context.Context) ([]models.PipelineConfig, error) {
	var pipelines []models.PipelineConfig

	iter, err := s.kv.ListKeys(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("list keys for bucket %s: %w", s.kv.Bucket(), err)
	}

	// NOTE: inefficient but as of 28.07.2025 NATS doesn't provide a way for getting all entries in
	// a bucket directly
	for id := range iter.Keys() {
		entry, err := s.kv.Get(ctx, id)
		if err != nil {
			return nil, fmt.Errorf("error getting key %q from kv list: %w", id, err)
		}

		var p models.PipelineConfig
		err = json.Unmarshal(entry.Value(), &p)
		if err != nil {
			return nil, fmt.Errorf("unmarshal loaded entry for %q: %w", id, err)
		}

		pipelines = append(pipelines, p)
	}

	return pipelines, nil
}

func (s *Storage) PatchPipelineName(ctx context.Context, id, name string) error {
	entry, err := s.kv.Get(ctx, id)
	if err != nil {
		if errors.Is(err, jetstream.ErrKeyNotFound) {
			return service.ErrPipelineNotExists
		}
		return fmt.Errorf("get pipeline to patch from kv: %w", err)
	}

	var p models.PipelineConfig
	err = json.Unmarshal(entry.Value(), &p)
	if err != nil {
		return fmt.Errorf("unmarshal loaded entry: %w", err)
	}

	p.Name = name

	pc, err := json.Marshal(p)
	if err != nil {
		return fmt.Errorf("marshal kv pipeline: %w", err)
	}

	_, err = s.kv.Update(ctx, p.ID, pc, entry.Revision())
	if err != nil {
		return fmt.Errorf("patch pipeline name in kv: %w", err)
	}

	return nil
}

func (s *Storage) DeletePipeline(ctx context.Context, id string) error {
	entry, err := s.kv.Get(ctx, id)
	if err != nil {
		if errors.Is(err, jetstream.ErrKeyNotFound) {
			return service.ErrPipelineNotExists
		}
		return fmt.Errorf("get pipeline to delete from kv: %w", err)
	}

	err = s.kv.Delete(ctx, id, jetstream.LastRevision(entry.Revision()))
	if err != nil {
		return fmt.Errorf("delete pipeline: %w", err)
	}

	return nil
}

func (s *Storage) UpdatePipelineStatus(ctx context.Context, id string, status models.PipelineHealth) error {
	entry, err := s.kv.Get(ctx, id)
	if err != nil {
		if errors.Is(err, jetstream.ErrKeyNotFound) {
			return service.ErrPipelineNotExists
		}
		return fmt.Errorf("get pipeline to update status from kv: %w", err)
	}

	var p models.PipelineConfig
	err = json.Unmarshal(entry.Value(), &p)
	if err != nil {
		return fmt.Errorf("unmarshal loaded entry: %w", err)
	}

	// Update the status and ensure UpdatedAt timestamp is set to current time
	status.UpdatedAt = time.Now().UTC()
	p.Status = status

	pc, err := json.Marshal(p)
	if err != nil {
		return fmt.Errorf("marshal kv pipeline: %w", err)
	}

	_, err = s.kv.Update(ctx, id, pc, entry.Revision())
	if err != nil {
		return fmt.Errorf("update pipeline status in kv: %w", err)
	}

	return nil
}
