package postgres

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strings"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/service"
	"github.com/google/uuid"
)

// validatePipelineID validates a pipeline ID against Kubernetes resource name constraints
func validatePipelineID(id string) error {
	// Check length (max 40 characters)
	if len(id) > 40 {
		return fmt.Errorf("pipeline ID must be 40 characters or less")
	}

	// Check if starts with alphabetic character
	if !regexp.MustCompile(`^[a-z]`).MatchString(id) {
		return fmt.Errorf("pipeline ID must start with a letter")
	}

	// Check if ends with alphanumeric character
	if !regexp.MustCompile(`[a-z0-9]$`).MatchString(id) {
		return fmt.Errorf("pipeline ID must end with a letter or number")
	}

	// Check if contains only lowercase alphanumeric characters or '-'
	if !regexp.MustCompile(`^[a-z0-9-]+$`).MatchString(id) {
		return fmt.Errorf("pipeline ID can only contain lowercase letters, numbers, and hyphens")
	}

	// Check for consecutive hyphens (not allowed in Kubernetes)
	if strings.Contains(id, "--") {
		return fmt.Errorf("pipeline ID cannot contain consecutive hyphens")
	}

	return nil
}

// parsePipelineID validates a pipeline ID string (no longer parses to UUID)
func parsePipelineID(id string) (string, error) {
	if err := validatePipelineID(id); err != nil {
		return "", fmt.Errorf("%w: %v", models.ErrInvalidPipelineID, err)
	}
	return id, nil
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
