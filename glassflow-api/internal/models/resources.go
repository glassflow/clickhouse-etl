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
	Nats     *NatsResources      `json:"nats,omitempty"`
	Ingestor *IngestorResources  `json:"ingestor,omitempty"`
	Join     *ComponentResources `json:"join,omitempty"`
	Sink     *ComponentResources `json:"sink,omitempty"`
	Dedup    *ComponentResources `json:"dedup,omitempty"`
}

type NatsResources struct {
	Stream *NatsStreamResources `json:"stream,omitempty"`
}

type NatsStreamResources struct {
	MaxAge   string `json:"maxAge,omitempty"`
	MaxBytes string `json:"maxBytes,omitempty"`
}

type IngestorResources struct {
	Base  *IngestorInstanceResources `json:"base,omitempty"`
	Left  *IngestorInstanceResources `json:"left,omitempty"`
	Right *IngestorInstanceResources `json:"right,omitempty"`
}

type IngestorInstanceResources struct {
	Resources *ResourceRequirements `json:"resources,omitempty"`
}

type ComponentResources struct {
	Resources *ResourceRequirements `json:"resources,omitempty"`
}

type ResourceRequirements struct {
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
