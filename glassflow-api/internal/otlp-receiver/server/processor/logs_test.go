package processor_test

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/nats-io/nats-server/v2/server"
	natsTest "github.com/nats-io/nats-server/v2/test"
	"github.com/nats-io/nats.go/jetstream"
	"github.com/stretchr/testify/require"
	collogspb "go.opentelemetry.io/proto/otlp/collector/logs/v1"
	commonv1 "go.opentelemetry.io/proto/otlp/common/v1"
	logsv1 "go.opentelemetry.io/proto/otlp/logs/v1"
	resourcev1 "go.opentelemetry.io/proto/otlp/resource/v1"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/client"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/otlp-receiver/server/processor"
)

type stubOTLPConfigFetcher struct{}

func (s *stubOTLPConfigFetcher) GetOTLPConfig(_ context.Context, _ string) (models.OTLPConfig, error) {
	return models.OTLPConfig{
		Routing: models.RoutingConfig{
			OutputSubject: "testing-otlp",
			SubjectCount:  1,
			Type:          models.RoutingTypeName,
		},
		Status: "active",
	}, nil
}

func TestProcessLogs(t *testing.T) {
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

	req := &collogspb.ExportLogsServiceRequest{
		ResourceLogs: []*logsv1.ResourceLogs{
			{
				Resource: &resourcev1.Resource{
					Attributes: []*commonv1.KeyValue{
						{
							Key:   "service.name",
							Value: &commonv1.AnyValue{Value: &commonv1.AnyValue_StringValue{StringValue: "test-service"}},
						},
					},
				},
				ScopeLogs: []*logsv1.ScopeLogs{
					{
						Scope: &commonv1.InstrumentationScope{Name: "test-scope"},
						LogRecords: []*logsv1.LogRecord{
							{
								SeverityText:   "INFO",
								SeverityNumber: 9,
								Body:           &commonv1.AnyValue{Value: &commonv1.AnyValue_StringValue{StringValue: "test log message"}},
							},
						},
					},
				},
			},
		},
	}

	err = proc.ProcessLogs(ctx, "test-pipeline", req)
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

	var logRecord models.OTLPLog
	err = json.Unmarshal(receivedMsg.Data(), &logRecord)
	require.NoError(t, err)

	expected := models.OTLPLog{
		Timestamp:              "1970-01-01T00:00:00Z",
		ObservedTimestamp:      "1970-01-01T00:00:00Z",
		SeverityNumber:         9,
		SeverityText:           "INFO",
		Body:                   "test log message",
		ResourceAttributes:     map[string]string{"service.name": "test-service"},
		ScopeName:              "test-scope",
		ScopeAttributes:        map[string]string{},
		Attributes:             map[string]string{},
	}
	require.Equal(t, expected, logRecord)
}
