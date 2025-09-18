package status

import (
	"testing"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
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
			name:        "Running to Pausing",
			from:        models.PipelineStatus(internal.PipelineStatusRunning),
			to:          models.PipelineStatus(internal.PipelineStatusPausing),
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
			name:        "Pausing to Paused",
			from:        models.PipelineStatus(internal.PipelineStatusPausing),
			to:          models.PipelineStatus(internal.PipelineStatusPaused),
			expectError: false,
		},
		{
			name:        "Paused to Resuming",
			from:        models.PipelineStatus(internal.PipelineStatusPaused),
			to:          models.PipelineStatus(internal.PipelineStatusResuming),
			expectError: false,
		},
		{
			name:        "Paused to Stopping",
			from:        models.PipelineStatus(internal.PipelineStatusPaused),
			to:          models.PipelineStatus(internal.PipelineStatusStopping),
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
			name:        "Terminating to Terminated",
			from:        models.PipelineStatus(internal.PipelineStatusTerminating),
			to:          models.PipelineStatus(internal.PipelineStatusTerminated),
			expectError: false,
		},

		// Invalid transitions
		{
			name:        "Created to Paused (invalid)",
			from:        models.PipelineStatus(internal.PipelineStatusCreated),
			to:          models.PipelineStatus(internal.PipelineStatusPaused),
			expectError: true,
		},
		{
			name:        "Running to Running (invalid)",
			from:        models.PipelineStatus(internal.PipelineStatusRunning),
			to:          models.PipelineStatus(internal.PipelineStatusRunning),
			expectError: true,
		},
		{
			name:        "Paused to Paused (invalid)",
			from:        models.PipelineStatus(internal.PipelineStatusPaused),
			to:          models.PipelineStatus(internal.PipelineStatusPaused),
			expectError: true,
		},
		{
			name:        "Stopped to Running (invalid - terminal state)",
			from:        models.PipelineStatus(internal.PipelineStatusStopped),
			to:          models.PipelineStatus(internal.PipelineStatusRunning),
			expectError: true,
		},
		{
			name:        "Terminated to Running (invalid - terminal state)",
			from:        models.PipelineStatus(internal.PipelineStatusTerminated),
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
		{
			name:        "Paused to Pausing (invalid)",
			from:        models.PipelineStatus(internal.PipelineStatusPaused),
			to:          models.PipelineStatus(internal.PipelineStatusPausing),
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

func TestGetValidTransitions(t *testing.T) {
	tests := []struct {
		name           string
		from           models.PipelineStatus
		expectedCount  int
		expectedStatus []models.PipelineStatus
		expectError    bool
	}{
		{
			name:          "Created status transitions",
			from:          models.PipelineStatus(internal.PipelineStatusCreated),
			expectedCount: 1,
			expectedStatus: []models.PipelineStatus{
				models.PipelineStatus(internal.PipelineStatusRunning),
			},
			expectError: false,
		},
		{
			name:          "Running status transitions",
			from:          models.PipelineStatus(internal.PipelineStatusRunning),
			expectedCount: 3,
			expectedStatus: []models.PipelineStatus{
				models.PipelineStatus(internal.PipelineStatusPausing),
				models.PipelineStatus(internal.PipelineStatusStopping),
				models.PipelineStatus(internal.PipelineStatusTerminating),
			},
			expectError: false,
		},
		{
			name:          "Paused status transitions",
			from:          models.PipelineStatus(internal.PipelineStatusPaused),
			expectedCount: 2,
			expectedStatus: []models.PipelineStatus{
				models.PipelineStatus(internal.PipelineStatusResuming),
				models.PipelineStatus(internal.PipelineStatusStopping),
			},
			expectError: false,
		},
		{
			name:           "Stopped status transitions (terminal)",
			from:           models.PipelineStatus(internal.PipelineStatusStopped),
			expectedCount:  0,
			expectedStatus: []models.PipelineStatus{},
			expectError:    false,
		},
		{
			name:        "Unknown status",
			from:        models.PipelineStatus("Unknown"),
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			transitions, err := GetValidTransitions(tt.from)

			if tt.expectError {
				if err == nil {
					t.Errorf("expected error but got none")
				}
				return
			}

			if err != nil {
				t.Errorf("unexpected error: %v", err)
				return
			}

			if len(transitions) != tt.expectedCount {
				t.Errorf("expected %d transitions, got %d", tt.expectedCount, len(transitions))
			}

			// Check that all expected transitions are present
			for _, expectedStatus := range tt.expectedStatus {
				found := false
				for _, transition := range transitions {
					if transition == expectedStatus {
						found = true
						break
					}
				}
				if !found {
					t.Errorf("expected transition to %s not found", expectedStatus)
				}
			}
		})
	}
}

func TestIsTerminalStatus(t *testing.T) {
	tests := []struct {
		name     string
		status   models.PipelineStatus
		expected bool
	}{
		{
			name:     "Stopped is terminal",
			status:   models.PipelineStatus(internal.PipelineStatusStopped),
			expected: true,
		},
		{
			name:     "Terminated is terminal",
			status:   models.PipelineStatus(internal.PipelineStatusTerminated),
			expected: true,
		},
		{
			name:     "Failed is terminal",
			status:   models.PipelineStatus(internal.PipelineStatusFailed),
			expected: true,
		},
		{
			name:     "Running is not terminal",
			status:   models.PipelineStatus(internal.PipelineStatusRunning),
			expected: false,
		},
		{
			name:     "Paused is not terminal",
			status:   models.PipelineStatus(internal.PipelineStatusPaused),
			expected: false,
		},
		{
			name:     "Created is not terminal",
			status:   models.PipelineStatus(internal.PipelineStatusCreated),
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := IsTerminalStatus(tt.status)
			if result != tt.expected {
				t.Errorf("expected %v, got %v", tt.expected, result)
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
			name:     "Pausing is transitional",
			status:   models.PipelineStatus(internal.PipelineStatusPausing),
			expected: true,
		},
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
			name:     "Paused is not transitional",
			status:   models.PipelineStatus(internal.PipelineStatusPaused),
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
			name:     "Paused status description",
			status:   models.PipelineStatus(internal.PipelineStatusPaused),
			expected: "Pipeline is paused and not processing data",
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
		models.PipelineStatus(internal.PipelineStatusPausing),
		models.PipelineStatus(internal.PipelineStatusPaused),
		models.PipelineStatus(internal.PipelineStatusResuming),
		models.PipelineStatus(internal.PipelineStatusStopping),
		models.PipelineStatus(internal.PipelineStatusStopped),
		models.PipelineStatus(internal.PipelineStatusTerminating),
		models.PipelineStatus(internal.PipelineStatusTerminated),
		models.PipelineStatus(internal.PipelineStatusFailed),
	}

	for _, status := range allStatuses {
		_, exists := StatusValidationMatrix[status]
		if !exists {
			t.Errorf("status %s is not defined in StatusValidationMatrix", status)
		}
	}
}
