package flattener_test

import (
	"encoding/hex"
	"encoding/json"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	collogspb "go.opentelemetry.io/proto/otlp/collector/logs/v1"
	commonv1 "go.opentelemetry.io/proto/otlp/common/v1"
	logsv1 "go.opentelemetry.io/proto/otlp/logs/v1"
	resourcev1 "go.opentelemetry.io/proto/otlp/resource/v1"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/otlp-receiver/server/processor/flattener"
)

func TestFlattenLogs(t *testing.T) {
	// Arrange
	tsNano := uint64(1705315800123456789)
	traceID := []byte("my-trace-id-1234") // 16 bytes
	spanID := []byte("my-span-")          // 8 bytes

	req := &collogspb.ExportLogsServiceRequest{
		ResourceLogs: []*logsv1.ResourceLogs{
			{
				Resource: &resourcev1.Resource{
					Attributes: []*commonv1.KeyValue{
						{Key: "service.name", Value: &commonv1.AnyValue{Value: &commonv1.AnyValue_StringValue{StringValue: "auth-service"}}},
					},
				},
				ScopeLogs: []*logsv1.ScopeLogs{
					{
						Scope: &commonv1.InstrumentationScope{
							Name:    "com.example.auth",
							Version: "1.0.0",
						},
						LogRecords: []*logsv1.LogRecord{
							{
								TimeUnixNano:         tsNano,
								ObservedTimeUnixNano: tsNano,
								SeverityNumber:       logsv1.SeverityNumber_SEVERITY_NUMBER_INFO,
								SeverityText:         "INFO",
								Body:                 &commonv1.AnyValue{Value: &commonv1.AnyValue_StringValue{StringValue: "User authentication successful"}},
								TraceId:              traceID,
								SpanId:               spanID,
								Flags:                1,
								Attributes: []*commonv1.KeyValue{
									{Key: "http.method", Value: &commonv1.AnyValue{Value: &commonv1.AnyValue_StringValue{StringValue: "POST"}}},
								},
							},
						},
					},
				},
			},
		},
	}

	// Act
	messages, err := flattener.FlattenLogs(req)

	// Assert
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(messages) != 1 {
		t.Fatalf("expected 1 message, got %d", len(messages))
	}

	var got models.OTLPLog
	if err := json.Unmarshal(messages[0].Payload(), &got); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	ts := time.Unix(0, int64(tsNano)).UTC().Format(time.RFC3339Nano)
	want := models.OTLPLog{
		Timestamp:              ts,
		ObservedTimestamp:      ts,
		SeverityNumber:         9,
		SeverityText:           "INFO",
		Body:                   "User authentication successful",
		TraceID:                hex.EncodeToString(traceID),
		SpanID:                 hex.EncodeToString(spanID),
		Flags:                  1,
		DroppedAttributesCount: 0,
		ResourceAttributes:     map[string]string{"service.name": "auth-service"},
		ScopeName:              "com.example.auth",
		ScopeVersion:           "1.0.0",
		ScopeAttributes:        map[string]string{},
		Attributes:             map[string]string{"http.method": "POST"},
	}

	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("mismatch (-want +got):\n%s", diff)
	}
}
