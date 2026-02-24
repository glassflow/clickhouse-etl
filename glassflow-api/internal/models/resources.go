package models

import "time"

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
