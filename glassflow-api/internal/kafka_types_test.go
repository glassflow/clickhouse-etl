package internal

import "testing"

func TestNormalizeToBasicKafkaType(t *testing.T) {
	tests := []struct {
		name     string
		typeStr  string
		expected string
	}{
		{"int8 to int", "int8", KafkaTypeInt},
		{"int16 to int", "int16", KafkaTypeInt},
		{"int32 to int", "int32", KafkaTypeInt},
		{"int64 to int", "int64", KafkaTypeInt},
		{"uint8 to uint", "uint8", KafkaTypeUint},
		{"uint16 to uint", "uint16", KafkaTypeUint},
		{"uint32 to uint", "uint32", KafkaTypeUint},
		{"uint64 to uint", "uint64", KafkaTypeUint},
		{"float32 to float", "float32", KafkaTypeFloat},
		{"float64 to float", "float64", KafkaTypeFloat},
		{"bytes to string", "bytes", KafkaTypeString},
		{"string as-is", KafkaTypeString, KafkaTypeString},
		{"bool as-is", KafkaTypeBool, KafkaTypeBool},
		{"int as-is", KafkaTypeInt, KafkaTypeInt},
		{"uint as-is", KafkaTypeUint, KafkaTypeUint},
		{"float as-is", KafkaTypeFloat, KafkaTypeFloat},
		{"array as-is", KafkaTypeArray, KafkaTypeArray},
		{"map as-is", KafkaTypeMap, KafkaTypeMap},
		{"unknown unchanged", "custom_type", "custom_type"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := NormalizeToBasicKafkaType(tt.typeStr)
			if got != tt.expected {
				t.Errorf("NormalizeToBasicKafkaType(%q) = %q, want %q", tt.typeStr, got, tt.expected)
			}
		})
	}
}
