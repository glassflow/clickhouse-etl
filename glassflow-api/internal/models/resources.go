package models

import (
	"encoding/json"
	"fmt"
	"os"
	"slices"
	"strconv"
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
			CPU:    getEnvOrDefault("INGESTOR_CPU_REQUEST", "100m"),
			Memory: getEnvOrDefault("INGESTOR_MEMORY_REQUEST", "128Mi"),
		},
		Limits: &ResourceList{
			CPU:    getEnvOrDefault("INGESTOR_CPU_LIMIT", "1500m"),
			Memory: getEnvOrDefault("INGESTOR_MEMORY_LIMIT", "1.5Gi"),
		},
		Replicas: ptrInt64(1),
	}
}

func NewDefaultPipelineResources(cfg *PipelineConfig) PipelineResources {
	r := PipelineResources{
		Nats: &NatsResources{
			Stream: &NatsStreamResources{
				MaxAge:   getEnvOrDefault("NATS_MAX_STREAM_AGE", "24h"),
				MaxBytes: getEnvOrDefault("NATS_MAX_STREAM_BYTES", "0"),
			},
		},
		Ingestor: &IngestorResources{},
		Sink: &ComponentResources{
			Requests: &ResourceList{
				CPU:    getEnvOrDefault("SINK_CPU_REQUEST", "100m"),
				Memory: getEnvOrDefault("SINK_MEMORY_REQUEST", "128Mi"),
			},
			Limits: &ResourceList{
				CPU:    getEnvOrDefault("SINK_CPU_LIMIT", "1500m"),
				Memory: getEnvOrDefault("SINK_MEMORY_LIMIT", "1.5Gi"),
			},
			Replicas: ptrInt64(1),
		},
	}

	if cfg.Join.Enabled {
		r.Ingestor.Left = newDefaultIngestorComponentResources()
		r.Ingestor.Right = newDefaultIngestorComponentResources()
		r.Join = &ComponentResources{
			Requests: &ResourceList{
				CPU:    getEnvOrDefault("JOIN_CPU_REQUEST", "100m"),
				Memory: getEnvOrDefault("JOIN_MEMORY_REQUEST", "128Mi"),
			},
			Limits: &ResourceList{
				CPU:    getEnvOrDefault("JOIN_CPU_LIMIT", "1500m"),
				Memory: getEnvOrDefault("JOIN_MEMORY_LIMIT", "1.5Gi"),
			},
			Replicas: ptrInt64(1),
		}
	} else {
		r.Ingestor.Base = newDefaultIngestorComponentResources()
	}

	if transformEnabled(cfg) {
		r.Transform = &ComponentResources{
			Requests: &ResourceList{
				CPU:    getEnvOrDefault("DEDUP_CPU_REQUEST", "100m"),
				Memory: getEnvOrDefault("DEDUP_MEMORY_REQUEST", "128Mi"),
			},
			Limits: &ResourceList{
				CPU:    getEnvOrDefault("DEDUP_CPU_LIMIT", "1500m"),
				Memory: getEnvOrDefault("DEDUP_MEMORY_LIMIT", "1.5Gi"),
			},
			Storage: &StorageConfig{
				Size: getEnvOrDefault("DEDUP_STORAGE_SIZE", "10Gi"),
			},
			Replicas: ptrInt64(1),
		}
	}

	return r
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

// PipelineResourcesWithPolicy bundles resources with their field immutability policy.
type PipelineResourcesWithPolicy struct {
	Resources PipelineResources
	Immutable []string
}

// NewPipelineResourcesWithPolicy creates a PipelineResourcesWithPolicy for the given pipeline config and resources.
func NewPipelineResourcesWithPolicy(cfg *PipelineConfig, resources PipelineResources) PipelineResourcesWithPolicy {
	return PipelineResourcesWithPolicy{
		Resources: resources,
		Immutable: GetImmutableFields(cfg),
	}
}

// PipelineResourcesImmutable lists resource field paths that cannot be changed after pipeline creation.
var PipelineResourcesImmutable = []string{
	"nats/stream/maxAge",
	"nats/stream/maxBytes",
	"transform/storage/size",
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
		if _, err := ParseNATSMaxBytesQuantity(n.Stream.MaxBytes); err != nil {
			return fmt.Errorf("invalid nats stream maxBytes %q: %w", n.Stream.MaxBytes, err)
		}
	}
	return nil
}

// ParseNATSMaxBytesQuantity parses maxBytes as either a Kubernetes resource quantity
// (e.g. "10Gi", "25G", "1048576") or as compatibility human-byte format ("100GB", "1TB").
func ParseNATSMaxBytesQuantity(val string) (resource.Quantity, error) {
	if q, err := resource.ParseQuantity(val); err == nil {
		return q, nil
	}

	bytes, err := parseHumanBytes(val)
	if err != nil {
		return resource.Quantity{}, err
	}

	return *resource.NewQuantity(bytes, resource.BinarySI), nil
}

func parseHumanBytes(val string) (int64, error) {
	s := strings.ToUpper(strings.TrimSpace(val))
	if s == "" {
		return 0, fmt.Errorf("empty value")
	}

	var multiplier int64
	var numStr string

	switch {
	case strings.HasSuffix(s, "KB"):
		multiplier = 1024
		numStr = strings.TrimSuffix(s, "KB")
	case strings.HasSuffix(s, "MB"):
		multiplier = 1024 * 1024
		numStr = strings.TrimSuffix(s, "MB")
	case strings.HasSuffix(s, "GB"):
		multiplier = 1024 * 1024 * 1024
		numStr = strings.TrimSuffix(s, "GB")
	case strings.HasSuffix(s, "TB"):
		multiplier = 1024 * 1024 * 1024 * 1024
		numStr = strings.TrimSuffix(s, "TB")
	default:
		return 0, fmt.Errorf("invalid byte format: %s", val)
	}

	num, err := strconv.ParseFloat(strings.TrimSpace(numStr), 64)
	if err != nil {
		return 0, fmt.Errorf("invalid number in byte format %q: %w", val, err)
	}

	return int64(num * float64(multiplier)), nil
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
		if oldVal.Exists() && newVal.Exists() && oldVal.Raw != newVal.Raw {
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
	if len(immutableFields) > 0 {
		if err := ValidateImmutabilityPipelineResources(old, new, immutableFields); err != nil {
			return err
		}
	}
	return nil
}

// MergeWithDefaults fills nil components in r with the corresponding defaults.
func MergeWithDefaults(cfg *PipelineConfig, r PipelineResources, defaults PipelineResources) PipelineResources {
	if r.Nats == nil {
		r.Nats = defaults.Nats
	}

	if r.Ingestor == nil {
		r.Ingestor = &IngestorResources{}
	}

	if cfg.Join.Enabled {
		r.Ingestor.Left = mergeComponentDefaults(r.Ingestor.Left, defaults.Ingestor.Left)
		r.Ingestor.Right = mergeComponentDefaults(r.Ingestor.Right, defaults.Ingestor.Right)
		r.Join = mergeComponentDefaults(r.Join, defaults.Join)
	} else {
		r.Ingestor.Base = mergeComponentDefaults(r.Ingestor.Base, defaults.Ingestor.Base)
	}

	r.Sink = mergeComponentDefaults(r.Sink, defaults.Sink)

	if transformEnabled(cfg) {
		r.Transform = mergeComponentDefaults(r.Transform, defaults.Transform)
	}

	return r
}

func dedupEnabled(pc *PipelineConfig) bool {
	for _, topic := range pc.Ingestor.KafkaTopics {
		if topic.Deduplication.Enabled {
			return true
		}
	}
	return false
}

func transformEnabled(pc *PipelineConfig) bool {
	if pc.StatelessTransformation.Enabled || pc.Filter.Enabled {
		return true
	}
	return dedupEnabled(pc)
}

// GetImmutableFields returns immutable-after-create fields for the given pipeline config.
// When dedup is enabled, transform/replicas is also immutable because dedup uses stateful storage.
func GetImmutableFields(cfg *PipelineConfig) []string {
	fields := slices.Clone(PipelineResourcesImmutable)
	if dedupEnabled(cfg) {
		fields = append(fields, "transform/replicas")
	}
	return fields
}

func mergeComponentDefaults(destination, source *ComponentResources) *ComponentResources {
	if source == nil {
		return destination
	}
	if destination == nil {
		return source
	}
	merged := *destination
	if merged.Replicas == nil {
		merged.Replicas = source.Replicas
	}
	if merged.Requests == nil {
		merged.Requests = source.Requests
	}
	if merged.Limits == nil {
		merged.Limits = source.Limits
	}
	if merged.Storage == nil {
		merged.Storage = source.Storage
	}

	return &merged
}
