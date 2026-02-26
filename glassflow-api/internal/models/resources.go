package models

import (
	"os"
	"time"
)

// PipelineResourcesRow is the DB record for the pipeline_resources table.
type PipelineResourcesRow struct {
	ID         string
	PipelineID string
	Resources  PipelineResources
	CreatedAt  time.Time
	UpdatedAt  time.Time
}

// PipelineResources is the JSONB column content.
type PipelineResources struct {
	Nats      *NatsResources      `json:"nats,omitempty"`
	Ingestor  *IngestorResources  `json:"ingestor,omitempty"`
	Join      *ComponentResources `json:"join,omitempty"`
	Sink      *ComponentResources `json:"sink,omitempty"`
	Transform *ComponentResources `json:"transform,omitempty"`
}

func (p PipelineResources) IsZero() bool {
	return p.Nats == nil &&
		p.Ingestor == nil &&
		p.Join == nil &&
		p.Sink == nil &&
		p.Transform == nil
}

func getEnvOrDefault(key, defaultVal string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return defaultVal
}

func newDefaultIngestorComponentResources() *ComponentResources {
	return &ComponentResources{
		Requests: &ResourceList{
			CPU:    getEnvOrDefault("INGESTOR_CPU_REQUEST", "1000m"),
			Memory: getEnvOrDefault("INGESTOR_MEMORY_REQUEST", "1Gi"),
		},
		Limits: &ResourceList{
			CPU:    getEnvOrDefault("INGESTOR_CPU_LIMIT", "1500m"),
			Memory: getEnvOrDefault("INGESTOR_MEMORY_LIMIT", "1.5Gi"),
		},
	}
}

func NewDefaultPipelineResources() PipelineResources {
	return PipelineResources{
		Nats: &NatsResources{
			Stream: &NatsStreamResources{
				MaxAge:   getEnvOrDefault("NATS_MAX_STREAM_AGE", "24h"),
				MaxBytes: getEnvOrDefault("NATS_MAX_STREAM_BYTES", "25GB"),
			},
		},
		Ingestor: &IngestorResources{
			Base:  newDefaultIngestorComponentResources(),
			Left:  newDefaultIngestorComponentResources(),
			Right: newDefaultIngestorComponentResources(),
		},
		Join: &ComponentResources{
			Requests: &ResourceList{
				CPU:    getEnvOrDefault("JOIN_CPU_REQUEST", "1000m"),
				Memory: getEnvOrDefault("JOIN_MEMORY_REQUEST", "1Gi"),
			},
			Limits: &ResourceList{
				CPU:    getEnvOrDefault("JOIN_CPU_LIMIT", "1500m"),
				Memory: getEnvOrDefault("JOIN_MEMORY_LIMIT", "1.5Gi"),
			},
		},
		Sink: &ComponentResources{
			Requests: &ResourceList{
				CPU:    getEnvOrDefault("SINK_CPU_REQUEST", "1000m"),
				Memory: getEnvOrDefault("SINK_MEMORY_REQUEST", "1Gi"),
			},
			Limits: &ResourceList{
				CPU:    getEnvOrDefault("SINK_CPU_LIMIT", "1500m"),
				Memory: getEnvOrDefault("SINK_MEMORY_LIMIT", "1.5Gi"),
			},
		},
		Transform: &ComponentResources{
			Requests: &ResourceList{
				CPU:    getEnvOrDefault("DEDUP_CPU_REQUEST", "1000m"),
				Memory: getEnvOrDefault("DEDUP_MEMORY_REQUEST", "1Gi"),
			},
			Limits: &ResourceList{
				CPU:    getEnvOrDefault("DEDUP_CPU_LIMIT", "1500m"),
				Memory: getEnvOrDefault("DEDUP_MEMORY_LIMIT", "1.5Gi"),
			},
			Storage: &StorageConfig{
				Size: getEnvOrDefault("DEDUP_STORAGE_SIZE", "10Gi"),
			},
		},
	}
}

type NatsResources struct {
	Stream *NatsStreamResources `json:"stream,omitempty"`
}

type NatsStreamResources struct {
	MaxAge   string `json:"maxAge,omitempty"`
	MaxBytes string `json:"maxBytes,omitempty"`
}

type IngestorResources struct {
	Base  *ComponentResources `json:"base,omitempty"`
	Left  *ComponentResources `json:"left,omitempty"`
	Right *ComponentResources `json:"right,omitempty"`
}

type ComponentResources struct {
	Requests *ResourceList  `json:"requests,omitempty"`
	Limits   *ResourceList  `json:"limits,omitempty"`
	Storage  *StorageConfig `json:"storage,omitempty"`
	Replicas *int64         `json:"replicas,omitempty"`
}

type ResourceList struct {
	Memory string `json:"memory,omitempty"`
	CPU    string `json:"cpu,omitempty"`
}

type StorageConfig struct {
	Size string `json:"size,omitempty"`
}
