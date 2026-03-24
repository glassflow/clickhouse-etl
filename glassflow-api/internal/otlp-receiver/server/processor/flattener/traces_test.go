package flattener_test

import (
	"encoding/hex"
	"encoding/json"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	coltracepb "go.opentelemetry.io/proto/otlp/collector/trace/v1"
	commonv1 "go.opentelemetry.io/proto/otlp/common/v1"
	resourcev1 "go.opentelemetry.io/proto/otlp/resource/v1"
	tracev1 "go.opentelemetry.io/proto/otlp/trace/v1"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/otlp-receiver/server/processor/flattener"
)

func TestFlattenTraces(t *testing.T) {
	// Arrange
	startNano := uint64(1705315800000000000)
	endNano := uint64(1705315800045000000)
	eventNano := uint64(1705315800010000000)

	traceID := []byte("my-trace-id-1234") // 16 bytes
	spanID := []byte("my-span-")          // 8 bytes
	parentSpanID := []byte("parent-span")  // 11 bytes — will be hex-encoded
	linkTraceID := []byte("link-trace-id--!") // 16 bytes
	linkSpanID := []byte("lnk-span")           // 8 bytes

	req := &coltracepb.ExportTraceServiceRequest{
		ResourceSpans: []*tracev1.ResourceSpans{
			{
				Resource: &resourcev1.Resource{
					Attributes: []*commonv1.KeyValue{
						{Key: "service.name", Value: &commonv1.AnyValue{Value: &commonv1.AnyValue_StringValue{StringValue: "auth-service"}}},
					},
				},
				ScopeSpans: []*tracev1.ScopeSpans{
					{
						Scope: &commonv1.InstrumentationScope{
							Name:    "com.example.auth",
							Version: "1.0.0",
						},
						Spans: []*tracev1.Span{
							{
								TraceId:            traceID,
								SpanId:             spanID,
								ParentSpanId:       parentSpanID,
								TraceState:         "",
								Flags:              1,
								Name:               "HTTP POST /api/auth/login",
								Kind:               tracev1.Span_SPAN_KIND_SERVER,
								StartTimeUnixNano:  startNano,
								EndTimeUnixNano:    endNano,
								Status:             &tracev1.Status{Code: tracev1.Status_STATUS_CODE_OK, Message: ""},
								DroppedAttributesCount: 0,
								DroppedEventsCount:     0,
								DroppedLinksCount:      0,
								Attributes: []*commonv1.KeyValue{
									{Key: "http.method", Value: &commonv1.AnyValue{Value: &commonv1.AnyValue_StringValue{StringValue: "POST"}}},
								},
								Events: []*tracev1.Span_Event{
									{
										TimeUnixNano: eventNano,
										Name:         "cache.miss",
										Attributes: []*commonv1.KeyValue{
											{Key: "cache.key", Value: &commonv1.AnyValue{Value: &commonv1.AnyValue_StringValue{StringValue: "user:12345"}}},
										},
									},
								},
								Links: []*tracev1.Span_Link{
									{
										TraceId:    linkTraceID,
										SpanId:     linkSpanID,
										TraceState: "vendor=value",
										Attributes: []*commonv1.KeyValue{
											{Key: "link.type", Value: &commonv1.AnyValue{Value: &commonv1.AnyValue_StringValue{StringValue: "follows_from"}}},
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
	messages, err := flattener.FlattenTraces(req)

	// Assert
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(messages) != 1 {
		t.Fatalf("expected 1 message, got %d", len(messages))
	}

	var got models.OTLPSpan
	if err := json.Unmarshal(messages[0].Payload(), &got); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	toTS := func(ns uint64) string {
		return time.Unix(0, int64(ns)).UTC().Format(time.RFC3339Nano)
	}

	want := models.OTLPSpan{
		TraceID:      hex.EncodeToString(traceID),
		SpanID:       hex.EncodeToString(spanID),
		ParentSpanID: hex.EncodeToString(parentSpanID),
		TraceState:   "",
		Flags:        1,
		Name:         "HTTP POST /api/auth/login",
		Kind:         2,
		StartTimestamp: toTS(startNano),
		EndTimestamp:   toTS(endNano),
		DurationNS:     endNano - startNano,
		StatusCode:     "OK",
		StatusMessage:  "",
		DroppedAttributesCount: 0,
		DroppedEventsCount:     0,
		DroppedLinksCount:      0,
		Events: []models.OTLPSpanEvent{
			{
				Timestamp:              toTS(eventNano),
				Name:                   "cache.miss",
				Attributes:             map[string]string{"cache.key": "user:12345"},
				DroppedAttributesCount: 0,
			},
		},
		Links: []models.OTLPSpanLink{
			{
				TraceID:                hex.EncodeToString(linkTraceID),
				SpanID:                 hex.EncodeToString(linkSpanID),
				TraceState:             "vendor=value",
				Attributes:             map[string]string{"link.type": "follows_from"},
				DroppedAttributesCount: 0,
			},
		},
		ResourceAttributes: map[string]string{"service.name": "auth-service"},
		ScopeName:          "com.example.auth",
		ScopeVersion:       "1.0.0",
		ScopeAttributes:    map[string]string{},
		Attributes:         map[string]string{"http.method": "POST"},
	}

	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("mismatch (-want +got):\n%s", diff)
	}
}
