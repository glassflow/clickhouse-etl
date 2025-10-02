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

	// Sink metrics
	ClickHouseRecordsWritten metric.Int64Counter
	SinkRecordsPerSec        metric.Float64Gauge

	// Common metrics
	ProcessingDuration metric.Float64Histogram

	// Component and pipeline info for labeling
	component  string
	pipelineID string
}

// ConfigureMeter creates and configures metrics based on the provided configuration
func ConfigureMeter(cfg *Config) *Meter {
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
		slog.Error("Failed to create OTLP metrics exporter", "error", err)
		return nil
	}

	// Create resource with service information
	attrs := buildResourceAttributes(cfg)

	res, err := resource.New(ctx, resource.WithAttributes(attrs...))
	if err != nil {
		slog.Error("Failed to create resource", "error", err)
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
		KafkaRecordsRead: mustCreateCounter(meter, "glassflow_kafka_records_read_total",
			"Total number of records read from Kafka"),
		RecordsProcessedPerSec: mustCreateGauge(meter, "glassflow_records_processed_per_second",
			"Number of records processed per second"),
		DLQRecordsWritten: mustCreateCounter(meter, "glassflow_dlq_records_written_total",
			"Total number of records written to dead letter queue"),
		ClickHouseRecordsWritten: mustCreateCounter(meter, "glassflow_clickhouse_records_written_total",
			"Total number of records written to ClickHouse"),
		SinkRecordsPerSec: mustCreateGauge(meter, "glassflow_clickhouse_records_written_per_second",
			"Number of records written to ClickHouse per second"),
		ProcessingDuration: mustCreateHistogram(meter, "glassflow_processing_duration_seconds",
			"Processing duration in seconds"),
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
	)
	if err != nil {
		slog.Error("Failed to create histogram", "name", name, "error", err)
		panic(fmt.Sprintf("failed to create histogram %s: %v", name, err))
	}
	return histogram
}
