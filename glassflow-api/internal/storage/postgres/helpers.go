package postgres

import (
	"encoding/json"
	"fmt"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/service"
	"github.com/google/uuid"
)

// parsePipelineID parses a pipeline ID string into a UUID
func parsePipelineID(id string) (uuid.UUID, error) {
	pipelineID, err := uuid.Parse(id)
	if err != nil {
		return uuid.Nil, fmt.Errorf("invalid pipeline ID format: %w", err)
	}
	return pipelineID, nil
}

// checkRowsAffected checks if any rows were affected and returns ErrPipelineNotExists if none
func checkRowsAffected(rowsAffected int64) error {
	if rowsAffected == 0 {
		return service.ErrPipelineNotExists
	}
	return nil
}

// handleTransformationIDs handles NULL transformation_ids from database
func handleTransformationIDs(transformationIDsPtr *[]uuid.UUID) []uuid.UUID {
	if transformationIDsPtr != nil {
		return *transformationIDsPtr
	}
	return []uuid.UUID{}
}

// unmarshalMetadata unmarshals pipeline metadata
func unmarshalMetadata(metadataJSON []byte) (models.PipelineMetadata, error) {
	var metadata models.PipelineMetadata
	if len(metadataJSON) > 0 {
		if err := json.Unmarshal(metadataJSON, &metadata); err != nil {
			return metadata, fmt.Errorf("unmarshal metadata: %w", err)
		}
	}
	return metadata, nil
}
