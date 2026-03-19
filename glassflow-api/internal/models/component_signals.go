package models

import (
	"encoding/json"
	"fmt"
)

const (
	ComponentSignalsStream  = "component-signals"
	ComponentSignalsSubject = "failures"
)

type ComponentSignal struct {
	PipelineID string `json:"pipeline_id"`
	Reason     string `json:"reason"`
	Text       string `json:"text"`
	Component  string `json:"component"`
}

func (m ComponentSignal) ToJSON() ([]byte, error) {
	bytes, err := json.Marshal(m)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal ComponentSignal: %w", err)
	}
	return bytes, nil
}

// GetComponentSignalsSubject subject
// Format: "component-signals.failures"
func GetComponentSignalsSubject() string {
	return fmt.Sprintf("%s.%s", ComponentSignalsStream, ComponentSignalsSubject)
}
