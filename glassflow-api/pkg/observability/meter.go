package observability

import (
	"context"
	"fmt"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetrichttp"
	"go.opentelemetry.io/otel/metric"
	sdkmetric "go.opentelemetry.io/otel/sdk/metric"
	"go.opentelemetry.io/otel/sdk/resource"
)

const GfMetricPrefix = "gfm"

// Package-level instrument vars (nil when metrics disabled).
var (
	KafkaRecordsRead         metric.Int64Counter
	DLQRecordsWritten        metric.Int64Counter
	ClickHouseRecordsWritten metric.Int64Counter
	SinkRecordsPerSec        metric.Float64Gauge
	ProcessorMessages        metric.Int64Counter
	ProcessingDuration       metric.Float64Histogram
	HTTPRequestCount         metric.Int64Counter
	HTTPRequestDuration      metric.Float64Histogram
	BytesProcessed           metric.Int64Counter
)

// pipelineID is set once at component startup (not used by the API which handles multiple pipelines).
var pipelineID string

// SetPipelineID stores the pipeline ID for use in all metric recording functions.
// Call this once at component startup before recording any metrics.
func SetPipelineID(id string) {
	pipelineID = id
}

// GetPipelineID returns the pipeline ID set via SetPipelineID.
func GetPipelineID() string {
	return pipelineID
}

// InitMetrics sets up the OTel provider and initialises all instrument vars.
// Returns nil immediately when metrics are disabled; vars remain nil and all
// wrapper functions become no-ops.
func InitMetrics(cfg *Config) error {
	if !cfg.MetricsEnabled {
		return nil
	}

	ctx := context.Background()

	exporter, err := otlpmetrichttp.New(ctx)
	if err != nil {
		return fmt.Errorf("create OTLP metrics exporter: %w", err)
	}

	attrs := buildResourceAttributes(cfg)
	res, err := resource.New(ctx, resource.WithAttributes(attrs...))
	if err != nil {
		return fmt.Errorf("create resource: %w", err)
	}

	meterProvider := sdkmetric.NewMeterProvider(
		sdkmetric.WithResource(res),
		sdkmetric.WithReader(sdkmetric.NewPeriodicReader(exporter,
			sdkmetric.WithInterval(10*time.Second),
		)),
	)
	otel.SetMeterProvider(meterProvider)

	m := otel.Meter("glassflow-etl")

	KafkaRecordsRead = mustCreateCounter(m, GfMetricPrefix+"_"+"kafka_records_read_total",
		"Total number of records read from Kafka")
	DLQRecordsWritten = mustCreateCounter(m, GfMetricPrefix+"_"+"dlq_records_written_total",
		"Total number of records written to dead letter queue")
	ClickHouseRecordsWritten = mustCreateCounter(m, GfMetricPrefix+"_"+"clickhouse_records_written_total",
		"Total number of records written to ClickHouse")
	SinkRecordsPerSec = mustCreateGauge(m, GfMetricPrefix+"_"+"clickhouse_records_written_per_second",
		"Number of records written to ClickHouse per second")
	ProcessingDuration = mustCreateHistogram(m, GfMetricPrefix+"_"+"processing_duration_seconds",
		"Processing duration in seconds")
	HTTPRequestCount = mustCreateCounter(m, GfMetricPrefix+"_"+"http_server_request_count",
		"Total number of HTTP requests")
	HTTPRequestDuration = mustCreateHistogram(m, GfMetricPrefix+"_"+"http_server_request_duration_seconds",
		"Duration of HTTP requests")
	ProcessorMessages = mustCreateCounter(m, GfMetricPrefix+"_"+"processor_messages_total",
		"Total number of messages processed by processor")
	BytesProcessed = mustCreateCounter(m, GfMetricPrefix+"_"+"bytes_processed_total",
		"Total bytes processed by component and direction")

	return nil
}

func mustCreateCounter(m metric.Meter, name, description string) metric.Int64Counter {
	counter, err := m.Int64Counter(name, metric.WithDescription(description), metric.WithUnit("1"))
	if err != nil {
		panic(fmt.Sprintf("failed to create counter %s: %v", name, err))
	}
	return counter
}

func mustCreateGauge(m metric.Meter, name, description string) metric.Float64Gauge {
	gauge, err := m.Float64Gauge(name, metric.WithDescription(description), metric.WithUnit("1/s"))
	if err != nil {
		panic(fmt.Sprintf("failed to create gauge %s: %v", name, err))
	}
	return gauge
}

func mustCreateHistogram(m metric.Meter, name, description string) metric.Float64Histogram {
	histogram, err := m.Float64Histogram(name,
		metric.WithDescription(description),
		metric.WithUnit("s"),
		metric.WithExplicitBucketBoundaries(
			0.001, // 1ms
			0.005, // 5ms
			0.01,  // 10ms
			0.025, // 25ms
			0.05,  // 50ms
			0.1,   // 100ms
			0.25,  // 250ms
			0.5,   // 500ms
			1.0,   // 1s
			2.5,   // 2.5s
			5.0,   // 5s
			10.0,  // 10s
		))
	if err != nil {
		panic(fmt.Sprintf("failed to create histogram %s: %v", name, err))
	}
	return histogram
}

func RecordKafkaRead(ctx context.Context, component string, count int64) {
	if KafkaRecordsRead == nil {
		return
	}
	KafkaRecordsRead.Add(ctx, count, metric.WithAttributes(
		attribute.String("component", component),
		attribute.String("pipeline_id", pipelineID),
	))
}

func RecordDLQWrite(ctx context.Context, component string, count int64) {
	if DLQRecordsWritten == nil {
		return
	}
	DLQRecordsWritten.Add(ctx, count, metric.WithAttributes(
		attribute.String("component", component),
		attribute.String("pipeline_id", pipelineID),
	))
}

func RecordClickHouseWrite(ctx context.Context, component string, count int64) {
	if ClickHouseRecordsWritten == nil {
		return
	}
	ClickHouseRecordsWritten.Add(ctx, count, metric.WithAttributes(
		attribute.String("component", component),
		attribute.String("pipeline_id", pipelineID),
	))
}

func RecordSinkRate(ctx context.Context, component string, rate float64) {
	if SinkRecordsPerSec == nil {
		return
	}
	SinkRecordsPerSec.Record(ctx, rate, metric.WithAttributes(
		attribute.String("component", component),
		attribute.String("pipeline_id", pipelineID),
	))
}

func RecordProcessingDuration(ctx context.Context, component string, duration float64) {
	if ProcessingDuration == nil {
		return
	}
	ProcessingDuration.Record(ctx, duration, metric.WithAttributes(
		attribute.String("component", component),
		attribute.String("pipeline_id", pipelineID),
	))
}

func RecordProcessingDurationWithStage(ctx context.Context, component, stage string, duration float64) {
	if ProcessingDuration == nil {
		return
	}
	ProcessingDuration.Record(ctx, duration, metric.WithAttributes(
		attribute.String("component", component),
		attribute.String("pipeline_id", pipelineID),
		attribute.String("stage", stage),
	))
}

func RecordProcessorMessages(ctx context.Context, component, status string, count int64) {
	if ProcessorMessages == nil {
		return
	}
	ProcessorMessages.Add(ctx, count, metric.WithAttributes(
		attribute.String("component", component),
		attribute.String("pipeline_id", pipelineID),
		attribute.String("status", status),
	))
}

func RecordBytesProcessed(ctx context.Context, component, direction string, bytes int64) {
	if BytesProcessed == nil {
		return
	}
	BytesProcessed.Add(ctx, bytes, metric.WithAttributes(
		attribute.String("component", component),
		attribute.String("pipeline_id", pipelineID),
		attribute.String("direction", direction),
	))
}

func RecordHTTPRequest(ctx context.Context, method, route string, status int, duration float64) {
	attrs := []attribute.KeyValue{
		attribute.String("method", method),
		attribute.String("path", route),
		attribute.Int("status", status),
	}
	if HTTPRequestCount != nil {
		HTTPRequestCount.Add(ctx, 1, metric.WithAttributes(attrs...))
	}
	if HTTPRequestDuration != nil {
		HTTPRequestDuration.Record(ctx, duration, metric.WithAttributes(attrs...))
	}
}
