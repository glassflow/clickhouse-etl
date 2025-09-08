package k8s

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
)

// PipelineStartupState reads the current pipeline state from the mounted secret on startup
type PipelineStartupState struct {
	configPath string
	log        *slog.Logger
}

// NewPipelineStartupState creates a new startup state reader
func NewPipelineStartupState(configPath string, log *slog.Logger) *PipelineStartupState {
	return &PipelineStartupState{
		configPath: configPath,
		log:        log,
	}
}

// ReadCurrentState reads the current pipeline state from the mounted secret
func (s *PipelineStartupState) ReadCurrentState() (string, error) {
	s.log.Info("reading current pipeline state from mounted secret",
		slog.String("config_path", s.configPath))

	// Read the pipeline.json file
	data, err := os.ReadFile(s.configPath)
	if err != nil {
		return "", fmt.Errorf("failed to read pipeline config file: %w", err)
	}

	// Parse the JSON
	var config map[string]interface{}
	if err := json.Unmarshal(data, &config); err != nil {
		return "", fmt.Errorf("failed to unmarshal pipeline config: %w", err)
	}

	// Extract the status
	status, ok := config["status"].(string)
	if !ok {
		s.log.Warn("no status field found in pipeline config, defaulting to Running")
		return "Running", nil
	}

	s.log.Info("current pipeline state read from secret",
		slog.String("status", status))

	return status, nil
}

// ApplyState applies the current state to the component
func (s *PipelineStartupState) ApplyState(status string, onPause, onResume func() error) error {
	s.log.Info("applying startup state to component",
		slog.String("status", status))

	switch status {
	case "Pausing", "Paused":
		s.log.Info("component starting in paused state, applying pause")
		if err := onPause(); err != nil {
			return fmt.Errorf("failed to apply pause state on startup: %w", err)
		}
		s.log.Info("pause state applied successfully on startup")

	case "Resuming", "Running":
		s.log.Info("component starting in running state, applying resume")
		if err := onResume(); err != nil {
			return fmt.Errorf("failed to apply resume state on startup: %w", err)
		}
		s.log.Info("resume state applied successfully on startup")

	default:
		s.log.Warn("unknown status, defaulting to running",
			slog.String("status", status))
		if err := onResume(); err != nil {
			return fmt.Errorf("failed to apply default resume state on startup: %w", err)
		}
	}

	return nil
}
