package status

import (
	"fmt"
	"net/http"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

// StatusValidationError represents a specific error for invalid status transitions
type StatusValidationError struct {
	// CurrentStatus is the current pipeline status
	CurrentStatus models.PipelineStatus `json:"current_status"`
	// RequestedStatus is the status that was requested
	RequestedStatus models.PipelineStatus `json:"requested_status"`
	// Message is a human-readable error message
	Message string `json:"message"`
	// Code is a machine-readable error code
	Code string `json:"code"`
	// ValidTransitions lists the valid transitions from the current status
	ValidTransitions []models.PipelineStatus `json:"valid_transitions,omitempty"`
}

// Error implements the error interface
func (e *StatusValidationError) Error() string {
	return e.Message
}

// HTTPStatus returns the appropriate HTTP status code for this error
func (e *StatusValidationError) HTTPStatus() int {
	return http.StatusBadRequest
}

// ErrorCode returns the error code for API responses
func (e *StatusValidationError) ErrorCode() string {
	return e.Code
}

// NewInvalidTransitionError creates a new StatusValidationError for invalid transitions
func NewInvalidTransitionError(current, requested models.PipelineStatus) *StatusValidationError {
	validTransitions, _ := GetValidTransitions(current)

	return &StatusValidationError{
		CurrentStatus:    current,
		RequestedStatus:  requested,
		Message:          fmt.Sprintf("Invalid status transition from %s to %s", current, requested),
		Code:             "INVALID_STATUS_TRANSITION",
		ValidTransitions: validTransitions,
	}
}

// NewTerminalStateError creates a new StatusValidationError for terminal state violations
func NewTerminalStateError(current, requested models.PipelineStatus) *StatusValidationError {
	return &StatusValidationError{
		CurrentStatus:   current,
		RequestedStatus: requested,
		Message:         fmt.Sprintf("Cannot transition from terminal state %s to %s", current, requested),
		Code:            "TERMINAL_STATE_VIOLATION",
	}
}

// NewUnknownStatusError creates a new StatusValidationError for unknown statuses
func NewUnknownStatusError(status models.PipelineStatus) *StatusValidationError {
	return &StatusValidationError{
		CurrentStatus:   status,
		RequestedStatus: "",
		Message:         fmt.Sprintf("Unknown pipeline status: %s", status),
		Code:            "UNKNOWN_STATUS",
	}
}

// NewPipelineNotFoundError creates a new StatusValidationError for missing pipelines
func NewPipelineNotFoundError(pipelineID string) *StatusValidationError {
	return &StatusValidationError{
		CurrentStatus:   "",
		RequestedStatus: "",
		Message:         fmt.Sprintf("Pipeline not found: %s", pipelineID),
		Code:            "PIPELINE_NOT_FOUND",
	}
}

// NewPipelineAlreadyInStateError creates a new StatusValidationError for operations on pipelines already in the target state
func NewPipelineAlreadyInStateError(current, requested models.PipelineStatus) *StatusValidationError {
	return &StatusValidationError{
		CurrentStatus:   current,
		RequestedStatus: requested,
		Message:         fmt.Sprintf("Pipeline is already in %s state", requested),
		Code:            "PIPELINE_ALREADY_IN_STATE",
	}
}

// NewPipelineInTransitionError creates a new StatusValidationError for operations on pipelines in transitional states
func NewPipelineInTransitionError(current, requested models.PipelineStatus) *StatusValidationError {
	return &StatusValidationError{
		CurrentStatus:   current,
		RequestedStatus: requested,
		Message:         fmt.Sprintf("Pipeline is currently transitioning from %s state, cannot perform %s operation", current, requested),
		Code:            "PIPELINE_IN_TRANSITION",
	}
}

// Error codes for different types of validation failures
const (
	ErrorCodeInvalidTransition      = "INVALID_STATUS_TRANSITION"
	ErrorCodeTerminalStateViolation = "TERMINAL_STATE_VIOLATION"
	ErrorCodeUnknownStatus          = "UNKNOWN_STATUS"
	ErrorCodePipelineNotFound       = "PIPELINE_NOT_FOUND"
	ErrorCodePipelineAlreadyInState = "PIPELINE_ALREADY_IN_STATE"
	ErrorCodePipelineInTransition   = "PIPELINE_IN_TRANSITION"
)

// IsStatusValidationError checks if an error is a StatusValidationError
func IsStatusValidationError(err error) bool {
	_, ok := err.(*StatusValidationError)
	return ok
}

// GetStatusValidationError extracts StatusValidationError from an error
func GetStatusValidationError(err error) (*StatusValidationError, bool) {
	statusErr, ok := err.(*StatusValidationError)
	return statusErr, ok
}
