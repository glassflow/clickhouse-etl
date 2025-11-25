package status

import (
	"fmt"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

// StatusTransition represents a valid transition from one status to another
type StatusTransition struct {
	From   models.PipelineStatus
	To     models.PipelineStatus
	Action string // Description of the action that triggers this transition
}

// StatusValidationMatrix defines all valid pipeline status transitions
var StatusValidationMatrix = map[models.PipelineStatus][]models.PipelineStatus{
	// All non terminal states can transition to Terminating / Failed

	// Created status can only transition to Running
	models.PipelineStatus(internal.PipelineStatusCreated): {
		models.PipelineStatus(internal.PipelineStatusRunning),
		models.PipelineStatus(internal.PipelineStatusTerminating),
		models.PipelineStatus(internal.PipelineStatusFailed),
	},

	// Running status can transition to Stopping or Terminating
	models.PipelineStatus(internal.PipelineStatusRunning): {
		models.PipelineStatus(internal.PipelineStatusStopping),
		models.PipelineStatus(internal.PipelineStatusTerminating),
		models.PipelineStatus(internal.PipelineStatusFailed),
	},

	// Resuming status can only transition to Running or Terminating
	models.PipelineStatus(internal.PipelineStatusResuming): {
		models.PipelineStatus(internal.PipelineStatusRunning),
		models.PipelineStatus(internal.PipelineStatusTerminating),
		models.PipelineStatus(internal.PipelineStatusFailed),
	},

	// Stopping status can only transition to Stopped or Terminating
	models.PipelineStatus(internal.PipelineStatusStopping): {
		models.PipelineStatus(internal.PipelineStatusStopped),
		models.PipelineStatus(internal.PipelineStatusTerminating),
		models.PipelineStatus(internal.PipelineStatusFailed),
	},

	// Stopped status allows resume and can transition to failed
	models.PipelineStatus(internal.PipelineStatusStopped): {
		models.PipelineStatus(internal.PipelineStatusResuming),
		models.PipelineStatus(internal.PipelineStatusFailed),
	},

	// Terminating status can only transition to Stopped
	models.PipelineStatus(internal.PipelineStatusTerminating): {
		models.PipelineStatus(internal.PipelineStatusStopped),
		models.PipelineStatus(internal.PipelineStatusFailed),
	},

	// Failed status can be deleted, edited or resumed
	models.PipelineStatus(internal.PipelineStatusFailed): {
		models.PipelineStatus(internal.PipelineStatusResuming),
	},
}

// ValidateStatusTransition checks if a transition from one status to another is valid
func ValidateStatusTransition(from, to models.PipelineStatus) error {
	// Check if the transition is valid according to the matrix
	validTransitions, exists := StatusValidationMatrix[from]
	if !exists {
		return NewUnknownStatusError(from)
	}

	// Check if the target status is in the list of valid transitions
	for _, validStatus := range validTransitions {
		if validStatus == to {
			return nil
		}
	}

	// If we get here, the transition is invalid
	return NewInvalidTransitionError(from, to)
}

// GetValidTransitions returns all valid transitions from a given status
func GetValidTransitions(from models.PipelineStatus) ([]models.PipelineStatus, error) {
	validTransitions, exists := StatusValidationMatrix[from]
	if !exists {
		return nil, fmt.Errorf("unknown status: %s", from)
	}

	// Return a copy to prevent external modification
	result := make([]models.PipelineStatus, len(validTransitions))
	copy(result, validTransitions)
	return result, nil
}

// IsTransitionalStatus checks if a status is transitional (temporary state during operations)
func IsTransitionalStatus(status models.PipelineStatus) bool {
	transitionalStatuses := []models.PipelineStatus{
		models.PipelineStatus(internal.PipelineStatusResuming),
		models.PipelineStatus(internal.PipelineStatusStopping),
		models.PipelineStatus(internal.PipelineStatusTerminating),
	}

	for _, transitional := range transitionalStatuses {
		if status == transitional {
			return true
		}
	}
	return false
}

// GetStatusDescription returns a human-readable description of a status
func GetStatusDescription(status models.PipelineStatus) string {
	descriptions := map[models.PipelineStatus]string{
		models.PipelineStatus(internal.PipelineStatusCreated):     "Pipeline created and ready to start",
		models.PipelineStatus(internal.PipelineStatusRunning):     "Pipeline is actively processing data",
		models.PipelineStatus(internal.PipelineStatusResuming):    "Pipeline is being resumed",
		models.PipelineStatus(internal.PipelineStatusStopping):    "Pipeline is being stopped",
		models.PipelineStatus(internal.PipelineStatusStopped):     "Pipeline has been stopped",
		models.PipelineStatus(internal.PipelineStatusTerminating): "Pipeline is being terminated",
		models.PipelineStatus(internal.PipelineStatusFailed):      "Pipeline has failed",
	}

	if description, exists := descriptions[status]; exists {
		return description
	}
	return fmt.Sprintf("Unknown status: %s", status)
}

// ValidatePipelineOperation validates a pipeline operation and returns specific errors
func ValidatePipelineOperation(pipeline *models.PipelineConfig, operation models.PipelineStatus) error {
	if pipeline == nil {
		return NewPipelineNotFoundError("")
	}

	currentStatus := pipeline.Status.OverallStatus

	// Check if pipeline is already in the target state
	if currentStatus == operation {
		return NewPipelineAlreadyInStateError(currentStatus, operation)
	}

	// Check if pipeline is in a transitional state (but allow terminating in case of failures)
	if IsTransitionalStatus(currentStatus) && operation != internal.PipelineStatusTerminating {
		return NewPipelineInTransitionError(currentStatus, operation)
	}

	// Validate the transition
	return ValidateStatusTransition(currentStatus, operation)
}
