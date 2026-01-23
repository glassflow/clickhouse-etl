package observability

import (
	"context"
	"log/slog"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/trace"
	"go.opentelemetry.io/otel/trace/noop"
)

// ConfigureTracer creates and configures tracing based on the provided configuration
// Tracing is automatically enabled when metrics are enabled
func ConfigureTracer(cfg *Config, log *slog.Logger) trace.Tracer {
	if !cfg.MetricsEnabled {
		// Return no-op tracer when metrics are disabled
		return noop.NewTracerProvider().Tracer("glassflow-etl")
	}

	// Set up OTLP trace exporter
	ctx := context.Background()

	// Create OTLP trace exporter with default configuration
	// This will automatically read OTEL_EXPORTER_OTLP_ENDPOINT from environment
	exporter, err := otlptracehttp.New(ctx)
	if err != nil {
		log.Error("Failed to create OTLP trace exporter", "error", err)
		return noop.NewTracerProvider().Tracer("glassflow-etl")
	}

	// Create resource with service information
	attrs := buildResourceAttributes(cfg)

	res, err := resource.New(ctx, resource.WithAttributes(attrs...))
	if err != nil {
		log.Error("Failed to create resource", "error", err)
		return noop.NewTracerProvider().Tracer("glassflow-etl")
	}

	// Create TracerProvider with OTLP exporter
	tracerProvider := sdktrace.NewTracerProvider(
		sdktrace.WithResource(res),
		sdktrace.WithBatcher(exporter),
	)

	// Set the global TracerProvider
	otel.SetTracerProvider(tracerProvider)

	// Create and return a tracer
	return tracerProvider.Tracer("glassflow-etl")
}
