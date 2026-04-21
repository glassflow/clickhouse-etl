package processor_test

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/nats-io/nats-server/v2/server"
	natsTest "github.com/nats-io/nats-server/v2/test"
	"github.com/nats-io/nats.go/jetstream"
	"github.com/stretchr/testify/require"
	coltracepb "go.opentelemetry.io/proto/otlp/collector/trace/v1"
	commonv1 "go.opentelemetry.io/proto/otlp/common/v1"
	resourcev1 "go.opentelemetry.io/proto/otlp/resource/v1"
	tracev1 "go.opentelemetry.io/proto/otlp/trace/v1"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/client"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/otlp-receiver/server/processor"
)

func TestProcessTraces(t *testing.T) {
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
						Spans: []*tracev1.Span{
							{
								Name: "test-span",
								Kind: tracev1.Span_SPAN_KIND_CLIENT,
							},
						},
					},
				},
			},
		},
	}

	err = proc.ProcessTraces(ctx, "test-pipeline", req)
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

	var span models.OTLPSpan
	err = json.Unmarshal(receivedMsg.Data(), &span)
	require.NoError(t, err)

	expected := models.OTLPSpan{
		Name:               "test-span",
		Kind:               "CLIENT",
		StartTimestamp:     "1970-01-01T00:00:00Z",
		EndTimestamp:       "1970-01-01T00:00:00Z",
		StatusCode:         "UNSET",
		Events:             []models.OTLPSpanEvent{},
		Links:              []models.OTLPSpanLink{},
		ResourceAttributes: map[string]string{"service.name": "test-service"},
		ScopeName:          "test-scope",
		ScopeAttributes:    map[string]string{},
		Attributes:         map[string]string{},
	}
	require.Equal(t, expected, span)
}
