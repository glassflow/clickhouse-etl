package observability

import (
	"context"
	"io"
	"log/slog"

	"github.com/lmittmann/tint"
	"go.opentelemetry.io/contrib/bridges/otelslog"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/otlp/otlplog/otlploghttp"
	"go.opentelemetry.io/otel/log/global"
	"go.opentelemetry.io/otel/sdk/log"
	"go.opentelemetry.io/otel/sdk/resource"
	semconv "go.opentelemetry.io/otel/semconv/v1.26.0"
)

// ConfigureLogger creates and configures a logger based on the provided configuration
func ConfigureLogger(cfg *Config, logOut io.Writer) *slog.Logger {
	if cfg.OtelObservability {
		return configureOTelLogger(cfg, logOut)
	}

	// Fallback to standard logging when OTel is disabled
	return createStandardLogger(cfg, logOut)
}

// configureOTelLogger sets up OpenTelemetry logging with fallback to standard logging
func configureOTelLogger(cfg *Config, logOut io.Writer) *slog.Logger {
	// Create resource with service information
	attributes := []attribute.KeyValue{
		semconv.ServiceNameKey.String(cfg.ServiceName),
		semconv.ServiceVersionKey.String(cfg.ServiceVersion),
	}

	// Add service namespace if provided
	if cfg.ServiceNamespace != "" {
		attributes = append(attributes, semconv.ServiceNamespaceKey.String(cfg.ServiceNamespace))
	}

	// Add pipeline ID as custom attribute if provided
	if cfg.PipelineID != "" {
		attributes = append(attributes, attribute.String("pipeline_id", cfg.PipelineID))
	}

	res, err := resource.New(context.Background(),
		resource.WithAttributes(attributes...),
	)
	if err != nil {
		// Fallback to standard logging if OTel setup fails
		slog.Error("Failed to create OTel resource, falling back to standard logging", "error", err)
		return createStandardLogger(cfg, logOut)
	}

	// Create OTLP HTTP exporter
	exporter, err := otlploghttp.New(context.Background())
	if err != nil {
		// Fallback to standard logging if OTel setup fails
		slog.Error("Failed to create OTel exporter, falling back to standard logging", "error", err)
		return createStandardLogger(cfg, logOut)
	}

	// Create log processor and provider
	processor := log.NewBatchProcessor(exporter)
	provider := log.NewLoggerProvider(
		log.WithResource(res),
		log.WithProcessor(processor),
	)

	// Set global logger provider
	global.SetLoggerProvider(provider)

	// Create slog handler with OTel bridge
	otelHandler := otelslog.NewHandler(cfg.ServiceName,
		otelslog.WithLoggerProvider(provider),
	)

	// Create a multi-handler that writes to both OTel and local output
	// This ensures logs are still visible locally even when OTel is enabled
	fallbackHandler := createStandardHandler(cfg, logOut)
	multiHandler := &multiSlogHandler{
		otelHandler:     otelHandler,
		fallbackHandler: fallbackHandler,
	}

	return slog.New(multiHandler)
}

// createStandardLogger creates a standard slog logger without OTel
func createStandardLogger(cfg *Config, logOut io.Writer) *slog.Logger {
	return slog.New(createStandardHandler(cfg, logOut))
}

// createStandardHandler creates a standard slog handler
func createStandardHandler(cfg *Config, logOut io.Writer) slog.Handler {
	//nolint: exhaustruct // optional config
	logOpts := &slog.HandlerOptions{
		Level:     cfg.LogLevel,
		AddSource: cfg.LogAddSource,
	}

	switch cfg.LogFormat {
	case "json":
		return slog.NewJSONHandler(logOut, logOpts)
	default:
		//nolint:exhaustruct // optional config
		return tint.NewHandler(logOut, &tint.Options{
			AddSource:  cfg.LogAddSource,
			TimeFormat: "15:04:05",
		})
	}
}

// multiSlogHandler writes to both OTel and local output
type multiSlogHandler struct {
	otelHandler     slog.Handler
	fallbackHandler slog.Handler
}

func (h *multiSlogHandler) Enabled(ctx context.Context, level slog.Level) bool {
	return h.otelHandler.Enabled(ctx, level) || h.fallbackHandler.Enabled(ctx, level)
}

func (h *multiSlogHandler) Handle(ctx context.Context, record slog.Record) error {
	// Send to OTel (this will include trace correlation if context has trace info)
	otelErr := h.otelHandler.Handle(ctx, record)

	// Always send to local output as well for debugging/development
	localErr := h.fallbackHandler.Handle(ctx, record)

	// Return the first error encountered, but ensure both are attempted
	if otelErr != nil {
		return otelErr
	}
	return localErr
}

func (h *multiSlogHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	return &multiSlogHandler{
		otelHandler:     h.otelHandler.WithAttrs(attrs),
		fallbackHandler: h.fallbackHandler.WithAttrs(attrs),
	}
}

func (h *multiSlogHandler) WithGroup(name string) slog.Handler {
	return &multiSlogHandler{
		otelHandler:     h.otelHandler.WithGroup(name),
		fallbackHandler: h.fallbackHandler.WithGroup(name),
	}
}
