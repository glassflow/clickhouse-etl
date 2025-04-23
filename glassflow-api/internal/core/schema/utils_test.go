package schema

import (
	"math"
	"testing"
)

func TestParseUint8(t *testing.T) {
	tests := []struct {
		name        string
		input       any
		expected    uint8
		expectError bool
	}{
		{
			name:        "Valid uint8",
			input:       uint8(42),
			expected:    42,
			expectError: false,
		},
		{
			name:        "Zero value",
			input:       uint8(0),
			expected:    0,
			expectError: false,
		},
		{
			name:        "Max uint8",
			input:       uint8(math.MaxUint8),
			expected:    math.MaxUint8,
			expectError: false,
		},
		{
			name:        "Valid uint within range",
			input:       uint(42),
			expected:    42,
			expectError: false,
		},
		{
			name:        "Uint too large",
			input:       uint(math.MaxUint8 + 1),
			expectError: true,
		},
		{
			name:        "Negative int",
			input:       -1,
			expectError: true,
		},
		{
			name:        "String value",
			input:       "42",
			expected:    42,
			expectError: false,
		},
		{
			name:        "Nil value",
			input:       nil,
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := ParseUint8(tt.input)
			if tt.expectError && err == nil {
				t.Errorf("Expected error but got none for input %v", tt.input)
			}
			if !tt.expectError && err != nil {
				t.Errorf("Unexpected error: %v", err)
			}
			if !tt.expectError && result != tt.expected {
				t.Errorf("Expected %v, got %v", tt.expected, result)
			}
		})
	}
}

func TestParseFloat32(t *testing.T) {
	tests := []struct {
		name        string
		input       any
		expected    float32
		expectError bool
	}{
		{
			name:        "Valid float32",
			input:       float32(3.14),
			expected:    3.14,
			expectError: false,
		},
		{
			name:        "Zero value",
			input:       float32(0),
			expected:    0,
			expectError: false,
		},
		{
			name:        "Negative value",
			input:       float32(-3.14),
			expected:    -3.14,
			expectError: false,
		},
		{
			name:        "Max float32",
			input:       float32(math.MaxFloat32),
			expected:    math.MaxFloat32,
			expectError: false,
		},
		{
			name:        "SmallestNonzero float32",
			input:       float32(math.SmallestNonzeroFloat32),
			expected:    math.SmallestNonzeroFloat32,
			expectError: false,
		},
		{
			name:        "Float64 value",
			input:       float64(3.14),
			expectError: true,
		},
		{
			name:        "Integer value",
			input:       42,
			expectError: true,
		},
		{
			name:        "String value",
			input:       "3.14",
			expectError: true,
		},
		{
			name:        "Nil value",
			input:       nil,
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := ParseFloat32(tt.input)
			if tt.expectError && err == nil {
				t.Errorf("Expected error but got none")
			}
			if !tt.expectError && err != nil {
				t.Errorf("Unexpected error: %v", err)
			}
			if !tt.expectError && result != tt.expected {
				t.Errorf("Expected %v, got %v", tt.expected, result)
			}
		})
	}
}

func TestParseFloat64(t *testing.T) {
	tests := []struct {
		name        string
		input       any
		expected    float64
		expectError bool
	}{
		{
			name:        "Valid float64",
			input:       float64(3.14159),
			expected:    3.14159,
			expectError: false,
		},
		{
			name:        "Valid []byte",
			input:       []byte("3.14159"),
			expected:    3.14159,
			expectError: false,
		},
		{
			name:        "Zero value",
			input:       float64(0),
			expected:    0,
			expectError: false,
		},
		{
			name:        "Negative value",
			input:       float64(-3.14159),
			expected:    -3.14159,
			expectError: false,
		},
		{
			name:        "Invalid []byte",
			input:       []byte("not-a-float"),
			expectError: true,
		},
		{
			name:        "Integer value",
			input:       42,
			expectError: true,
		},
		{
			name:        "String value",
			input:       "3.14159",
			expectError: true,
		},
		{
			name:        "Nil value",
			input:       nil,
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := ParseFloat64(tt.input)
			if tt.expectError && err == nil {
				t.Errorf("Expected error but got none")
			}
			if !tt.expectError && err != nil {
				t.Errorf("Unexpected error: %v", err)
			}
			if !tt.expectError && result != tt.expected {
				t.Errorf("Expected %v, got %v", tt.expected, result)
			}
		})
	}
}

func TestParseBytes(t *testing.T) {
	tests := []struct {
		name        string
		input       any
		expected    string
		expectError bool
	}{
		{
			name:        "Valid bytes",
			input:       []byte("hello world"),
			expected:    "hello world",
			expectError: false,
		},
		{
			name:        "Empty bytes",
			input:       []byte{},
			expected:    "",
			expectError: false,
		},
		{
			name:        "String value",
			input:       "hello world",
			expectError: true,
		},
		{
			name:        "Integer value",
			input:       42,
			expectError: true,
		},
		{
			name:        "Nil value",
			input:       nil,
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := ParseBytes(tt.input)
			if tt.expectError && err == nil {
				t.Errorf("Expected error but got none")
			}
			if !tt.expectError && err != nil {
				t.Errorf("Unexpected error: %v", err)
			}
			if !tt.expectError && result != tt.expected {
				t.Errorf("Expected %q, got %q", tt.expected, result)
			}
		})
	}
}

func TestParseString(t *testing.T) {
	tests := []struct {
		name        string
		input       any
		expected    string
		expectError bool
	}{
		{
			name:        "Valid string",
			input:       "hello world",
			expected:    "hello world",
			expectError: false,
		},
		{
			name:        "Empty string",
			input:       "",
			expected:    "",
			expectError: false,
		},
		{
			name:        "Integer value",
			input:       42,
			expectError: true,
		},
		{
			name:        "Float value",
			input:       3.14,
			expectError: true,
		},
		{
			name:        "Boolean value",
			input:       true,
			expectError: true,
		},
		{
			name:        "Nil value",
			input:       nil,
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := ParseString(tt.input)
			if tt.expectError && err == nil {
				t.Errorf("Expected error but got none")
			}
			if !tt.expectError && err != nil {
				t.Errorf("Unexpected error: %v", err)
			}
			if !tt.expectError && result != tt.expected {
				t.Errorf("Expected %q, got %q", tt.expected, result)
			}
		})
	}
}

func TestParseBool(t *testing.T) {
	tests := []struct {
		name        string
		input       any
		expected    bool
		expectError bool
	}{
		{
			name:        "Valid true",
			input:       true,
			expected:    true,
			expectError: false,
		},
		{
			name:        "Valid false",
			input:       false,
			expected:    false,
			expectError: false,
		},
		{
			name:        "String value",
			input:       "true",
			expectError: true,
		},
		{
			name:        "Integer value",
			input:       1,
			expectError: true,
		},
		{
			name:        "Float value",
			input:       0.0,
			expectError: true,
		},
		{
			name:        "Nil value",
			input:       nil,
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := ParseBool(tt.input)
			if tt.expectError && err == nil {
				t.Errorf("Expected error but got none")
			}
			if !tt.expectError && err != nil {
				t.Errorf("Unexpected error: %v", err)
			}
			if !tt.expectError && result != tt.expected {
				t.Errorf("Expected %v, got %v", tt.expected, result)
			}
		})
	}
}

func TestParseInt8(t *testing.T) {
	tests := []struct {
		name        string
		input       any
		expected    int8
		expectError bool
	}{
		{
			name:        "Valid int8",
			input:       int8(42),
			expected:    42,
			expectError: false,
		},
		{
			name:        "Zero value",
			input:       int8(0),
			expected:    0,
			expectError: false,
		},
		{
			name:        "Min int8",
			input:       int8(math.MinInt8),
			expected:    math.MinInt8,
			expectError: false,
		},
		{
			name:        "Max int8",
			input:       int8(math.MaxInt8),
			expected:    math.MaxInt8,
			expectError: false,
		},
		{
			name:        "Valid int within range",
			input:       42,
			expected:    42,
			expectError: false,
		},
		{
			name:        "Negative int within range",
			input:       -42,
			expected:    -42,
			expectError: false,
		},
		{
			name:        "Int too large",
			input:       int(math.MaxInt8 + 1),
			expectError: true,
		},
		{
			name:        "Int too small",
			input:       int(math.MinInt8 - 1),
			expectError: true,
		},
		{
			name:        "String value",
			input:       "42",
			expectError: true,
		},
		{
			name:        "Float value",
			input:       3.14,
			expected:    3,
			expectError: false,
		},
		{
			name:        "Nil value",
			input:       nil,
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := ParseInt8(tt.input)
			if tt.expectError && err == nil {
				t.Errorf("Expected error but got none for input %v", tt.input)
			}
			if !tt.expectError && err != nil {
				t.Errorf("Unexpected error: %v", err)
			}
			if !tt.expectError && result != tt.expected {
				t.Errorf("Expected %v, got %v", tt.expected, result)
			}
		})
	}
}
