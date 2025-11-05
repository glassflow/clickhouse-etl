package status

import (
	"testing"

	"github.com/glassflow/clickhouse-etl/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl/glassflow-api/internal/models"
)

func TestValidateStatusTransition(t *testing.T) {
	tests := []struct {
		name        string
		from        models.PipelineStatus
		to          models.PipelineStatus
		expectError bool
		errorMsg    string
	}{
		// Valid transitions
		{
			name:        "Created to Running",
			from:        models.PipelineStatus(internal.PipelineStatusCreated),
			to:          models.PipelineStatus(internal.PipelineStatusRunning),
			expectError: false,
		},
		{
			name:        "Running to Stopping",
			from:        models.PipelineStatus(internal.PipelineStatusRunning),
			to:          models.PipelineStatus(internal.PipelineStatusStopping),
			expectError: false,
		},
		{
			name:        "Running to Terminating",
			from:        models.PipelineStatus(internal.PipelineStatusRunning),
			to:          models.PipelineStatus(internal.PipelineStatusTerminating),
			expectError: false,
		},
		{
			name:        "Stopped to Resuming",
			from:        models.PipelineStatus(internal.PipelineStatusStopped),
			to:          models.PipelineStatus(internal.PipelineStatusResuming),
			expectError: false,
		},
		{
			name:        "Resuming to Running",
			from:        models.PipelineStatus(internal.PipelineStatusResuming),
			to:          models.PipelineStatus(internal.PipelineStatusRunning),
			expectError: false,
		},
		{
			name:        "Stopping to Stopped",
			from:        models.PipelineStatus(internal.PipelineStatusStopping),
			to:          models.PipelineStatus(internal.PipelineStatusStopped),
			expectError: false,
		},
		{
			name:        "Terminating to Stopped",
			from:        models.PipelineStatus(internal.PipelineStatusTerminating),
			to:          models.PipelineStatus(internal.PipelineStatusStopped),
			expectError: false,
		},

		// Invalid transitions
		{
			name:        "Running to Running (invalid)",
			from:        models.PipelineStatus(internal.PipelineStatusRunning),
			to:          models.PipelineStatus(internal.PipelineStatusRunning),
			expectError: true,
		},
		{
			name:        "Stopped to Running (should resume first)",
			from:        models.PipelineStatus(internal.PipelineStatusStopped),
			to:          models.PipelineStatus(internal.PipelineStatusRunning),
			expectError: true,
		},
		{
			name:        "Failed to Running (invalid - terminal state)",
			from:        models.PipelineStatus(internal.PipelineStatusFailed),
			to:          models.PipelineStatus(internal.PipelineStatusRunning),
			expectError: true,
		},
		{
			name:        "Running to Resuming (invalid)",
			from:        models.PipelineStatus(internal.PipelineStatusRunning),
			to:          models.PipelineStatus(internal.PipelineStatusResuming),
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateStatusTransition(tt.from, tt.to)

			if tt.expectError {
				if err == nil {
					t.Errorf("expected error but got none")
				}
			} else {
				if err != nil {
					t.Errorf("unexpected error: %v", err)
				}
			}
		})
	}
}

func TestIsTransitionalStatus(t *testing.T) {
	tests := []struct {
		name     string
		status   models.PipelineStatus
		expected bool
	}{
		{
			name:     "Resuming is transitional",
			status:   models.PipelineStatus(internal.PipelineStatusResuming),
			expected: true,
		},
		{
			name:     "Stopping is transitional",
			status:   models.PipelineStatus(internal.PipelineStatusStopping),
			expected: true,
		},
		{
			name:     "Terminating is transitional",
			status:   models.PipelineStatus(internal.PipelineStatusTerminating),
			expected: true,
		},
		{
			name:     "Running is not transitional",
			status:   models.PipelineStatus(internal.PipelineStatusRunning),
			expected: false,
		},
		{
			name:     "Created is not transitional",
			status:   models.PipelineStatus(internal.PipelineStatusCreated),
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := IsTransitionalStatus(tt.status)
			if result != tt.expected {
				t.Errorf("expected %v, got %v", tt.expected, result)
			}
		})
	}
}

func TestGetStatusDescription(t *testing.T) {
	tests := []struct {
		name     string
		status   models.PipelineStatus
		expected string
	}{
		{
			name:     "Created status description",
			status:   models.PipelineStatus(internal.PipelineStatusCreated),
			expected: "Pipeline created and ready to start",
		},
		{
			name:     "Running status description",
			status:   models.PipelineStatus(internal.PipelineStatusRunning),
			expected: "Pipeline is actively processing data",
		},
		{
			name:     "Unknown status description",
			status:   models.PipelineStatus("Unknown"),
			expected: "Unknown status: Unknown",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := GetStatusDescription(tt.status)
			if result != tt.expected {
				t.Errorf("expected %q, got %q", tt.expected, result)
			}
		})
	}
}

// TestStatusValidationMatrixCompleteness ensures all status constants are covered
func TestStatusValidationMatrixCompleteness(t *testing.T) {
	allStatuses := []models.PipelineStatus{
		models.PipelineStatus(internal.PipelineStatusCreated),
		models.PipelineStatus(internal.PipelineStatusRunning),
		models.PipelineStatus(internal.PipelineStatusResuming),
		models.PipelineStatus(internal.PipelineStatusStopping),
		models.PipelineStatus(internal.PipelineStatusStopped),
		models.PipelineStatus(internal.PipelineStatusTerminating),
		models.PipelineStatus(internal.PipelineStatusFailed),
	}

	for _, status := range allStatuses {
		_, exists := StatusValidationMatrix[status]
		if !exists {
			t.Errorf("status %s is not defined in StatusValidationMatrix", status)
		}
	}
}
