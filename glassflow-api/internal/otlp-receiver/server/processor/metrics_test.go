package processor_test

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/nats-io/nats-server/v2/server"
	natsTest "github.com/nats-io/nats-server/v2/test"
	"github.com/nats-io/nats.go/jetstream"
	"github.com/stretchr/testify/require"
	colmetricspb "go.opentelemetry.io/proto/otlp/collector/metrics/v1"
	commonv1 "go.opentelemetry.io/proto/otlp/common/v1"
	metricsv1 "go.opentelemetry.io/proto/otlp/metrics/v1"
	resourcev1 "go.opentelemetry.io/proto/otlp/resource/v1"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/client"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/otlp-receiver/server/processor"
)

func TestProcessMetrics(t *testing.T) {
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

	proc := processor.NewProcessor(&stubOTLPConfigFetcher{}, nc)

	value := 42.5
	req := &colmetricspb.ExportMetricsServiceRequest{
		ResourceMetrics: []*metricsv1.ResourceMetrics{
			{
				Resource: &resourcev1.Resource{
					Attributes: []*commonv1.KeyValue{
						{
							Key:   "service.name",
							Value: &commonv1.AnyValue{Value: &commonv1.AnyValue_StringValue{StringValue: "test-service"}},
						},
					},
				},
				ScopeMetrics: []*metricsv1.ScopeMetrics{
					{
						Scope: &commonv1.InstrumentationScope{Name: "test-scope"},
						Metrics: []*metricsv1.Metric{
							{
								Name:        "test.metric",
								Description: "a test gauge",
								Unit:        "ms",
								Data: &metricsv1.Metric_Gauge{
									Gauge: &metricsv1.Gauge{
										DataPoints: []*metricsv1.NumberDataPoint{
											{
												Value: &metricsv1.NumberDataPoint_AsDouble{AsDouble: value},
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

	err = proc.ProcessMetrics(ctx, "test-pipeline", req)
	require.NoError(t, err)

	consumer, err := nc.JetStream().CreateOrUpdateConsumer(ctx, "testing-otlp-stream", jetstream.ConsumerConfig{
		Name:          "test-consumer",
		FilterSubject: "testing-otlp",
		AckPolicy:     jetstream.AckExplicitPolicy,
	})
	require.NoError(t, err)

	msgBatch, err := consumer.FetchNoWait(1)
	require.NoError(t, err)

	var receivedMsg jetstream.Msg
	for msg := range msgBatch.Messages() {
		receivedMsg = msg
		break
	}
	require.NotNil(t, receivedMsg)

	var metric models.OTLPMetric
	err = json.Unmarshal(receivedMsg.Data(), &metric)
	require.NoError(t, err)

	expected := models.OTLPMetric{
		Timestamp:      "1970-01-01T00:00:00Z",
		StartTimestamp: "1970-01-01T00:00:00Z",
		MetricName:     "test.metric",
		MetricDescription: "a test gauge",
		MetricUnit:     "ms",
		MetricType:     "gauge",
		ValueDouble:    &value,
		BucketCounts:   []uint64{},
		ExplicitBounds: []float64{},
		ResourceAttributes: map[string]string{"service.name": "test-service"},
		ScopeName:      "test-scope",
		ScopeAttributes: map[string]string{},
		Attributes:     map[string]string{},
	}
	require.Equal(t, expected, metric)
}
