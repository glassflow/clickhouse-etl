package models

import (
	"fmt"
	"os"
	"strings"
)

// IngestorRuntimeConfig contains runtime-only routing arguments that are provided by the orchestrator
type IngestorRuntimeConfig struct {
	OutputSubject      string
	DedupSubjectPrefix string
	DedupSubjectCount  int
}

func GetRequiredEnvVar(name string) (string, error) {
	val := strings.TrimSpace(os.Getenv(name))
	if val == "" {
		return "", fmt.Errorf("required environment variable %s is missing or empty", name)
	}
	return val, nil
}
