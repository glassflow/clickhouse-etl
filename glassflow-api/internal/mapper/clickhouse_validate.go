package mapper

import (
	"fmt"
	"strings"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
)

// IsSupportedClickHouseColumnType reports whether the given column type is supported
// by the sink's schema mapper (ConvertValue in types.go). Supported types include
// exact matches for internal.CHType* constants plus pattern-based types:
// FixedString(N), LowCardinality(FixedString(N)), DateTime64(precision, tz),
// Map(...), and Array(...) including Array(Map(...)).
func IsSupportedClickHouseColumnType(columnType string) bool {
	t := strings.TrimSpace(columnType)
	if t == "" {
		return false
	}
	// Exact matches (same set as ConvertValue switch)
	switch t {
	case internal.CHTypeBool,
		internal.CHTypeInt8, internal.CHTypeInt16, internal.CHTypeInt32, internal.CHTypeInt64,
		internal.CHTypeLCInt8, internal.CHTypeLCInt16, internal.CHTypeLCInt32, internal.CHTypeLCInt64,
		internal.CHTypeUInt8, internal.CHTypeUInt16, internal.CHTypeUInt32, internal.CHTypeUInt64,
		internal.CHTypeLCUInt8, internal.CHTypeLCUInt16, internal.CHTypeLCUInt32, internal.CHTypeLCUInt64,
		internal.CHTypeFloat32, internal.CHTypeFloat64,
		internal.CHTypeLCFloat32, internal.CHTypeLCFloat64,
		internal.CHTypeEnum8, internal.CHTypeEnum16, internal.CHTypeUUID,
		internal.CHTypeFString, internal.CHTypeLCString, internal.CHTypeLCFString,
		internal.CHTypeString,
		internal.CHTypeDateTime, internal.CHTypeDateTime64, internal.CHTypeLCDateTime:
		return true
	}
	// Pattern-based: FixedString(N), LowCardinality(FixedString(N))
	if internal.IsFixedStringType(t) {
		return true
	}
	// DateTime64(6, 'UTC') etc.
	if strings.HasPrefix(t, "DateTime") {
		return true
	}
	// Map(String, String), Map(LowCardinality(String), String), etc.
	if strings.HasPrefix(t, "Map(") {
		return true
	}
	// Array(String), Array(Int32), Array(Map(String, String)), etc.
	if strings.HasPrefix(t, "Array(") {
		return true
	}
	return false
}

// ValidateClickHouseColumnType returns an error if columnType is not supported.
// Use this at the API layer to fail create/edit pipeline with a clear message.
func ValidateClickHouseColumnType(columnType string) error {
	if IsSupportedClickHouseColumnType(columnType) {
		return nil
	}
	return fmt.Errorf("unsupported ClickHouse column type: %q", columnType)
}
