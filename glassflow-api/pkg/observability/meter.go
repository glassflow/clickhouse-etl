package observability

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetrichttp"
	"go.opentelemetry.io/otel/metric"
	sdkmetric "go.opentelemetry.io/otel/sdk/metric"
	"go.opentelemetry.io/otel/sdk/resource"
)

// Meter holds all the metrics for glassflow components
type Meter struct {
	// Ingestor metrics
	KafkaRecordsRead       metric.Int64Counter
	RecordsProcessedPerSec metric.Float64Gauge
	DLQRecordsWritten      metric.Int64Counter
	RecordsFiltered        metric.Int64Counter

	// Sink metrics
	ClickHouseRecordsWritten metric.Int64Counter
	SinkRecordsPerSec        metric.Float64Gauge

	// NATS-only metrics (for benchmark/noop sink)
	NATSRecordsConsumed metric.Int64Counter
	NATSConsumptionRate metric.Float64Gauge

	// Common metrics
	ProcessingDuration metric.Float64Histogram

	HTTPRequestCount    metric.Int64Counter
	HTTPRequestDuration metric.Float64Histogram

	// Component and pipeline info for labeling
	component  string
	pipelineID string
}

const GfMetricPrefix = "gfm"

// ConfigureMeter creates and configures metrics based on the provided configuration
func ConfigureMeter(cfg *Config, log *slog.Logger) *Meter {
	if !cfg.MetricsEnabled {
		// Return nil meter when metrics are disabled
		return nil
	}

	// Set up OTLP metrics exporter
	ctx := context.Background()

	// Create OTLP metrics exporter with default configuration
	// This will automatically read OTEL_EXPORTER_OTLP_ENDPOINT from environment
	exporter, err := otlpmetrichttp.New(ctx)
	if err != nil {
		log.Error("Failed to create OTLP metrics exporter", "error", err)
		return nil
	}

	// Create resource with service information
	attrs := buildResourceAttributes(cfg)

	res, err := resource.New(ctx, resource.WithAttributes(attrs...))
	if err != nil {
		log.Error("Failed to create resource", "error", err)
		return nil
	}

	// Create MeterProvider with OTLP exporter
	meterProvider := sdkmetric.NewMeterProvider(
		sdkmetric.WithResource(res),
		sdkmetric.WithReader(sdkmetric.NewPeriodicReader(exporter,
			sdkmetric.WithInterval(10*time.Second),
		)),
	)

	// Set the global MeterProvider
	otel.SetMeterProvider(meterProvider)

	return NewMeter(cfg.ServiceName, cfg.PipelineID)
}

// NewMeter creates a new Meter instance with all the required metrics
func NewMeter(component, pipelineID string) *Meter {
	meter := otel.Meter("glassflow-etl")

	return &Meter{
		KafkaRecordsRead: mustCreateCounter(meter, GfMetricPrefix+"_"+"kafka_records_read_total",
			"Total number of records read from Kafka"),
		RecordsProcessedPerSec: mustCreateGauge(meter, GfMetricPrefix+"_"+"records_processed_per_second",
			"Number of records processed per second"),
		DLQRecordsWritten: mustCreateCounter(meter, GfMetricPrefix+"_"+"dlq_records_written_total",
			"Total number of records written to dead letter queue"),
		RecordsFiltered: mustCreateCounter(meter, GfMetricPrefix+"_"+"records_filtered_total",
			"Total number of records filtered out"),
		ClickHouseRecordsWritten: mustCreateCounter(meter, GfMetricPrefix+"_"+"clickhouse_records_written_total",
			"Total number of records written to ClickHouse"),
		SinkRecordsPerSec: mustCreateGauge(meter, GfMetricPrefix+"_"+"clickhouse_records_written_per_second",
			"Number of records written to ClickHouse per second"),
		NATSRecordsConsumed: mustCreateCounter(meter, GfMetricPrefix+"_"+"nats_records_consumed_total",
			"Total number of records consumed from NATS (without ClickHouse write)"),
		NATSConsumptionRate: mustCreateGauge(meter, GfMetricPrefix+"_"+"nats_records_consumed_per_second",
			"Number of records consumed from NATS per second (without ClickHouse write)"),
		ProcessingDuration: mustCreateHistogram(meter, GfMetricPrefix+"_"+"processing_duration_seconds",
			"Processing duration in seconds"),
		HTTPRequestCount: mustCreateCounter(meter, GfMetricPrefix+"_"+"http_server_request_count",
			"Total number of HTTP requests"),
		HTTPRequestDuration: mustCreateHistogram(meter, GfMetricPrefix+"_"+"http_server_request_duration_seconds",
			"Duration of HTTP requests"),
		component:  component,
		pipelineID: pipelineID,
	}
}

// RecordKafkaRead records a Kafka record read
func (m *Meter) RecordKafkaRead(ctx context.Context, count int64) {
	m.KafkaRecordsRead.Add(ctx, count, metric.WithAttributes(
		attribute.String("component", m.component),
		attribute.String("pipeline_id", m.pipelineID),
	))
}

// RecordProcessingRate records the current processing rate
func (m *Meter) RecordProcessingRate(ctx context.Context, rate float64) {
	m.RecordsProcessedPerSec.Record(ctx, rate, metric.WithAttributes(
		attribute.String("component", m.component),
		attribute.String("pipeline_id", m.pipelineID),
	))
}

// RecordDLQWrite records a record written to DLQ
func (m *Meter) RecordDLQWrite(ctx context.Context, count int64) {
	m.DLQRecordsWritten.Add(ctx, count, metric.WithAttributes(
		attribute.String("component", m.component),
		attribute.String("pipeline_id", m.pipelineID),
	))
}

// RecordFilteredMessage records a message that was filtered out
func (m *Meter) RecordFilteredMessage(ctx context.Context, count int64) {
	m.RecordsFiltered.Add(ctx, count, metric.WithAttributes(
		attribute.String("component", m.component),
		attribute.String("pipeline_id", m.pipelineID),
	))
}

// RecordClickHouseWrite records a record written to ClickHouse
func (m *Meter) RecordClickHouseWrite(ctx context.Context, count int64) {
	m.ClickHouseRecordsWritten.Add(ctx, count, metric.WithAttributes(
		attribute.String("component", m.component),
		attribute.String("pipeline_id", m.pipelineID),
	))
}

// RecordSinkRate records the current sink write rate
func (m *Meter) RecordSinkRate(ctx context.Context, rate float64) {
	m.SinkRecordsPerSec.Record(ctx, rate, metric.WithAttributes(
		attribute.String("component", m.component),
		attribute.String("pipeline_id", m.pipelineID),
	))
}

// RecordNATSConsumption records a record consumed from NATS (without ClickHouse write)
func (m *Meter) RecordNATSConsumption(ctx context.Context, count int64) {
	m.NATSRecordsConsumed.Add(ctx, count, metric.WithAttributes(
		attribute.String("component", m.component),
		attribute.String("pipeline_id", m.pipelineID),
	))
}

// RecordNATSConsumptionRate records the current NATS consumption rate (without ClickHouse write)
func (m *Meter) RecordNATSConsumptionRate(ctx context.Context, rate float64) {
	m.NATSConsumptionRate.Record(ctx, rate, metric.WithAttributes(
		attribute.String("component", m.component),
		attribute.String("pipeline_id", m.pipelineID),
	))
}

// RecordProcessingDuration records processing duration
func (m *Meter) RecordProcessingDuration(ctx context.Context, duration float64) {
	m.ProcessingDuration.Record(ctx, duration, metric.WithAttributes(
		attribute.String("component", m.component),
		attribute.String("pipeline_id", m.pipelineID),
	))
}

// Helper functions to create metrics with error handling

func mustCreateCounter(meter metric.Meter, name, description string) metric.Int64Counter {
	counter, err := meter.Int64Counter(
		name,
		metric.WithDescription(description),
		metric.WithUnit("1"), // unit for counters
	)
	if err != nil {
		slog.Error("Failed to create counter", "name", name, "error", err)
		panic(fmt.Sprintf("failed to create counter %s: %v", name, err))
	}
	return counter
}

func mustCreateGauge(meter metric.Meter, name, description string) metric.Float64Gauge {
	gauge, err := meter.Float64Gauge(
		name,
		metric.WithDescription(description),
		metric.WithUnit("1/s"), // records per second
	)
	if err != nil {
		slog.Error("Failed to create gauge", "name", name, "error", err)
		panic(fmt.Sprintf("failed to create gauge %s: %v", name, err))
	}
	return gauge
}

func mustCreateHistogram(meter metric.Meter, name, description string) metric.Float64Histogram {
	histogram, err := meter.Float64Histogram(
		name,
		metric.WithDescription(description),
		metric.WithUnit("s"), // seconds
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
		),
	)
	if err != nil {
		slog.Error("Failed to create histogram", "name", name, "error", err)
		panic(fmt.Sprintf("failed to create histogram %s: %v", name, err))
	}
	return histogram
}
