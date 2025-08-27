package schema

import (
	"reflect"
	"testing"
	"time"
)

func TestExtractEventValue(t *testing.T) {
	tests := []struct {
		name     string
		dataType KafkaDataType
		input    any
		want     any
		wantErr  bool
	}{
		{
			name:     "string conversion",
			dataType: KafkaTypeString,
			input:    "test",
			want:     "test",
			wantErr:  false,
		},
		{
			name:     "bool conversion",
			dataType: KafkaTypeBool,
			input:    true,
			want:     true,
			wantErr:  false,
		},
		{
			name:     "int conversion",
			dataType: KafkaTypeInt,
			input:    42,
			want:     int64(42),
			wantErr:  false,
		},
		{
			name:     "int8 conversion",
			dataType: KafkaTypeInt8,
			input:    int8(8),
			want:     int8(8),
			wantErr:  false,
		},
		{
			name:     "int16 conversion",
			dataType: KafkaTypeInt16,
			input:    int16(16),
			want:     int16(16),
			wantErr:  false,
		},
		{
			name:     "int32 conversion",
			dataType: KafkaTypeInt32,
			input:    int32(32),
			want:     int32(32),
			wantErr:  false,
		},
		{
			name:     "int64 conversion",
			dataType: KafkaTypeInt64,
			input:    int64(64),
			want:     int64(64),
			wantErr:  false,
		},
		{
			name:     "uint conversion",
			dataType: KafkaTypeUint,
			input:    uint(42),
			want:     uint64(42),
			wantErr:  false,
		},
		{
			name:     "uint8 conversion",
			dataType: KafkaTypeUint8,
			input:    uint8(8),
			want:     uint8(8),
			wantErr:  false,
		},
		{
			name:     "uint16 conversion",
			dataType: KafkaTypeUint16,
			input:    uint16(16),
			want:     uint16(16),
			wantErr:  false,
		},
		{
			name:     "uint32 conversion",
			dataType: KafkaTypeUint32,
			input:    uint32(32),
			want:     uint32(32),
			wantErr:  false,
		},
		{
			name:     "uint64 conversion",
			dataType: KafkaTypeUint64,
			input:    uint64(64),
			want:     uint64(64),
			wantErr:  false,
		},
		{
			name:     "float conversion",
			dataType: KafkaTypeFloat,
			input:    3.14,
			want:     3.14,
			wantErr:  false,
		},
		{
			name:     "float32 conversion",
			dataType: KafkaTypeFloat32,
			input:    float32(3.14),
			want:     float32(3.14),
			wantErr:  false,
		},
		{
			name:     "float64 conversion",
			dataType: KafkaTypeFloat64,
			input:    float64(3.14),
			want:     float64(3.14),
			wantErr:  false,
		},
		{
			name:     "invalid type",
			dataType: "unsupported",
			input:    42,
			want:     nil,
			wantErr:  false,
		},
		{
			name:     "array of strings",
			dataType: KafkaTypeArray,
			input:    []any{"test1", "test2", "test3"},
			want:     []any{"test1", "test2", "test3"},
			wantErr:  false,
		},
		{
			name:     "array of integers",
			dataType: KafkaTypeArray,
			input:    []any{1, 2, 3, 4, 5},
			want:     []any{1, 2, 3, 4, 5},
			wantErr:  false,
		},
		{
			name:     "array of mixed types",
			dataType: KafkaTypeArray,
			input:    []any{"string", 42, true, 3.14},
			want:     []any{"string", 42, true, 3.14},
			wantErr:  false,
		},
		{
			name:     "empty array",
			dataType: KafkaTypeArray,
			input:    []any{},
			want:     []any{},
			wantErr:  false,
		},
		{
			name:     "nil array",
			dataType: KafkaTypeArray,
			input:    nil,
			want:     nil,
			wantErr:  false,
		},
		{
			name:     "nested arrays",
			dataType: KafkaTypeArray,
			input:    []any{[]any{1, 2}, []any{3, 4}},
			want:     []any{[]any{1, 2}, []any{3, 4}},
			wantErr:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := ExtractEventValue(tt.dataType, tt.input)
			if (err != nil) != tt.wantErr {
				t.Errorf("ExtractEventValue() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !reflect.DeepEqual(got, tt.want) {
				t.Errorf("ExtractEventValue() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestConvertValue(t *testing.T) {
	tests := []struct {
		name       string
		columnType ClickHouseDataType
		fieldType  KafkaDataType
		input      any
		want       any
		wantErr    bool
	}{
		{
			name:       "string to String",
			columnType: CHTypeString,
			fieldType:  KafkaTypeString,
			input:      "test",
			want:       "test",
			wantErr:    false,
		},
		{
			name:       "bool to Bool",
			columnType: CHTypeBool,
			fieldType:  KafkaTypeBool,
			input:      true,
			want:       true,
			wantErr:    false,
		},
		{
			name:       "int8 to Int8",
			columnType: CHTypeInt8,
			fieldType:  KafkaTypeInt8,
			input:      int8(8),
			want:       int8(8),
			wantErr:    false,
		},
		{
			name:       "int to Int8",
			columnType: CHTypeInt8,
			fieldType:  KafkaTypeInt,
			input:      8,
			want:       int8(8),
			wantErr:    false,
		},
		{
			name:       "int16 to Int16",
			columnType: CHTypeInt16,
			fieldType:  KafkaTypeInt16,
			input:      int16(16),
			want:       int16(16),
			wantErr:    false,
		},
		{
			name:       "int32 to Int32",
			columnType: CHTypeInt32,
			fieldType:  KafkaTypeInt32,
			input:      int32(32),
			want:       int32(32),
			wantErr:    false,
		},
		{
			name:       "int64 to Int64",
			columnType: CHTypeInt64,
			fieldType:  KafkaTypeInt64,
			input:      int64(64),
			want:       int64(64),
			wantErr:    false,
		},
		{
			name:       "uint8 to UInt8",
			columnType: CHTypeUInt8,
			fieldType:  KafkaTypeUint8,
			input:      uint8(8),
			want:       uint8(8),
			wantErr:    false,
		},
		{
			name:       "uint to UInt8",
			columnType: CHTypeUInt8,
			fieldType:  KafkaTypeUint,
			input:      uint(8),
			want:       uint8(8),
			wantErr:    false,
		},
		{
			name:       "uint16 to UInt16",
			columnType: CHTypeUInt16,
			fieldType:  KafkaTypeUint16,
			input:      uint16(16),
			want:       uint16(16),
			wantErr:    false,
		},
		{
			name:       "uint32 to UInt32",
			columnType: CHTypeUInt32,
			fieldType:  KafkaTypeUint32,
			input:      uint32(32),
			want:       uint32(32),
			wantErr:    false,
		},
		{
			name:       "uint64 to UInt64",
			columnType: CHTypeUInt64,
			fieldType:  KafkaTypeUint64,
			input:      uint64(64),
			want:       uint64(64),
			wantErr:    false,
		},
		{
			name:       "float32 to Float32",
			columnType: CHTypeFloat32,
			fieldType:  KafkaTypeFloat32,
			input:      float32(3.14),
			want:       float32(3.14),
			wantErr:    false,
		},
		{
			name:       "float64 to Float64",
			columnType: CHTypeFloat64,
			fieldType:  KafkaTypeFloat64,
			input:      float64(3.14),
			want:       float64(3.14),
			wantErr:    false,
		},
		{
			name:       "string to Enum8",
			columnType: CHTypeEnum8,
			fieldType:  KafkaTypeString,
			input:      "value",
			want:       "value",
			wantErr:    false,
		},
		{
			name:       "string to UUID",
			columnType: CHTypeUUID,
			fieldType:  KafkaTypeString,
			input:      "550e8400-e29b-41d4-a716-446655440000",
			want:       "550e8400-e29b-41d4-a716-446655440000",
			wantErr:    false,
		},
		{
			name:       "mismatched types: int to Bool",
			columnType: CHTypeBool,
			fieldType:  KafkaTypeInt,
			input:      1,
			want:       nil,
			wantErr:    true,
		},
		{
			name:       "mismatched types: string to Int8",
			columnType: CHTypeInt8,
			fieldType:  KafkaTypeString,
			input:      "8",
			want:       nil,
			wantErr:    true,
		},
		{
			name:       "int64 to DateTime",
			columnType: CHTypeDateTime,
			fieldType:  KafkaTypeInt64,
			input:      int64(1609459200), // 2021-01-01 00:00:00
			want:       time.Unix(1609459200, 0),
			wantErr:    false,
		},
		{
			name:       "float64 to DateTime",
			columnType: CHTypeDateTime,
			fieldType:  KafkaTypeFloat64,
			input:      float64(1609459200.0),
			want:       time.Unix(1609459200, 0),
			wantErr:    false,
		},
		{
			name:       "string to DateTime",
			columnType: CHTypeDateTime,
			fieldType:  KafkaTypeString,
			input:      "2021-01-01 00:00:00",
			want:       time.Date(2021, 1, 1, 0, 0, 0, 0, time.UTC),
			wantErr:    false,
		},
		{
			name:       "unsupported ClickHouse type",
			columnType: "Unsupported",
			fieldType:  KafkaTypeString,
			input:      "test",
			want:       nil,
			wantErr:    true,
		},
		{
			name:       "Array(String) with array of strings",
			columnType: "Array(String)",
			fieldType:  KafkaTypeArray,
			input:      []any{"test1", "test2", "test3"},
			want:       []any{"test1", "test2", "test3"},
			wantErr:    false,
		},
		{
			name:       "Array(Int32) with array of integers",
			columnType: "Array(Int32)",
			fieldType:  KafkaTypeArray,
			input:      []any{1, 2, 3, 4, 5},
			want:       []any{1, 2, 3, 4, 5},
			wantErr:    false,
		},
		{
			name:       "Array(String) with mixed array",
			columnType: "Array(String)",
			fieldType:  KafkaTypeArray,
			input:      []any{"string", 42, true, 3.14},
			want:       []any{"string", 42, true, 3.14},
			wantErr:    false,
		},
		{
			name:       "Array(String) with empty array",
			columnType: "Array(String)",
			fieldType:  KafkaTypeArray,
			input:      []any{},
			want:       []any{},
			wantErr:    false,
		},
		{
			name:       "Array(String) with nil array",
			columnType: "Array(String)",
			fieldType:  KafkaTypeArray,
			input:      nil,
			want:       nil,
			wantErr:    false,
		},
		{
			name:       "Array(String) with non-array data",
			columnType: "Array(String)",
			fieldType:  KafkaTypeString,
			input:      "not an array",
			want:       nil,
			wantErr:    true,
		},
		{
			name:       "Array(Int32) with string field type",
			columnType: "Array(Int32)",
			fieldType:  KafkaTypeString,
			input:      "not an array",
			want:       nil,
			wantErr:    true,
		},
		{
			name:       "Array(String) with nested arrays",
			columnType: "Array(String)",
			fieldType:  KafkaTypeArray,
			input:      []any{[]any{1, 2}, []any{3, 4}},
			want:       []any{[]any{1, 2}, []any{3, 4}},
			wantErr:    false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := ConvertValue(tt.columnType, tt.fieldType, tt.input)
			if (err != nil) != tt.wantErr {
				t.Errorf("ConvertValue() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr && !reflect.DeepEqual(got, tt.want) {
				t.Errorf("ConvertValue() = %v, want %v", got, tt.want)
			}
		})
	}
}

// Test individual parsing functions if they're exported
func TestParsers(t *testing.T) {
	t.Run("ParseString", func(t *testing.T) {
		tests := []struct {
			name    string
			input   any
			want    string
			wantErr bool
		}{
			{"string input", "test", "test", false},
			{"int input", 42, "42", true},
			{"float input", 3.14, "3.14", true},
			{"bool input", true, "true", true},
			{"nil input", nil, "", true},
		}

		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				got, err := ParseString(tt.input)
				if (err != nil) != tt.wantErr {
					t.Errorf("ParseString() error = %v, wantErr %v", err, tt.wantErr)
					return
				}
				if !tt.wantErr && got != tt.want {
					t.Errorf("ParseString() = %v, want %v", got, tt.want)
				}
			})
		}
	})

	t.Run("ParseBool", func(t *testing.T) {
		tests := []struct {
			name    string
			input   any
			want    bool
			wantErr bool
		}{
			{"bool input: true", true, true, false},
			{"bool input: false", false, false, false},
			{"string input", "true", false, true},
			{"int input", 1, false, true},
			{"nil input", nil, false, true},
		}

		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				got, err := ParseBool(tt.input)
				if (err != nil) != tt.wantErr {
					t.Errorf("ParseBool() error = %v, wantErr %v", err, tt.wantErr)
					return
				}
				if !tt.wantErr && got != tt.want {
					t.Errorf("ParseBool() = %v, want %v", got, tt.want)
				}
			})
		}
	})

	t.Run("ParseInt64", func(t *testing.T) {
		tests := []struct {
			name    string
			input   any
			want    int64
			wantErr bool
		}{
			{"int input", 42, 42, false},
			{"int64 input", int64(42), int64(42), false},
			{"invalid string", "42", 0, true},
			{"nil input", nil, 0, true},
		}

		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				got, err := ParseInt64(tt.input)
				if (err != nil) != tt.wantErr {
					t.Errorf("ParseInt64() error = %v, wantErr %v", err, tt.wantErr)
					return
				}
				if !tt.wantErr && got != tt.want {
					t.Errorf("ParseInt64() = %v, want %v", got, tt.want)
				}
			})
		}
	})

	t.Run("ParseFloat64", func(t *testing.T) {
		tests := []struct {
			name    string
			input   any
			want    float64
			wantErr bool
		}{
			{"float input", 3.14, 3.14, false},
			{"int input", 42, 42.0, true},
			{"string input", "3.14", 0, true},
			{"invalid string", "invalid", 0, true},
			{"nil input", nil, 0, true},
		}
		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				got, err := ParseFloat64(tt.input)
				if (err != nil) != tt.wantErr {
					t.Errorf("ParseFloat64() error = %v, wantErr %v", err, tt.wantErr)
					return
				}
				if !tt.wantErr && got != tt.want {
					t.Errorf("ParseFloat64() = %v, want %v", got, tt.want)
				}
			})
		}
	})

	t.Run("ParseBytesType", func(t *testing.T) {
		tests := []struct {
			name    string
			input   any
			want    any
			wantErr bool
		}{
			{"string input", "test", "test", true},
			{"[]byte input", []byte("test"), "test", false},
			{"int input", 42, nil, true},
			{"nil input", nil, nil, true},
		}

		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				got, err := ParseBytes(tt.input)
				if (err != nil) != tt.wantErr {
					t.Errorf("ParseBytesType() error = %v, wantErr %v", err, tt.wantErr)
					return
				}
				if !tt.wantErr && !reflect.DeepEqual(got, tt.want) {
					t.Errorf("ParseBytesType() = %v, want %v", got, tt.want)
				}
			})
		}
	})
}

func TestDateTimeParsing(t *testing.T) {
	unixTime := int64(1609459200) // 2021-01-01 00:00:00 UTC
	expectedTime := time.Unix(unixTime, 0)

	t.Run("ParseDateTimeFromInt64", func(t *testing.T) {
		result, err := ParseDateTimeFromInt64(unixTime)
		if err != nil {
			t.Errorf("ParseDateTimeFromInt64() error = %v", err)
			return
		}
		if !result.Equal(expectedTime) {
			t.Errorf("ParseDateTimeFromInt64() = %v, want %v", result, expectedTime)
		}
	})

	t.Run("ParseDateTimeFromFloat64", func(t *testing.T) {
		result, err := ParseDateTimeFromFloat64(float64(unixTime))
		if err != nil {
			t.Errorf("ParseDateTimeFromFloat64() error = %v", err)
			return
		}
		if !result.Equal(expectedTime) {
			t.Errorf("ParseDateTimeFromFloat64() = %v, want %v", result, expectedTime)
		}
	})

	t.Run("ParseDateTimeFromString", func(t *testing.T) {
		formats := []string{
			"2021-01-01 00:00:00",
			"2021-01-01T00:00:00Z",
			"2021-01-01",
		}

		for _, format := range formats {
			t.Run(format, func(t *testing.T) {
				result, err := ParseDateTimeFromString(format)
				if err != nil {
					t.Errorf("ParseDateTimeFromString(%s) error = %v", format, err)
					return
				}
				if reflect.TypeOf(result) != reflect.TypeOf(time.Time{}) {
					t.Errorf("ParseDateTimeFromString(%s) did not return a time.Time", format)
				}
			})
		}

		t.Run("invalid format", func(t *testing.T) {
			_, err := ParseDateTimeFromString("invalid")
			if err == nil {
				t.Error("ParseDateTimeFromString(invalid) expected error, got nil")
			}
		})
	})
}
