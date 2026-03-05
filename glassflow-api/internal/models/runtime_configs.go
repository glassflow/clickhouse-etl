package models

// IngestorRuntimeConfig contains runtime-only routing arguments that are provided by the orchestrator
type IngestorRuntimeConfig struct {
	OutputSubject      string
	DedupSubjectPrefix string
	DedupSubjectCount  int
}
