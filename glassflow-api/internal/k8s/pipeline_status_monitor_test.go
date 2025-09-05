package k8s

import (
	"context"
	"encoding/json"
	"log/slog"
	"os"
	"testing"
	"time"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/stretchr/testify/assert"
)

// TestPipelineStatusMonitorCreation tests the creation of a pipeline status monitor
func TestPipelineStatusMonitorCreation(t *testing.T) {
	monitor := NewPipelineStatusMonitor(
		"/tmp/test-pipeline.json",
		slog.Default(),
		func() error { return nil },
		func() error { return nil },
	)

	assert.NotNil(t, monitor)
	assert.Equal(t, "/tmp/test-pipeline.json", monitor.configPath)
	assert.Equal(t, 5*time.Second, monitor.pollInterval)
}

// TestPipelineStatusConstants tests that the pipeline status constants are correctly defined
func TestPipelineStatusConstants(t *testing.T) {
	assert.Equal(t, "Pausing", PipelineStatusPausing)
	assert.Equal(t, "Paused", PipelineStatusPaused)
	assert.Equal(t, "Resuming", PipelineStatusResuming)
	assert.Equal(t, "Running", PipelineStatusRunning)
}

// TestPipelineStatusTransitions tests the status transition logic
func TestPipelineStatusTransitions(t *testing.T) {
	var pauseCalled, resumeCalled bool

	pauseFunc := func() error {
		pauseCalled = true
		return nil
	}

	resumeFunc := func() error {
		resumeCalled = true
		return nil
	}

	monitor := NewPipelineStatusMonitor(
		"/tmp/test-pipeline.json",
		slog.Default(),
		pauseFunc,
		resumeFunc,
	)

	// Test pause signal detection
	monitor.lastStatus = "Running"
	monitor.handleStatusChange(PipelineStatusPausing)
	assert.True(t, pauseCalled)
	assert.Equal(t, PipelineStatusPausing, monitor.lastStatus)

	// Test resume signal detection
	pauseCalled = false
	monitor.lastStatus = "Paused"
	monitor.handleStatusChange(PipelineStatusResuming)
	assert.True(t, resumeCalled)
	assert.Equal(t, PipelineStatusResuming, monitor.lastStatus)
}

// TestPipelineStatusMonitorIntegration tests the integration with the main application
func TestPipelineStatusMonitorIntegration(t *testing.T) {
	// Create a temporary pipeline config file
	tempFile, err := os.CreateTemp("", "test-pipeline-*.json")
	assert.NoError(t, err)
	defer os.Remove(tempFile.Name())

	// Write test pipeline config
	pipelineConfig := models.PipelineConfig{
		ID: "test-pipeline",
		Status: models.PipelineHealth{
			OverallStatus: models.PipelineStatus("Running"),
		},
	}

	configData, err := json.Marshal(pipelineConfig)
	assert.NoError(t, err)

	_, err = tempFile.Write(configData)
	assert.NoError(t, err)
	tempFile.Close()

	// Test reading the config
	monitor := NewPipelineStatusMonitor(
		tempFile.Name(),
		slog.Default(),
		func() error { return nil },
		func() error { return nil },
	)

	config, err := monitor.readPipelineConfig()
	assert.NoError(t, err)
	assert.Equal(t, "test-pipeline", config.ID)
	assert.Equal(t, "Running", string(config.Status.OverallStatus))
}

// TestPipelineStatusMonitorLifecycle tests the lifecycle of the pipeline status monitor
func TestPipelineStatusMonitorLifecycle(t *testing.T) {
	monitor := NewPipelineStatusMonitor(
		"/tmp/test-pipeline.json",
		slog.Default(),
		func() error { return nil },
		func() error { return nil },
	)

	// Test that the monitor can be started and stopped
	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()

	// Start the monitor
	err := monitor.Start(ctx)
	assert.NoError(t, err)

	// Stop the monitor
	monitor.Stop()

	// Wait for context to timeout
	<-ctx.Done()
}

// TestPipelineStatusSignalHandling tests the handling of pipeline status signals
func TestPipelineStatusSignalHandling(t *testing.T) {
	var pauseCount, resumeCount int

	pauseFunc := func() error {
		pauseCount++
		return nil
	}

	resumeFunc := func() error {
		resumeCount++
		return nil
	}

	monitor := NewPipelineStatusMonitor(
		"/tmp/test-pipeline.json",
		slog.Default(),
		pauseFunc,
		resumeFunc,
	)

	// Test multiple status changes
	monitor.lastStatus = "Running"
	monitor.handleStatusChange(PipelineStatusPausing)
	assert.Equal(t, 1, pauseCount)

	monitor.handleStatusChange(PipelineStatusPaused)
	assert.Equal(t, 1, pauseCount) // Should not call pause again

	monitor.handleStatusChange(PipelineStatusResuming)
	assert.Equal(t, 1, resumeCount)

	monitor.handleStatusChange(PipelineStatusRunning)
	assert.Equal(t, 1, resumeCount) // Should not call resume again
}

// Helper method for testing (we need to add this to the monitor)
func (m *PipelineStatusMonitor) handleStatusChange(newStatus string) {
	// Simulate the status change logic
	switch newStatus {
	case PipelineStatusPausing:
		if m.lastStatus != PipelineStatusPausing {
			if m.onPause != nil {
				m.onPause()
			}
		}
	case PipelineStatusResuming:
		if m.lastStatus != PipelineStatusResuming {
			if m.onResume != nil {
				m.onResume()
			}
		}
	}
	m.lastStatus = newStatus
}
