package observability

import (
	"go.opentelemetry.io/otel/attribute"
	semconv "go.opentelemetry.io/otel/semconv/v1.24.0"
)

// buildResourceAttributes creates a consistent set of resource attributes for both logging and metrics
func buildResourceAttributes(cfg *Config) []attribute.KeyValue {
	attrs := []attribute.KeyValue{
		semconv.ServiceName(cfg.ServiceName),
		semconv.ServiceVersion(cfg.ServiceVersion),
	}

	// Add service namespace if provided
	if cfg.ServiceNamespace != "" {
		attrs = append(attrs, semconv.ServiceNamespace(cfg.ServiceNamespace))
	}

	// Add pipeline ID as custom attribute if provided
	if cfg.PipelineID != "" {
		attrs = append(attrs, attribute.String("pipeline_id", cfg.PipelineID))
	}

	// Add service instance ID if provided
	if cfg.ServiceInstanceID != "" {
		attrs = append(attrs, semconv.ServiceInstanceID(cfg.ServiceInstanceID))
	}

	return attrs
}
