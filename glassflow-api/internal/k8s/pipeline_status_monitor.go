package k8s

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"time"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

const (
	// Pipeline status constants
	PipelineStatusPausing  = "Pausing"
	PipelineStatusPaused   = "Paused"
	PipelineStatusResuming = "Resuming"
	PipelineStatusRunning  = "Running"
)

// PipelineStatusMonitor monitors pipeline status from K8s secret for pause/resume signals
type PipelineStatusMonitor struct {
	configPath   string
	log          *slog.Logger
	onPause      func() error
	onResume     func() error
	stopCh       chan struct{}
	lastStatus   string
	pollInterval time.Duration
}

// NewPipelineStatusMonitor creates a new pipeline status monitor
func NewPipelineStatusMonitor(configPath string, log *slog.Logger, onPause, onResume func() error) *PipelineStatusMonitor {
	return &PipelineStatusMonitor{
		configPath:   configPath,
		log:          log,
		onPause:      onPause,
		onResume:     onResume,
		stopCh:       make(chan struct{}),
		lastStatus:   "",
		pollInterval: 5 * time.Second, // Poll every 5 seconds
	}
}

// Start starts monitoring pipeline status
func (m *PipelineStatusMonitor) Start(ctx context.Context) error {
	m.log.Info("starting pipeline status monitor",
		slog.String("config_path", m.configPath),
		slog.Duration("poll_interval", m.pollInterval))

	// Start monitoring in a goroutine
	go m.monitorLoop(ctx)

	return nil
}

// Stop stops the pipeline status monitor
func (m *PipelineStatusMonitor) Stop() {
	m.log.Info("stopping pipeline status monitor")
	close(m.stopCh)
}

// monitorLoop continuously monitors the pipeline status
func (m *PipelineStatusMonitor) monitorLoop(ctx context.Context) {
	ticker := time.NewTicker(m.pollInterval)
	defer ticker.Stop()

	// Initial check
	m.checkStatus()

	for {
		select {
		case <-ticker.C:
			m.checkStatus()
		case <-m.stopCh:
			m.log.Info("pipeline status monitor stopped")
			return
		case <-ctx.Done():
			m.log.Info("pipeline status monitor stopped due to context cancellation")
			return
		}
	}
}

// checkStatus checks the current pipeline status and triggers appropriate actions
func (m *PipelineStatusMonitor) checkStatus() {
	// Read pipeline config from the mounted secret
	pipelineConfig, err := m.readPipelineConfig()
	if err != nil {
		m.log.Debug("failed to read pipeline config", slog.Any("error", err))
		return
	}

	currentStatus := string(pipelineConfig.Status.OverallStatus)

	// Only process if status has changed
	if currentStatus == m.lastStatus {
		return
	}

	m.log.Info("pipeline status changed",
		slog.String("from", m.lastStatus),
		slog.String("to", currentStatus))

	// Handle status transitions
	switch currentStatus {
	case PipelineStatusPausing:
		// When status changes to "Pausing", trigger pause
		if m.lastStatus != PipelineStatusPausing {
			m.log.Info("pausing signal detected from pipeline status")
			if m.onPause != nil {
				if err := m.onPause(); err != nil {
					m.log.Error("failed to handle pause signal", slog.Any("error", err))
				} else {
					m.log.Info("pause signal handled successfully")
				}
			}
		}

	case PipelineStatusResuming:
		// When status changes to "Resuming", trigger resume
		if m.lastStatus != PipelineStatusResuming {
			m.log.Info("resuming signal detected from pipeline status")
			if m.onResume != nil {
				if err := m.onResume(); err != nil {
					m.log.Error("failed to handle resume signal", slog.Any("error", err))
				} else {
					m.log.Info("resume signal handled successfully")
				}
			}
		}

	case PipelineStatusRunning:
		// When status changes to "Running" from "Resuming", the resume is complete
		if m.lastStatus == PipelineStatusResuming {
			m.log.Info("resume completed, pipeline is now running")
		}

	case PipelineStatusPaused:
		// When status changes to "Paused" from "Pausing", the pause is complete
		if m.lastStatus == PipelineStatusPausing {
			m.log.Info("pause completed, pipeline is now paused")
		}
	}

	m.lastStatus = currentStatus
}

// readPipelineConfig reads the pipeline configuration from the mounted secret
func (m *PipelineStatusMonitor) readPipelineConfig() (*models.PipelineConfig, error) {
	// Read the pipeline.json file from the mounted secret
	configData, err := os.ReadFile(m.configPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read pipeline config file: %w", err)
	}

	var pipelineConfig models.PipelineConfig
	if err := json.Unmarshal(configData, &pipelineConfig); err != nil {
		return nil, fmt.Errorf("failed to unmarshal pipeline config: %w", err)
	}

	return &pipelineConfig, nil
}
