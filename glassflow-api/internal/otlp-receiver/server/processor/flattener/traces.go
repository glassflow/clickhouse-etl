package flattener

import (
	"encoding/json"
	"fmt"

	coltracepb "go.opentelemetry.io/proto/otlp/collector/trace/v1"
	tracev1 "go.opentelemetry.io/proto/otlp/trace/v1"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

func FlattenTraces(req *coltracepb.ExportTraceServiceRequest) ([]models.Message, error) {
	var messages []models.Message
	for _, rs := range req.GetResourceSpans() {
		resourceAttrs := attrsToMap(rs.GetResource().GetAttributes())
		for _, ss := range rs.GetScopeSpans() {
			scope := ss.GetScope()
			scopeAttrs := attrsToMap(scope.GetAttributes())
			for _, s := range ss.GetSpans() {
				startNS := s.GetStartTimeUnixNano()
				endNS := s.GetEndTimeUnixNano()
				span := models.OTLPSpan{
					TraceID:                encodeID(s.GetTraceId()),
					SpanID:                 encodeID(s.GetSpanId()),
					ParentSpanID:           encodeID(s.GetParentSpanId()),
					TraceState:             s.GetTraceState(),
					Flags:                  s.GetFlags(),
					Name:                   s.GetName(),
					Kind:                   spanKindToString(s.GetKind()),
					StartTimestamp:         unixNanoToRFC3339(startNS),
					EndTimestamp:           unixNanoToRFC3339(endNS),
					DurationNS:             endNS - startNS,
					StatusCode:             spanStatusCodeToString(s.GetStatus().GetCode()),
					StatusMessage:          s.GetStatus().GetMessage(),
					DroppedAttributesCount: s.GetDroppedAttributesCount(),
					DroppedEventsCount:     s.GetDroppedEventsCount(),
					DroppedLinksCount:      s.GetDroppedLinksCount(),
					Events:                 flattenEvents(s.GetEvents()),
					Links:                  flattenLinks(s.GetLinks()),
					ResourceAttributes:     resourceAttrs,
					ScopeName:              scope.GetName(),
					ScopeVersion:           scope.GetVersion(),
					ScopeAttributes:        scopeAttrs,
					Attributes:             attrsToMap(s.GetAttributes()),
				}
				payload, err := json.Marshal(span)
				if err != nil {
					return nil, fmt.Errorf("marshal span: %w", err)
				}
				messages = append(messages, models.NewNatsMessage(payload, nil))
			}
		}
	}
	return messages, nil
}

func flattenEvents(events []*tracev1.Span_Event) []models.OTLPSpanEvent {
	result := make([]models.OTLPSpanEvent, len(events))
	for i, e := range events {
		result[i] = models.OTLPSpanEvent{
			Timestamp:              unixNanoToRFC3339(e.GetTimeUnixNano()),
			Name:                   e.GetName(),
			Attributes:             attrsToMap(e.GetAttributes()),
			DroppedAttributesCount: e.GetDroppedAttributesCount(),
		}
	}
	return result
}

func flattenLinks(links []*tracev1.Span_Link) []models.OTLPSpanLink {
	result := make([]models.OTLPSpanLink, len(links))
	for i, l := range links {
		result[i] = models.OTLPSpanLink{
			TraceID:                encodeID(l.GetTraceId()),
			SpanID:                 encodeID(l.GetSpanId()),
			TraceState:             l.GetTraceState(),
			Attributes:             attrsToMap(l.GetAttributes()),
			DroppedAttributesCount: l.GetDroppedAttributesCount(),
		}
	}
	return result
}

func spanStatusCodeToString(code tracev1.Status_StatusCode) string {
	switch code {
	case tracev1.Status_STATUS_CODE_OK:
		return "OK"
	case tracev1.Status_STATUS_CODE_ERROR:
		return "ERROR"
	default:
		return "UNSET"
	}
}

var spanKindName = map[tracev1.Span_SpanKind]string{
	tracev1.Span_SPAN_KIND_UNSPECIFIED: "UNSPECIFIED",
	tracev1.Span_SPAN_KIND_INTERNAL:    "INTERNAL",
	tracev1.Span_SPAN_KIND_SERVER:      "SERVER",
	tracev1.Span_SPAN_KIND_CLIENT:      "CLIENT",
	tracev1.Span_SPAN_KIND_PRODUCER:    "PRODUCER",
	tracev1.Span_SPAN_KIND_CONSUMER:    "CONSUMER",
}

func spanKindToString(kind tracev1.Span_SpanKind) string {
	if s, ok := spanKindName[kind]; ok {
		return s
	}
	return "UNSPECIFIED"
}
