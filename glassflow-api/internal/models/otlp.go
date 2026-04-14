package models

import (
	"fmt"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
)

type OTLPConfig struct {
	PipelineID string        `json:"pipeline_id"`
	SourceType SourceType    `json:"source_type"`
	Routing    RoutingConfig `json:"routing"`
	Status     string        `json:"status"`
}

type RoutingType string

const (
	RoutingTypeName       RoutingType = "name"
	RoutingTypeField      RoutingType = "field"
	RoutingTypeHash       RoutingType = "message_hash"
	RoutingTypeRandom     RoutingType = "random"
	RoutingTypePodIndex   RoutingType = "pod_index"
	RoutingTypeRoundRobin RoutingType = "round_robin"
)

type RoutingConfig struct {
	OutputSubject string                      `json:"output_subject"`
	SubjectCount  int                         `json:"subject_count"`
	Type          RoutingType                 `json:"type"`
	Field         *RoutingConfigField         `json:"field,omitempty"`
	PodIndex      *RoutingConfigFieldPodIndex `json:"pod_index,omitempty"`
}

type RoutingConfigField struct {
	Name string `json:"name"`
}

type RoutingConfigFieldPodIndex struct {
	Index int `json:"index"`
}

func (c RoutingConfig) Validate() error {
	if c.OutputSubject == "" {
		return fmt.Errorf("output_subject_prefix is required")
	}
	if c.SubjectCount < 0 {
		return fmt.Errorf("subject_count must be positive")
	}
	switch c.Type {
	case RoutingTypePodIndex:
		if c.PodIndex == nil {
			return fmt.Errorf("pod_index config is required for type %q", c.Type)
		}
		if c.PodIndex.Index < 0 {
			return fmt.Errorf("pod_index.index must be non-negative but is %d", c.PodIndex.Index)
		}
	case RoutingTypeRandom, RoutingTypeHash, RoutingTypeName:
		// no extra config needed
	case RoutingTypeField:
		if c.Field == nil {
			return fmt.Errorf("dedup config is required for type %q", c.Type)
		}
		if c.Field.Name == "" {
			return fmt.Errorf("dedup.field is required")
		}
	case RoutingTypeRoundRobin:
		if c.SubjectCount < 1 {
			return fmt.Errorf("subject_count must be >= 1 for type %q", c.Type)
		}
	default:
		return fmt.Errorf("unknown routing type %q", c.Type)
	}
	return nil
}

type OTLPLog struct {
	Timestamp              string            `json:"timestamp"`
	ObservedTimestamp      string            `json:"observed_timestamp"`
	SeverityNumber         uint32            `json:"severity_number"`
	SeverityText           string            `json:"severity_text"`
	Body                   string            `json:"body"`
	TraceID                string            `json:"trace_id,omitempty"`
	SpanID                 string            `json:"span_id,omitempty"`
	Flags                  uint32            `json:"flags"`
	DroppedAttributesCount uint32            `json:"dropped_attributes_count"`
	ResourceAttributes     map[string]string `json:"resource_attributes"`
	ScopeName              string            `json:"scope_name"`
	ScopeVersion           string            `json:"scope_version,omitempty"`
	ScopeAttributes        map[string]string `json:"scope_attributes"`
	Attributes             map[string]string `json:"attributes"`
}

type OTLPSpanEvent struct {
	Timestamp              string            `json:"timestamp"`
	Name                   string            `json:"name"`
	Attributes             map[string]string `json:"attributes"`
	DroppedAttributesCount uint32            `json:"dropped_attributes_count"`
}

type OTLPSpanLink struct {
	TraceID                string            `json:"trace_id,omitempty"`
	SpanID                 string            `json:"span_id,omitempty"`
	TraceState             string            `json:"trace_state,omitempty"`
	Attributes             map[string]string `json:"attributes"`
	DroppedAttributesCount uint32            `json:"dropped_attributes_count"`
}

type OTLPSpan struct {
	TraceID                string            `json:"trace_id,omitempty"`
	SpanID                 string            `json:"span_id,omitempty"`
	ParentSpanID           string            `json:"parent_span_id,omitempty"`
	TraceState             string            `json:"trace_state,omitempty"`
	Flags                  uint32            `json:"flags"`
	Name                   string            `json:"name"`
	Kind                   string            `json:"kind"`
	StartTimestamp         string            `json:"start_timestamp"`
	EndTimestamp           string            `json:"end_timestamp"`
	DurationNS             uint64            `json:"duration_ns"`
	StatusCode             string            `json:"status_code"`
	StatusMessage          string            `json:"status_message,omitempty"`
	DroppedAttributesCount uint32            `json:"dropped_attributes_count"`
	DroppedEventsCount     uint32            `json:"dropped_events_count"`
	DroppedLinksCount      uint32            `json:"dropped_links_count"`
	Events                 []OTLPSpanEvent   `json:"events"`
	Links                  []OTLPSpanLink    `json:"links"`
	ResourceAttributes     map[string]string `json:"resource_attributes"`
	ScopeName              string            `json:"scope_name"`
	ScopeVersion           string            `json:"scope_version,omitempty"`
	ScopeAttributes        map[string]string `json:"scope_attributes"`
	Attributes             map[string]string `json:"attributes"`
}

type OTLPMetric struct {
	Timestamp              string            `json:"timestamp"`
	StartTimestamp         string            `json:"start_timestamp"`
	MetricName             string            `json:"metric_name"`
	MetricDescription      string            `json:"metric_description"`
	MetricUnit             string            `json:"metric_unit"`
	MetricType             string            `json:"metric_type"`
	AggregationTemporality *string           `json:"aggregation_temporality"`
	IsMonotonic            *bool             `json:"is_monotonic"`
	Flags                  uint32            `json:"flags"`
	ValueDouble            *float64          `json:"value_double"`
	ValueInt               *int64            `json:"value_int"`
	Count                  *uint64           `json:"count"`
	Sum                    *float64          `json:"sum"`
	Min                    *float64          `json:"min"`
	Max                    *float64          `json:"max"`
	BucketCounts           []uint64          `json:"bucket_counts"`
	ExplicitBounds         []float64         `json:"explicit_bounds"`
	ResourceAttributes     map[string]string `json:"resource_attributes"`
	ScopeName              string            `json:"scope_name"`
	ScopeVersion           string            `json:"scope_version,omitempty"`
	ScopeAttributes        map[string]string `json:"scope_attributes"`
	Attributes             map[string]string `json:"attributes"`
}

// SchemaFields returns the predefined source schema fields for OTLP source types.
// Returns nil for non-OTLP source types.
func (s SourceType) SchemaFields() []Field {
	switch s {
	case internal.OTLPLogsSourceType:
		return otlpLogsSchemaFields()
	case internal.OTLPMetricsSourceType:
		return otlpMetricsSchemaFields()
	case internal.OTLPTracesSourceType:
		return otlpTracesSchemaFields()
	default:
		return nil
	}
}

func otlpLogsSchemaFields() []Field {
	return []Field{
		{Name: "timestamp", Type: "string"},
		{Name: "observed_timestamp", Type: "string"},
		{Name: "severity_number", Type: "uint"},
		{Name: "severity_text", Type: "string"},
		{Name: "body", Type: "string"},
		{Name: "trace_id", Type: "string"},
		{Name: "span_id", Type: "string"},
		{Name: "flags", Type: "uint"},
		{Name: "dropped_attributes_count", Type: "uint"},
		{Name: "resource_attributes", Type: "map"},
		{Name: "scope_name", Type: "string"},
		{Name: "scope_version", Type: "string"},
		{Name: "scope_attributes", Type: "map"},
		{Name: "attributes", Type: "map"},
	}
}

func otlpMetricsSchemaFields() []Field {
	return []Field{
		{Name: "timestamp", Type: "string"},
		{Name: "start_timestamp", Type: "string"},
		{Name: "metric_name", Type: "string"},
		{Name: "metric_description", Type: "string"},
		{Name: "metric_unit", Type: "string"},
		{Name: "metric_type", Type: "string"},
		{Name: "aggregation_temporality", Type: "string"},
		{Name: "is_monotonic", Type: "bool"},
		{Name: "flags", Type: "uint"},
		{Name: "value_double", Type: "float"},
		{Name: "value_int", Type: "int"},
		{Name: "count", Type: "uint"},
		{Name: "sum", Type: "float"},
		{Name: "min", Type: "float"},
		{Name: "max", Type: "float"},
		{Name: "bucket_counts", Type: "array"},
		{Name: "explicit_bounds", Type: "array"},
		{Name: "resource_attributes", Type: "map"},
		{Name: "scope_name", Type: "string"},
		{Name: "scope_version", Type: "string"},
		{Name: "scope_attributes", Type: "map"},
		{Name: "attributes", Type: "map"},
	}
}

func otlpTracesSchemaFields() []Field {
	return []Field{
		{Name: "trace_id", Type: "string"},
		{Name: "span_id", Type: "string"},
		{Name: "parent_span_id", Type: "string"},
		{Name: "trace_state", Type: "string"},
		{Name: "flags", Type: "uint"},
		{Name: "name", Type: "string"},
		{Name: "kind", Type: "string"},
		{Name: "start_timestamp", Type: "string"},
		{Name: "end_timestamp", Type: "string"},
		{Name: "duration_ns", Type: "uint"},
		{Name: "status_code", Type: "string"},
		{Name: "status_message", Type: "string"},
		{Name: "dropped_attributes_count", Type: "uint"},
		{Name: "dropped_events_count", Type: "uint"},
		{Name: "dropped_links_count", Type: "uint"},
		{Name: "events", Type: "array"},
		{Name: "links", Type: "array"},
		{Name: "resource_attributes", Type: "map"},
		{Name: "scope_name", Type: "string"},
		{Name: "scope_version", Type: "string"},
		{Name: "scope_attributes", Type: "map"},
		{Name: "attributes", Type: "map"},
	}
}
