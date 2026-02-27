package models

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/tidwall/gjson"
	"k8s.io/apimachinery/pkg/api/resource"
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

func ptrInt64(v int64) *int64 { return &v }

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
		Replicas: ptrInt64(1),
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
			Replicas: ptrInt64(1),
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
			Replicas: ptrInt64(1),
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
			Replicas: ptrInt64(1),
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

// PipelineResourcesImmutableAfterCreate lists resource field paths that cannot be changed after pipeline creation.
var PipelineResourcesImmutableAfterCreate = []string{
	"nats/stream/maxAge",
	"nats/stream/maxBytes",
	"transform/storage/size",
}

// PipelineResourcesAlwaysImmutable lists resource field paths that users can never configure directly.
var PipelineResourcesAlwaysImmutable = []string{
	"join/replicas",
}

// ValidateResourceQuantities validates all resource quantity values in r.
func ValidateResourceQuantities(r PipelineResources) error {
	if r.Ingestor != nil {
		for _, inst := range []*ComponentResources{
			r.Ingestor.Base, r.Ingestor.Left, r.Ingestor.Right,
		} {
			if err := validateResourceRequirements(inst); err != nil {
				return err
			}
		}
	}
	for _, c := range []*ComponentResources{r.Join, r.Sink, r.Transform} {
		if c == nil {
			continue
		}
		if err := validateResourceRequirements(c); err != nil {
			return err
		}
	}
	return validateNatsResources(r.Nats)
}

func validateNatsResources(n *NatsResources) error {
	if n == nil || n.Stream == nil {
		return nil
	}
	if n.Stream.MaxAge != "" {
		if _, err := time.ParseDuration(n.Stream.MaxAge); err != nil {
			return fmt.Errorf("invalid nats stream maxAge %q: %w", n.Stream.MaxAge, err)
		}
	}
	if n.Stream.MaxBytes != "" {
		if _, err := resource.ParseQuantity(n.Stream.MaxBytes); err != nil {
			return fmt.Errorf("invalid nats stream maxBytes %q: %w", n.Stream.MaxBytes, err)
		}
	}
	return nil
}

func validateResourceRequirements(r *ComponentResources) error {
	if r == nil {
		return nil
	}
	if r.Requests != nil {
		if err := validateQuantity(r.Requests.CPU, "cpu"); err != nil {
			return err
		}
		if err := validateQuantity(r.Requests.Memory, "memory"); err != nil {
			return err
		}
	}
	if r.Limits != nil {
		if err := validateQuantity(r.Limits.CPU, "cpu"); err != nil {
			return err
		}
		if err := validateQuantity(r.Limits.Memory, "memory"); err != nil {
			return err
		}
	}
	if r.Storage != nil {
		if err := validateQuantity(r.Storage.Size, "storage size"); err != nil {
			return err
		}
	}
	return nil
}

func validateQuantity(val, field string) error {
	if val == "" {
		return fmt.Errorf("%s must be set", field)
	}
	if _, err := resource.ParseQuantity(val); err != nil {
		return fmt.Errorf("invalid %s quantity %q: %w", field, val, err)
	}
	return nil
}

// ValidateAlwaysImmutableFields returns an error if r contains any always-immutable fields.
func ValidateAlwaysImmutableFields(r PipelineResources) error {
	data, err := json.Marshal(r)
	if err != nil {
		return fmt.Errorf("marshal resources: %w", err)
	}
	for _, field := range PipelineResourcesAlwaysImmutable {
		gjsonPath := strings.ReplaceAll(field, "/", ".")
		if gjson.GetBytes(data, gjsonPath).Exists() {
			return fmt.Errorf("field %q cannot be configured by users", field)
		}
	}
	return nil
}

// ValidateImmutabilityPipelineResources returns an error if any field in the given list
// is present in old and has a different value in new.
func ValidateImmutabilityPipelineResources(old, new PipelineResources, fields []string) error {
	oldJSON, err := json.Marshal(old)
	if err != nil {
		return fmt.Errorf("marshal old resources: %w", err)
	}
	newJSON, err := json.Marshal(new)
	if err != nil {
		return fmt.Errorf("marshal new resources: %w", err)
	}
	for _, field := range fields {
		gjsonPath := strings.ReplaceAll(field, "/", ".")
		oldVal := gjson.GetBytes(oldJSON, gjsonPath)
		newVal := gjson.GetBytes(newJSON, gjsonPath)
		if oldVal.Exists() && oldVal.Raw != newVal.Raw {
			return fmt.Errorf("immutable field %q cannot be changed", field)
		}
	}
	return nil
}

// ValidatePipelineResources runs all resource validation checks in sequence:
// quantity validation, always-immutable field check, and immutability check against old resources.
// Pass nil immutableFields to skip the immutability check (e.g. on create).
func ValidatePipelineResources(old, new PipelineResources, immutableFields []string) error {
	if err := ValidateResourceQuantities(new); err != nil {
		return err
	}
	if err := ValidateAlwaysImmutableFields(new); err != nil {
		return err
	}
	if len(immutableFields) > 0 {
		if err := ValidateImmutabilityPipelineResources(old, new, immutableFields); err != nil {
			return err
		}
	}
	return nil
}

// MergeWithDefaults fills nil components in r with the corresponding defaults.
func MergeWithDefaults(r PipelineResources, defaults PipelineResources) PipelineResources {
	if r.Nats == nil {
		r.Nats = defaults.Nats
	}
	if r.Ingestor == nil {
		r.Ingestor = defaults.Ingestor
	} else {
		if r.Ingestor.Base == nil {
			r.Ingestor.Base = defaults.Ingestor.Base
		} else {
			mergeComponentDefaults(r.Ingestor.Base, defaults.Ingestor.Base)
		}
		if r.Ingestor.Left == nil {
			r.Ingestor.Left = defaults.Ingestor.Left
		} else {
			mergeComponentDefaults(r.Ingestor.Left, defaults.Ingestor.Left)
		}
		if r.Ingestor.Right == nil {
			r.Ingestor.Right = defaults.Ingestor.Right
		} else {
			mergeComponentDefaults(r.Ingestor.Right, defaults.Ingestor.Right)
		}
	}
	if r.Join == nil {
		r.Join = defaults.Join
	} else {
		mergeComponentDefaults(r.Join, defaults.Join)
	}
	if r.Sink == nil {
		r.Sink = defaults.Sink
	} else {
		mergeComponentDefaults(r.Sink, defaults.Sink)
	}
	if r.Transform == nil {
		r.Transform = defaults.Transform
	} else {
		mergeComponentDefaults(r.Transform, defaults.Transform)
	}

	return r
}

func mergeComponentDefaults(dst, src *ComponentResources) {
	if dst == nil || src == nil {
		return
	}
	if dst.Replicas == nil {
		dst.Replicas = src.Replicas
	}
	if dst.Requests == nil {
		dst.Requests = src.Requests
	}
	if dst.Limits == nil {
		dst.Limits = src.Limits
	}
	if dst.Storage == nil {
		dst.Storage = src.Storage
	}
}
