package flattener_test

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	colmetricspb "go.opentelemetry.io/proto/otlp/collector/metrics/v1"
	commonv1 "go.opentelemetry.io/proto/otlp/common/v1"
	metricsv1 "go.opentelemetry.io/proto/otlp/metrics/v1"
	resourcev1 "go.opentelemetry.io/proto/otlp/resource/v1"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/otlp-receiver/server/processor/flattener"
)

func TestFlattenMetrics_Histogram(t *testing.T) {
	// Arrange
	startNano := uint64(1705315800000000000)
	tsNano := uint64(1705315860000000000)
	sum := 34.567
	minVal := 0.001
	maxVal := 2.345

	req := &colmetricspb.ExportMetricsServiceRequest{
		ResourceMetrics: []*metricsv1.ResourceMetrics{
			{
				Resource: &resourcev1.Resource{
					Attributes: []*commonv1.KeyValue{
						{Key: "service.name", Value: &commonv1.AnyValue{Value: &commonv1.AnyValue_StringValue{StringValue: "api-gateway"}}},
					},
				},
				ScopeMetrics: []*metricsv1.ScopeMetrics{
					{
						Scope: &commonv1.InstrumentationScope{
							Name:    "go.opentelemetry.io/contrib/net/http",
							Version: "0.46.0",
						},
						Metrics: []*metricsv1.Metric{
							{
								Name:        "http.server.request.duration",
								Description: "Duration of HTTP server requests",
								Unit:        "s",
								Data: &metricsv1.Metric_Histogram{
									Histogram: &metricsv1.Histogram{
										AggregationTemporality: metricsv1.AggregationTemporality_AGGREGATION_TEMPORALITY_CUMULATIVE,
										DataPoints: []*metricsv1.HistogramDataPoint{
											{
												StartTimeUnixNano: startNano,
												TimeUnixNano:      tsNano,
												Count:             1250,
												Sum:               &sum,
												Min:               &minVal,
												Max:               &maxVal,
												BucketCounts:      []uint64{120, 450, 380, 200, 80, 20},
												ExplicitBounds:    []float64{0.005, 0.01, 0.025, 0.05, 0.1},
												Flags:             0,
												Attributes: []*commonv1.KeyValue{
													{Key: "http.method", Value: &commonv1.AnyValue{Value: &commonv1.AnyValue_StringValue{StringValue: "GET"}}},
												},
											},
										},
									},
								},
							},
						},
					},
				},
			},
		},
	}

	// Act
	messages, err := flattener.FlattenMetrics(req)

	// Assert
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(messages) != 1 {
		t.Fatalf("expected 1 message, got %d", len(messages))
	}

	var got models.OTLPMetric
	if err := json.Unmarshal(messages[0].Payload(), &got); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	temporality := "CUMULATIVE"
	count := uint64(1250)
	wantSum := 34.567
	wantMin := 0.001
	wantMax := 2.345
	want := models.OTLPMetric{
		Timestamp:              time.Unix(0, int64(tsNano)).UTC().Format(time.RFC3339Nano),
		StartTimestamp:         time.Unix(0, int64(startNano)).UTC().Format(time.RFC3339Nano),
		MetricName:             "http.server.request.duration",
		MetricDescription:      "Duration of HTTP server requests",
		MetricUnit:             "s",
		MetricType:             "histogram",
		AggregationTemporality: &temporality,
		IsMonotonic:            nil,
		Flags:                  0,
		ValueDouble:            nil,
		ValueInt:               nil,
		Count:                  &count,
		Sum:                    &wantSum,
		Min:                    &wantMin,
		Max:                    &wantMax,
		BucketCounts:           []uint64{120, 450, 380, 200, 80, 20},
		ExplicitBounds:         []float64{0.005, 0.01, 0.025, 0.05, 0.1},
		Resource:               map[string]string{"service.name": "api-gateway"},
		ScopeName:              "go.opentelemetry.io/contrib/net/http",
		ScopeVersion:           "0.46.0",
		ScopeAttributes:        map[string]string{},
		Attributes:             map[string]string{"http.method": "GET"},
	}

	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("mismatch (-want +got):\n%s", diff)
	}
}
