package processor_test

// Regression test for ETL-1109: OTLP receiver emits empty pipeline_id label
// on processor_messages_total and bytes_processed_total{direction=out}.
//
// The bug: sendBatch called observability.RecordBytesProcessed /
// RecordProcessorMessages which use the package-level pipelineID variable
// (always "" on the multi-pipeline API server). The fix was to call the
// ByPipelineID variants that accept an explicit parameter. This test proves
// the explicit parameter reaches the metric attributes.

import (
	"context"
	"testing"

	"github.com/nats-io/nats-server/v2/server"
	natsTest "github.com/nats-io/nats-server/v2/test"
	"github.com/nats-io/nats.go/jetstream"
	"github.com/stretchr/testify/require"
	coltracepb "go.opentelemetry.io/proto/otlp/collector/trace/v1"
	commonv1 "go.opentelemetry.io/proto/otlp/common/v1"
	resourcev1 "go.opentelemetry.io/proto/otlp/resource/v1"
	tracev1 "go.opentelemetry.io/proto/otlp/trace/v1"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/sdk/metric/metricdata"

	"github.com/glassflow/clickhouse-etl/glassflow-api/internal/client"
	"github.com/glassflow/clickhouse-etl/glassflow-api/internal/otlp-receiver/server/processor"
	"github.com/glassflow/clickhouse-etl/glassflow-api/pkg/observability"
)

// TestProcessTraces_PipelineIDMetricLabel verifies that after a successful
// ProcessTraces call the out-direction metrics carry the pipeline_id supplied
// by the caller, not the empty package-level variable.
func TestProcessTraces_PipelineIDMetricLabel(t *testing.T) {
	reader := observability.InitMetricsForTesting()
	// SetPipelineID is intentionally NOT called — it is never invoked on the
	// multi-pipeline API server, so the package-level var stays "".

	natsServer := natsTest.RunServer(&server.Options{
		Host:      "127.0.0.1",
		Port:      -1,
		NoLog:     true,
		NoSigs:    true,
		JetStream: true,
	})
	defer natsServer.Shutdown()

	ctx := context.Background()

	nc, err := client.NewNATSClient(ctx, natsServer.ClientURL())
	require.NoError(t, err)
	defer nc.Close()

	_, err = nc.JetStream().CreateStream(ctx, jetstream.StreamConfig{
		Name:     "testing-otlp-stream",
		Subjects: []string{"testing-otlp"},
		Storage:  jetstream.MemoryStorage,
	})
	require.NoError(t, err)

	proc := processor.NewProcessor(&stubOTLPConfigFetcher{}, nc, 50, 1000, nil)

	const pipelineID = "my-pipeline-123"

	req := &coltracepb.ExportTraceServiceRequest{
		ResourceSpans: []*tracev1.ResourceSpans{
			{
				Resource: &resourcev1.Resource{
					Attributes: []*commonv1.KeyValue{
						{
							Key:   "service.name",
							Value: &commonv1.AnyValue{Value: &commonv1.AnyValue_StringValue{StringValue: "test-service"}},
						},
					},
				},
				ScopeSpans: []*tracev1.ScopeSpans{
					{
						Scope: &commonv1.InstrumentationScope{Name: "test-scope"},
						Spans: []*tracev1.Span{{Name: "test-span"}},
					},
				},
			},
		},
	}

	require.NoError(t, proc.ProcessTraces(ctx, pipelineID, req))

	var rm metricdata.ResourceMetrics
	require.NoError(t, reader.Collect(ctx, &rm))

	component := observability.MetricComponentOTLPTraces.String()

	assertCounterHasPoint(t, rm,
		observability.GfMetricPrefix+"_processor_messages_total",
		map[string]string{"pipeline_id": pipelineID, "component": component, "status": "out"},
	)
	assertCounterHasPoint(t, rm,
		observability.GfMetricPrefix+"_bytes_processed_total",
		map[string]string{"pipeline_id": pipelineID, "component": component, "direction": "out"},
	)
}

// assertCounterHasPoint fails t if no data point in the named int64 counter
// matches all required attributes.
func assertCounterHasPoint(t *testing.T, rm metricdata.ResourceMetrics, metricName string, wantAttrs map[string]string) {
	t.Helper()
	for _, sm := range rm.ScopeMetrics {
		for _, m := range sm.Metrics {
			if m.Name != metricName {
				continue
			}
			sum, ok := m.Data.(metricdata.Sum[int64])
			if !ok {
				continue
			}
			for _, dp := range sum.DataPoints {
				if metricAttrsMatch(dp.Attributes, wantAttrs) {
					return
				}
			}
		}
	}
	t.Errorf("metric %q: no data point found with attributes %v", metricName, wantAttrs)
}

func metricAttrsMatch(attrs attribute.Set, want map[string]string) bool {
	for k, v := range want {
		got, ok := attrs.Value(attribute.Key(k))
		if !ok || got.AsString() != v {
			return false
		}
	}
	return true
}
