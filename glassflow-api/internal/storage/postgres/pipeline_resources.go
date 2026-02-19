package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/service"
)

// GetPipelineResources retrieves the resource configuration for a pipeline.
func (s *PostgresStorage) GetPipelineResources(ctx context.Context, pipelineID string) (*models.PipelineResourcesRow, error) {
	pid, err := parsePipelineID(pipelineID)
	if err != nil {
		return nil, err
	}

	var row models.PipelineResourcesRow
	var resourcesJSON []byte

	err = s.pool.QueryRow(ctx, `
		SELECT id, pipeline_id, resources, created_at, updated_at
		FROM pipeline_resources
		WHERE pipeline_id = $1
	`, pid).Scan(
		&row.ID,
		&row.PipelineID,
		&resourcesJSON,
		&row.CreatedAt,
		&row.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, service.ErrPipelineNotExists
		}
		return nil, fmt.Errorf("get pipeline resources: %w", err)
	}

	if len(resourcesJSON) > 0 {
		if err := json.Unmarshal(resourcesJSON, &row.Resources); err != nil {
			return nil, fmt.Errorf("unmarshal pipeline resources: %w", err)
		}
	}

	return &row, nil
}

// UpsertPipelineResources inserts or updates the resource configuration for a pipeline.
func (s *PostgresStorage) UpsertPipelineResources(
	ctx context.Context,
	pipelineID string,
	resources models.PipelineResources,
) (*models.PipelineResourcesRow, error) {
	resourcesJSON, err := json.Marshal(resources)
	if err != nil {
		return nil, fmt.Errorf("marshal pipeline resources: %w", err)
	}

	var row models.PipelineResourcesRow
	var returnedJSON []byte

	err = s.pool.QueryRow(ctx, `
		INSERT INTO pipeline_resources (pipeline_id, resources)
		VALUES ($1, $2)
		ON CONFLICT (pipeline_id) DO UPDATE
			SET resources = $2, updated_at = NOW()
		RETURNING id, pipeline_id, resources, created_at, updated_at
	`, pipelineID, resourcesJSON).Scan(
		&row.ID,
		&row.PipelineID,
		&returnedJSON,
		&row.CreatedAt,
		&row.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("upsert pipeline resources: %w", err)
	}

	if len(returnedJSON) > 0 {
		if err := json.Unmarshal(returnedJSON, &row.Resources); err != nil {
			return nil, fmt.Errorf("unmarshal pipeline resources: %w", err)
		}
	}

	return &row, nil
}
