package flattener

import (
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strconv"
	"time"

	collogspb "go.opentelemetry.io/proto/otlp/collector/logs/v1"
	commonv1 "go.opentelemetry.io/proto/otlp/common/v1"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

func FlattenLogs(req *collogspb.ExportLogsServiceRequest) ([]models.Message, error) {
	var messages []models.Message
	for _, rl := range req.GetResourceLogs() {
		resourceAttrs := attrsToMap(rl.GetResource().GetAttributes())
		for _, sl := range rl.GetScopeLogs() {
			scope := sl.GetScope()
			scopeAttrs := attrsToMap(scope.GetAttributes())
			for _, r := range sl.GetLogRecords() {
				log := models.OTLPLog{
					Timestamp:              unixNanoToRFC3339(r.GetTimeUnixNano()),
					ObservedTimestamp:      unixNanoToRFC3339(r.GetObservedTimeUnixNano()),
					SeverityNumber:         uint32(r.GetSeverityNumber()),
					SeverityText:           r.GetSeverityText(),
					Body:                   anyValueToString(r.GetBody()),
					TraceID:                encodeID(r.GetTraceId()),
					SpanID:                 encodeID(r.GetSpanId()),
					Flags:                  r.GetFlags(),
					DroppedAttributesCount: r.GetDroppedAttributesCount(),
					ResourceAttributes:     resourceAttrs,
					ScopeName:              scope.GetName(),
					ScopeVersion:           scope.GetVersion(),
					ScopeAttributes:        scopeAttrs,
					Attributes:             attrsToMap(r.GetAttributes()),
				}
				payload, err := json.Marshal(log)
				if err != nil {
					return nil, fmt.Errorf("marshal log record: %w", err)
				}
				messages = append(messages, models.NewNatsMessage(payload, nil))
			}
		}
	}

	return messages, nil
}

func attrsToMap(attrs []*commonv1.KeyValue) map[string]string {
	m := make(map[string]string, len(attrs))
	for _, kv := range attrs {
		m[kv.GetKey()] = anyValueToString(kv.GetValue())
	}
	return m
}

func anyValueToString(v *commonv1.AnyValue) string {
	if v == nil {
		return ""
	}
	switch val := v.GetValue().(type) {
	case *commonv1.AnyValue_StringValue:
		return val.StringValue
	case *commonv1.AnyValue_BoolValue:
		return strconv.FormatBool(val.BoolValue)
	case *commonv1.AnyValue_IntValue:
		return strconv.FormatInt(val.IntValue, 10)
	case *commonv1.AnyValue_DoubleValue:
		return strconv.FormatFloat(val.DoubleValue, 'f', -1, 64)
	case *commonv1.AnyValue_BytesValue:
		return hex.EncodeToString(val.BytesValue)
	case *commonv1.AnyValue_ArrayValue, *commonv1.AnyValue_KvlistValue:
		b, err := json.Marshal(v)
		if err != nil {
			return ""
		}
		return string(b)
	default:
		return ""
	}
}

func encodeID(b []byte) string {
	for _, c := range b {
		if c != 0 {
			return hex.EncodeToString(b)
		}
	}
	return ""
}

func unixNanoToRFC3339(ns uint64) string {
	return time.Unix(0, int64(ns)).UTC().Format(time.RFC3339Nano)
}
