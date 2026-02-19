package schema

import (
	"testing"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
)

func TestIsSupportedClickHouseColumnType(t *testing.T) {
	tests := []struct {
		name       string
		columnType string
		want       bool
	}{
		// Exact matches
		{"String", internal.CHTypeString, true},
		{"Bool", internal.CHTypeBool, true},
		{"Int32", internal.CHTypeInt32, true},
		{"UInt64", internal.CHTypeUInt64, true},
		{"Float64", internal.CHTypeFloat64, true},
		{"DateTime", internal.CHTypeDateTime, true},
		{"DateTime64", internal.CHTypeDateTime64, true},
		{"UUID", internal.CHTypeUUID, true},
		{"LowCardinality(String)", internal.CHTypeLCString, true},
		{"FixedString", internal.CHTypeFString, true},
		// Pattern-based
		{"DateTime64(6, 'UTC')", "DateTime64(6, 'UTC')", true},
		{"Array(String)", "Array(String)", true},
		{"Array(Int32)", "Array(Int32)", true},
		{"Map(String, String)", "Map(String, String)", true},
		{"Array(Map(String, String))", "Array(Map(String, String))", true},
		{"FixedString(32)", "FixedString(32)", true},
		// Unsupported
		{"Unsupported", "Unsupported", false},
		{"UnknownType", "UnknownType", false},
		{"empty", "", false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := IsSupportedClickHouseColumnType(tt.columnType); got != tt.want {
				t.Errorf("IsSupportedClickHouseColumnType(%q) = %v, want %v", tt.columnType, got, tt.want)
			}
		})
	}
}

func TestValidateClickHouseColumnType(t *testing.T) {
	t.Run("supported", func(t *testing.T) {
		if err := ValidateClickHouseColumnType("String"); err != nil {
			t.Errorf("ValidateClickHouseColumnType(String) = %v", err)
		}
		if err := ValidateClickHouseColumnType("Array(Int32)"); err != nil {
			t.Errorf("ValidateClickHouseColumnType(Array(Int32)) = %v", err)
		}
	})
	t.Run("unsupported", func(t *testing.T) {
		err := ValidateClickHouseColumnType("Unsupported")
		if err == nil {
			t.Fatal("ValidateClickHouseColumnType(Unsupported) expected error")
		}
		if err.Error() != "unsupported ClickHouse column type: \"Unsupported\"" {
			t.Errorf("unexpected error: %v", err)
		}
	})
}
