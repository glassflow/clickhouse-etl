package status

import (
	"fmt"
	"testing"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

func TestStatusValidationError(t *testing.T) {
	tests := []struct {
		name           string
		error          *StatusValidationError
		expectedCode   string
		expectedStatus int
		expectedMsg    string
	}{
		{
			name: "Invalid transition error",
			error: NewInvalidTransitionError(
				models.PipelineStatus(internal.PipelineStatusRunning),
				models.PipelineStatus(internal.PipelineStatusStopped),
			),
			expectedCode:   ErrorCodeInvalidTransition,
			expectedStatus: 400,
			expectedMsg:    "Invalid status transition from Running to Stopped",
		},
		{
			name: "Unknown status error",
			error: NewUnknownStatusError(
				models.PipelineStatus("Unknown"),
			),
			expectedCode:   ErrorCodeUnknownStatus,
			expectedStatus: 400,
			expectedMsg:    "Unknown pipeline status: Unknown",
		},
		{
			name:           "Pipeline not found error",
			error:          NewPipelineNotFoundError("test-pipeline"),
			expectedCode:   ErrorCodePipelineNotFound,
			expectedStatus: 400,
			expectedMsg:    "Pipeline not found: test-pipeline",
		},
		{
			name: "Pipeline already in state error",
			error: NewPipelineAlreadyInStateError(
				models.PipelineStatus(internal.PipelineStatusRunning),
				models.PipelineStatus(internal.PipelineStatusRunning),
			),
			expectedCode:   ErrorCodePipelineAlreadyInState,
			expectedStatus: 400,
			expectedMsg:    "Pipeline is already in Running state",
		},
		{
			name: "Pipeline in transition error",
			error: NewPipelineInTransitionError(
				models.PipelineStatus(internal.PipelineStatusStopping),
				models.PipelineStatus(internal.PipelineStatusStopped),
			),
			expectedCode:   ErrorCodePipelineInTransition,
			expectedStatus: 400,
			expectedMsg:    "Pipeline is currently transitioning from Stopping state, cannot perform Stopped operation",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Test Error() method
			if tt.error.Error() != tt.expectedMsg {
				t.Errorf("expected error message %q, got %q", tt.expectedMsg, tt.error.Error())
			}

			// Test HTTPStatus() method
			if tt.error.HTTPStatus() != tt.expectedStatus {
				t.Errorf("expected HTTP status %d, got %d", tt.expectedStatus, tt.error.HTTPStatus())
			}

			// Test ErrorCode() method
			if tt.error.ErrorCode() != tt.expectedCode {
				t.Errorf("expected error code %q, got %q", tt.expectedCode, tt.error.ErrorCode())
			}
		})
	}
}

func TestIsStatusValidationError(t *testing.T) {
	tests := []struct {
		name     string
		err      error
		expected bool
	}{
		{
			name:     "StatusValidationError",
			err:      NewInvalidTransitionError(models.PipelineStatus(internal.PipelineStatusRunning), models.PipelineStatus(internal.PipelineStatusStopped)),
			expected: true,
		},
		{
			name:     "Regular error",
			err:      fmt.Errorf("regular error"),
			expected: false,
		},
		{
			name:     "Nil error",
			err:      nil,
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := IsStatusValidationError(tt.err)
			if result != tt.expected {
				t.Errorf("expected %v, got %v", tt.expected, result)
			}
		})
	}
}

func TestGetStatusValidationError(t *testing.T) {
	tests := []struct {
		name           string
		err            error
		expectedError  *StatusValidationError
		expectedExists bool
	}{
		{
			name:           "StatusValidationError",
			err:            NewInvalidTransitionError(models.PipelineStatus(internal.PipelineStatusRunning), models.PipelineStatus(internal.PipelineStatusStopped)),
			expectedError:  NewInvalidTransitionError(models.PipelineStatus(internal.PipelineStatusRunning), models.PipelineStatus(internal.PipelineStatusStopped)),
			expectedExists: true,
		},
		{
			name:           "Regular error",
			err:            fmt.Errorf("regular error"),
			expectedError:  nil,
			expectedExists: false,
		},
		{
			name:           "Nil error",
			err:            nil,
			expectedError:  nil,
			expectedExists: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			statusErr, exists := GetStatusValidationError(tt.err)
			if exists != tt.expectedExists {
				t.Errorf("expected exists %v, got %v", tt.expectedExists, exists)
			}
			if tt.expectedExists && statusErr == nil {
				t.Errorf("expected StatusValidationError, got nil")
			}
		})
	}
}

func TestValidatePipelineOperation(t *testing.T) {
	tests := []struct {
		name        string
		pipeline    *models.PipelineConfig
		operation   models.PipelineStatus
		expectError bool
		errorCode   string
	}{
		{
			name: "Valid operation",
			pipeline: &models.PipelineConfig{
				Status: models.PipelineHealth{
					OverallStatus: models.PipelineStatus(internal.PipelineStatusRunning),
				},
			},
			operation:   models.PipelineStatus(internal.PipelineStatusStopping),
			expectError: false,
		},
		{
			name: "Pipeline already in target state",
			pipeline: &models.PipelineConfig{
				Status: models.PipelineHealth{
					OverallStatus: models.PipelineStatus(internal.PipelineStatusRunning),
				},
			},
			operation:   models.PipelineStatus(internal.PipelineStatusRunning),
			expectError: true,
			errorCode:   ErrorCodePipelineAlreadyInState,
		},
		{
			name: "Pipeline in transitional state",
			pipeline: &models.PipelineConfig{
				Status: models.PipelineHealth{
					OverallStatus: models.PipelineStatus(internal.PipelineStatusStopping),
				},
			},
			operation:   models.PipelineStatus(internal.PipelineStatusStopped),
			expectError: true,
			errorCode:   ErrorCodePipelineInTransition,
		},
		{
			name:        "Nil pipeline",
			pipeline:    nil,
			operation:   models.PipelineStatus(internal.PipelineStatusRunning),
			expectError: true,
			errorCode:   ErrorCodePipelineNotFound,
		},
		{
			name: "Invalid transition",
			pipeline: &models.PipelineConfig{
				Status: models.PipelineHealth{
					OverallStatus: models.PipelineStatus(internal.PipelineStatusRunning),
				},
			},
			operation:   models.PipelineStatus(internal.PipelineStatusStopped),
			expectError: true,
			errorCode:   ErrorCodeInvalidTransition,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidatePipelineOperation(tt.pipeline, tt.operation)

			if tt.expectError {
				if err == nil {
					t.Errorf("expected error but got none")
					return
				}

				statusErr, ok := GetStatusValidationError(err)
				if !ok {
					t.Errorf("expected StatusValidationError, got %T", err)
					return
				}

				if statusErr.Code != tt.errorCode {
					t.Errorf("expected error code %q, got %q", tt.errorCode, statusErr.Code)
				}
			} else {
				if err != nil {
					t.Errorf("unexpected error: %v", err)
				}
			}
		})
	}
}
