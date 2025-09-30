package observability

import "log/slog"

// Config holds the configuration for observability
type Config struct {
	// Logging configuration
	LogFormat    string
	LogLevel     slog.Level
	LogAddSource bool

	// OpenTelemetry configuration
	OtelObservability bool
	ServiceName       string
	ServiceVersion    string
	ServiceNamespace  string
	PipelineID        string
}
