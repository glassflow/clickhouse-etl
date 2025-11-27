package postgres

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"

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
func checkRowsAffected(result sql.Result) error {
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("get rows affected: %w", err)
	}
	if rowsAffected == 0 {
		return service.ErrPipelineNotExists
	}
	return nil
}

// parsePostgresUUIDArray parses a PostgreSQL UUID array string (e.g., "{uuid1,uuid2}" or "{}")
func parsePostgresUUIDArray(s string) ([]uuid.UUID, error) {
	// Handle empty array
	if s == "{}" || s == "" {
		return []uuid.UUID{}, nil
	}

	// Remove braces
	s = strings.TrimPrefix(s, "{")
	s = strings.TrimSuffix(s, "}")

	// Handle empty after trimming
	if s == "" {
		return []uuid.UUID{}, nil
	}

	// Split by comma
	parts := strings.Split(s, ",")
	result := make([]uuid.UUID, 0, len(parts))

	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		u, err := uuid.Parse(part)
		if err != nil {
			return nil, fmt.Errorf("parse UUID in array: %w", err)
		}
		result = append(result, u)
	}

	return result, nil
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
