package schema

import (
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestConvertStreams(t *testing.T) {
	// Define test cases
	testCases := []struct {
		name           string
		input          map[string]StreamSchemaConfig
		expectedOutput map[string]Stream
	}{
		{
			name: "Basic stream conversion",
			input: map[string]StreamSchemaConfig{
				"users": {
					Fields: []StreamDataField{
						{FieldName: "id", FieldType: "int"},
						{FieldName: "name", FieldType: "string"},
						{FieldName: "active", FieldType: "bool"},
					},
					JoinKeyField: "id",
				},
			},
			expectedOutput: map[string]Stream{
				"users": {
					Fields: map[string]DataType{
						"id":     TypeInt,
						"name":   TypeString,
						"active": TypeBool,
					},
					JoinKey: "id",
				},
			},
		},
		{
			name: "Multiple streams with different types",
			input: map[string]StreamSchemaConfig{
				"users": {
					Fields: []StreamDataField{
						{FieldName: "id", FieldType: "int"},
						{FieldName: "name", FieldType: "string"},
					},
					JoinKeyField: "id",
				},
				"events": {
					Fields: []StreamDataField{
						{FieldName: "event_id", FieldType: "string"},
						{FieldName: "user_id", FieldType: "int"},
						{FieldName: "timestamp", FieldType: "datetime"},
						{FieldName: "data", FieldType: "bytes"},
					},
					JoinKeyField: "user_id",
				},
			},
			expectedOutput: map[string]Stream{
				"users": {
					Fields: map[string]DataType{
						"id":   TypeInt,
						"name": TypeString,
					},
					JoinKey: "id",
				},
				"events": {
					Fields: map[string]DataType{
						"event_id":  TypeString,
						"user_id":   TypeInt,
						"timestamp": TypeDateTime,
						"data":      TypeBytes,
					},
					JoinKey: "user_id",
				},
			},
		},
		{
			name:           "Empty input",
			input:          map[string]StreamSchemaConfig{},
			expectedOutput: map[string]Stream{},
		},
	}

	// Run test cases
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result := convirtStreams(tc.input)

			// Compare the results
			if len(result) != len(tc.expectedOutput) {
				t.Fatalf("Expected %d streams, got %d", len(tc.expectedOutput), len(result))
			}

			for streamName, expectedStream := range tc.expectedOutput {
				actualStream, exists := result[streamName]
				if !exists {
					t.Errorf("Stream %s is missing in the result", streamName)
					continue
				}

				// Compare JoinKey
				if actualStream.JoinKey != expectedStream.JoinKey {
					t.Errorf("Stream %s: expected JoinKey %s, got %s",
						streamName, expectedStream.JoinKey, actualStream.JoinKey)
				}

				// Compare Fields
				if len(actualStream.Fields) != len(expectedStream.Fields) {
					t.Errorf("Stream %s: expected %d fields, got %d",
						streamName, len(expectedStream.Fields), len(actualStream.Fields))
					continue
				}

				for fieldName, expectedType := range expectedStream.Fields {
					actualType, exists := actualStream.Fields[fieldName]
					if !exists {
						t.Errorf("Stream %s: field %s is missing", streamName, fieldName)
						continue
					}
					if actualType != expectedType {
						t.Errorf("Stream %s, field %s: expected type %s, got %s",
							streamName, fieldName, expectedType, actualType)
					}
				}
			}
		})
	}
}

func TestNewMapper(t *testing.T) {
	// Test cases for NewMapper function
	testCases := []struct {
		name           string
		streamsConfig  map[string]StreamSchemaConfig
		columnsConfig  []SinkMappingConfig
		expectError    bool
		errorSubstring string
	}{
		{
			name: "Valid configuration",
			streamsConfig: map[string]StreamSchemaConfig{
				"users": {
					Fields: []StreamDataField{
						{FieldName: "id", FieldType: "int"},
						{FieldName: "name", FieldType: "string"},
					},
					JoinKeyField: "id",
				},
			},
			columnsConfig: []SinkMappingConfig{
				{ColumnName: "user_id", StreamName: "users", FieldName: "id", ColumnType: "Int64"},
				{ColumnName: "user_name", StreamName: "users", FieldName: "name", ColumnType: "String"},
			},
			expectError: false,
		},
		{
			name: "Invalid join key",
			streamsConfig: map[string]StreamSchemaConfig{
				"users": {
					Fields: []StreamDataField{
						{FieldName: "id", FieldType: "int"},
					},
					JoinKeyField: "nonexistent",
				},
			},
			columnsConfig: []SinkMappingConfig{
				{ColumnName: "user_id", StreamName: "users", FieldName: "id", ColumnType: "Int64"},
			},
			expectError:    true,
			errorSubstring: "join key 'nonexistent' not found in stream 'users'",
		},
		{
			name: "Non-existent stream in mapping",
			streamsConfig: map[string]StreamSchemaConfig{
				"users": {
					Fields: []StreamDataField{
						{FieldName: "id", FieldType: "int"},
					},
					JoinKeyField: "id",
				},
			},
			columnsConfig: []SinkMappingConfig{
				{ColumnName: "event_id", StreamName: "events", FieldName: "id", ColumnType: "String"},
			},
			expectError:    true,
			errorSubstring: "stream 'events' not found in configuration",
		},
		{
			name: "Non-existent field in mapping",
			streamsConfig: map[string]StreamSchemaConfig{
				"users": {
					Fields: []StreamDataField{
						{FieldName: "id", FieldType: "int"},
					},
					JoinKeyField: "id",
				},
			},
			columnsConfig: []SinkMappingConfig{
				{ColumnName: "user_name", StreamName: "users", FieldName: "name", ColumnType: "String"},
			},
			expectError:    true,
			errorSubstring: "field 'name' not found in stream 'users'",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			mapper, err := NewMapper(tc.streamsConfig, tc.columnsConfig)

			// Check error expectations
			if tc.expectError {
				if err == nil {
					t.Fatalf("Expected error containing '%s', but got no error", tc.errorSubstring)
				}
				if tc.errorSubstring != "" && !contains(err.Error(), tc.errorSubstring) {
					t.Fatalf("Expected error containing '%s', but got '%v'", tc.errorSubstring, err)
				}
			} else {
				if err != nil {
					t.Fatalf("Expected no error, but got: %v", err)
				}
				if mapper == nil {
					t.Fatal("Mapper is nil despite no error")
				}

				// Verify mapper was correctly initialized
				if len(mapper.Streams) != len(tc.streamsConfig) {
					t.Errorf("Expected %d streams, got %d", len(tc.streamsConfig), len(mapper.Streams))
				}
				if len(mapper.Columns) != len(tc.columnsConfig) {
					t.Errorf("Expected %d columns, got %d", len(tc.columnsConfig), len(mapper.Columns))
				}
				if len(mapper.orderedColumns) != len(tc.columnsConfig) {
					t.Errorf("Expected %d ordered columns, got %d", len(tc.columnsConfig), len(mapper.orderedColumns))
				}
				if mapper.typeConverters == nil {
					t.Error("Type converters map was not initialized")
				}
			}
		})
	}
}

func TestGetJoinKey(t *testing.T) {
	// Setup
	streamsConfig := map[string]StreamSchemaConfig{
		"users": {
			Fields: []StreamDataField{
				{FieldName: "id", FieldType: "int"},
				{FieldName: "name", FieldType: "string"},
			},
			JoinKeyField: "id",
		},
		"events": {
			Fields: []StreamDataField{
				{FieldName: "event_id", FieldType: "string"},
				{FieldName: "user_id", FieldType: "int"},
			},
			JoinKeyField: "user_id",
		},
		"no_join": {
			Fields: []StreamDataField{
				{FieldName: "data", FieldType: "string"},
			},
			JoinKeyField: "",
		},
	}

	sinkMappingConfig := []SinkMappingConfig{
		{ColumnName: "user_id", StreamName: "users", FieldName: "id", ColumnType: "Int64"},
		{ColumnName: "event_id", StreamName: "events", FieldName: "event_id", ColumnType: "String"},
		{ColumnName: "user_id_from_event", StreamName: "events", FieldName: "user_id", ColumnType: "Int64"},
		{ColumnName: "data", StreamName: "no_join", FieldName: "data", ColumnType: "String"},
	}

	mapper, err := NewMapper(streamsConfig, sinkMappingConfig)
	if err != nil {
		t.Fatalf("Failed to create mapper: %v", err)
	}

	// Test cases
	testCases := []struct {
		name           string
		streamName     string
		jsonData       string
		expectedKey    any
		expectError    bool
		errorSubstring string
	}{
		{
			name:        "Get integer join key",
			streamName:  "users",
			jsonData:    `{"id": 123, "name": "Alice"}`,
			expectedKey: int64(123),
		},
		{
			name:           "Missing join key",
			streamName:     "users",
			jsonData:       `{"name": "Bob"}`,
			expectError:    true,
			errorSubstring: "key id not found",
		},
		{
			name:        "Join key from different stream",
			streamName:  "events",
			jsonData:    `{"event_id": "evt-123", "user_id": 456}`,
			expectedKey: int64(456),
		},
		{
			name:           "Invalid JSON",
			streamName:     "users",
			jsonData:       `{invalid json`,
			expectError:    true,
			errorSubstring: "failed to read JSON key",
		},
		{
			name:           "Non-existent stream",
			streamName:     "products",
			jsonData:       `{"id": 789}`,
			expectError:    true,
			errorSubstring: "no join key defined in schema",
		},
		{
			name:           "Stream with no join key",
			streamName:     "no_join",
			jsonData:       `{"data": "test"}`,
			expectError:    true,
			errorSubstring: "no join key defined in schema",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			key, err := mapper.GetJoinKey(tc.streamName, []byte(tc.jsonData))

			if tc.expectError {
				if err == nil {
					t.Fatalf("Expected error containing '%s', but got no error", tc.errorSubstring)
				}
				if tc.errorSubstring != "" && !contains(err.Error(), tc.errorSubstring) {
					t.Fatalf("Expected error containing '%s', but got '%v'", tc.errorSubstring, err)
				}
			} else {
				if err != nil {
					t.Fatalf("Expected no error, but got: %v", err)
				}
				if !reflect.DeepEqual(key, tc.expectedKey) {
					t.Errorf("Expected key %v (%T), got %v (%T)", tc.expectedKey, tc.expectedKey, key, key)
				}
			}
		})
	}
}

func TestPrepareClickHouseValues(t *testing.T) {
	// Setup
	streamsConfig := map[string]StreamSchemaConfig{
		"users": {
			Fields: []StreamDataField{
				{FieldName: "id", FieldType: "int"},
				{FieldName: "name", FieldType: "string"},
				{FieldName: "active", FieldType: "bool"},
				{FieldName: "created_at", FieldType: "datetime"},
			},
			JoinKeyField: "id",
		},
		"orders": {
			Fields: []StreamDataField{
				{FieldName: "order_id", FieldType: "string"},
				{FieldName: "user_id", FieldType: "int"},
				{FieldName: "amount", FieldType: "float"},
			},
			JoinKeyField: "user_id",
		},
	}

	sinkMappingConfig := []SinkMappingConfig{
		{ColumnName: "id", StreamName: "users", FieldName: "id", ColumnType: "Int64"},
		{ColumnName: "name", StreamName: "users", FieldName: "name", ColumnType: "String"},
		{ColumnName: "is_active", StreamName: "users", FieldName: "active", ColumnType: "Bool"},
		{ColumnName: "registration_date", StreamName: "users", FieldName: "created_at", ColumnType: "DateTime"},
		{ColumnName: "order_id", StreamName: "orders", FieldName: "order_id", ColumnType: "String"},
		{ColumnName: "order_amount", StreamName: "orders", FieldName: "amount", ColumnType: "Float64"},
	}

	mapper, err := NewMapper(streamsConfig, sinkMappingConfig)
	if err != nil {
		t.Fatalf("Failed to create mapper: %v", err)
	}

	// Get reference date for comparison
	refDate, _ := time.Parse(time.RFC3339, "2023-10-15T12:30:45Z")

	// Test cases
	testCases := []struct {
		name           string
		jsonData       string
		expectedValues []any
		expectError    bool
		errorSubstring string
	}{
		{
			name: "Single stream data",
			jsonData: `{
				"users.id": 123,
				"users.name": "Alice",
				"users.active": true,
				"users.created_at": "2023-10-15T12:30:45Z"
			}`,
			expectedValues: []any{
				int64(123),
				"Alice",
				true,
				refDate,
				nil, // order_id is nil
				nil, // order_amount is nil
			},
		},
		{
			name: "Multiple streams data",
			jsonData: `{
				"users.id": 123,
				"users.name": "Alice",
				"users.active": true,
				"users.created_at": "2023-10-15T12:30:45Z",
				"orders.order_id": "ORDER-123",
				"orders.user_id": 123,
				"orders.amount": 99.95
			}`,
			expectedValues: []any{
				int64(123),
				"Alice",
				true,
				refDate,
				"ORDER-123",
				float64(99.95),
			},
		},
		{
			name: "Missing fields",
			jsonData: `{
				"users.id": 123,
				"orders.order_id": "ORDER-123"
			}`,
			expectedValues: []any{
				int64(123),
				nil, // name is nil
				nil, // is_active is nil
				nil, // registration_date is nil
				"ORDER-123",
				nil, // order_amount is nil
			},
		},
		{
			name:           "Invalid JSON",
			jsonData:       `{invalid json`,
			expectError:    true,
			errorSubstring: "failed to parse JSON data",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			values, err := mapper.PrepareClickHouseValues([]byte(tc.jsonData))

			if tc.expectError {
				if err == nil {
					t.Fatalf("Expected error containing '%s', but got no error", tc.errorSubstring)
				}
				if tc.errorSubstring != "" && !contains(err.Error(), tc.errorSubstring) {
					t.Fatalf("Expected error containing '%s', but got '%v'", tc.errorSubstring, err)
				}
				return
			}

			if err != nil {
				t.Fatalf("Expected no error, but got: %v", err)
			}

			if len(values) != len(tc.expectedValues) {
				t.Fatalf("Expected %d values, got %d", len(tc.expectedValues), len(values))
			}

			for i, expected := range tc.expectedValues {
				// For nil values, just check if both are nil
				if expected == nil {
					if values[i] != nil {
						t.Errorf("Values[%d]: expected nil, got %v (%T)", i, values[i], values[i])
					}
					continue
				}

				// For time.Time values, compare with IsZero()
				if _, ok := expected.(time.Time); ok {
					actualTime, ok := values[i].(time.Time)
					if !ok {
						t.Errorf("Values[%d]: expected time.Time, got %T", i, values[i])
						continue
					}
					expectedTime := expected.(time.Time)
					if !expectedTime.Equal(actualTime) {
						t.Errorf("Values[%d]: expected time %v, got %v", i, expectedTime, actualTime)
					}
					continue
				}

				// For other values, use DeepEqual
				if !reflect.DeepEqual(values[i], expected) {
					t.Errorf("Values[%d]: expected %v (%T), got %v (%T)",
						i, expected, expected, values[i], values[i])
				}
			}
		})
	}
}

func TestGetFieldsMap(t *testing.T) {
	// Setup
	streamsConfig := map[string]StreamSchemaConfig{
		"users": {
			Fields: []StreamDataField{
				{FieldName: "id", FieldType: "int"},
				{FieldName: "name", FieldType: "string"},
				{FieldName: "age", FieldType: "int"},
			},
			JoinKeyField: "id",
		},
	}

	sinkMappingConfig := []SinkMappingConfig{
		{ColumnName: "id", StreamName: "users", FieldName: "id", ColumnType: "Int64"},
		{ColumnName: "name", StreamName: "users", FieldName: "name", ColumnType: "String"},
	}

	mapper, err := NewMapper(streamsConfig, sinkMappingConfig)
	if err != nil {
		t.Fatalf("Failed to create mapper: %v", err)
	}

	// Test cases
	testCases := []struct {
		name           string
		streamName     string
		jsonData       string
		expectedFields map[string]any
		expectError    bool
		errorSubstring string
	}{
		{
			name:       "Valid fields",
			streamName: "users",
			jsonData:   `{"id": 123, "name": "Alice", "age": 30, "extra": "should be ignored"}`,
			expectedFields: map[string]any{
				"id":   float64(123), // JSON parses numbers as float64
				"name": "Alice",
				"age":  float64(30),
			},
		},
		{
			name:           "Invalid JSON",
			streamName:     "users",
			jsonData:       `{invalid json`,
			expectError:    true,
			errorSubstring: "failed to parse JSON data",
		},
		{
			name:           "Non-existent stream",
			streamName:     "products",
			jsonData:       `{"id": 123}`,
			expectedFields: map[string]any{},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			fields, err := mapper.GetFieldsMap(tc.streamName, []byte(tc.jsonData))

			if tc.expectError {
				if err == nil {
					t.Fatalf("Expected error containing '%s', but got no error", tc.errorSubstring)
				}
				if tc.errorSubstring != "" && !contains(err.Error(), tc.errorSubstring) {
					t.Fatalf("Expected error containing '%s', but got '%v'", tc.errorSubstring, err)
				}
				return
			}

			if err != nil {
				t.Fatalf("Expected no error, but got: %v", err)
			}

			if len(fields) != len(tc.expectedFields) {
				t.Fatalf("Expected %d fields, got %d", len(tc.expectedFields), len(fields))
			}

			for key, expectedValue := range tc.expectedFields {
				actualValue, exists := fields[key]
				if !exists {
					t.Errorf("Expected field '%s' not found in result", key)
					continue
				}
				if !reflect.DeepEqual(actualValue, expectedValue) {
					t.Errorf("Field '%s': expected %v (%T), got %v (%T)",
						key, expectedValue, expectedValue, actualValue, actualValue)
				}
			}

			// Check that extra fields were excluded
			if tc.streamName == "users" {
				if _, exists := fields["extra"]; exists {
					t.Error("Field 'extra' should have been excluded")
				}
			}
		})
	}
}

func TestTypeConverters(t *testing.T) {
	// Setup a basic mapper to access typeConverters
	streamsConfig := map[string]StreamSchemaConfig{
		"test": {
			Fields: []StreamDataField{
				{FieldName: "string_field", FieldType: "string"},
				{FieldName: "int_field", FieldType: "int"},
				{FieldName: "float_field", FieldType: "float"},
				{FieldName: "bool_field", FieldType: "bool"},
				{FieldName: "bytes_field", FieldType: "bytes"},
				{FieldName: "uuid_field", FieldType: "uuid"},
				{FieldName: "array_field", FieldType: "array"},
				{FieldName: "datetime_field", FieldType: "datetime"},
			},
			JoinKeyField: "int_field",
		},
	}

	sinkMappingConfig := []SinkMappingConfig{
		{ColumnName: "col1", StreamName: "test", FieldName: "string_field", ColumnType: "String"},
	}

	mapper, err := NewMapper(streamsConfig, sinkMappingConfig)
	if err != nil {
		t.Fatalf("Failed to create mapper: %v", err)
	}

	// Get reference values for comparison
	testUUID := uuid.MustParse("550e8400-e29b-41d4-a716-446655440000")
	refDate, _ := time.Parse(time.RFC3339, "2023-10-15T12:30:45Z")

	// Test cases for each converter
	t.Run("String converter", func(t *testing.T) {
		converter := mapper.typeConverters[TypeString]

		// Test different input types
		testCases := []struct {
			input    any
			expected string
		}{
			{input: "hello", expected: "hello"},
			{input: 123, expected: "123"},
			{input: true, expected: "true"},
			{input: []byte("hello"), expected: "hello"},
		}

		for _, tc := range testCases {
			result, err := converter(tc.input)
			if err != nil {
				t.Errorf("Unexpected error converting %v to string: %v", tc.input, err)
				continue
			}
			if result != tc.expected {
				t.Errorf("Expected %q, got %q for input %v", tc.expected, result, tc.input)
			}
		}
	})

	t.Run("Int converter", func(t *testing.T) {
		converter := mapper.typeConverters[TypeInt]

		// Test different input types
		testCases := []struct {
			input       any
			expected    int64
			expectError bool
		}{
			{input: 123, expected: 123},
			{input: int64(123), expected: 123},
			{input: 123.45, expected: 123},
			{input: "123", expected: 123},
			{input: []byte("123"), expected: 123},
			{input: "invalid", expectError: true},
			{input: true, expectError: true},
		}

		for _, tc := range testCases {
			result, err := converter(tc.input)
			if tc.expectError {
				if err == nil {
					t.Errorf("Expected error converting %v to int but got none", tc.input)
				}
				continue
			}
			if err != nil {
				t.Errorf("Unexpected error converting %v to int: %v", tc.input, err)
				continue
			}
			if result != tc.expected {
				t.Errorf("Expected %d, got %v for input %v", tc.expected, result, tc.input)
			}
		}
	})

	t.Run("Float converter", func(t *testing.T) {
		converter := mapper.typeConverters[TypeFloat]

		// Test different input types
		testCases := []struct {
			input       any
			expected    float64
			expectError bool
		}{
			{input: 123.45, expected: 123.45},
			{input: 123, expected: 123.0},
			{input: int64(123), expected: 123.0},
			{input: "123.45", expected: 123.45},
			{input: []byte("123.45"), expected: 123.45},
			{input: "invalid", expectError: true},
			{input: true, expectError: true},
		}

		for _, tc := range testCases {
			result, err := converter(tc.input)
			if tc.expectError {
				if err == nil {
					t.Errorf("Expected error converting %v to float but got none", tc.input)
				}
				continue
			}
			if err != nil {
				t.Errorf("Unexpected error converting %v to float: %v", tc.input, err)
				continue
			}
			if result != tc.expected {
				t.Errorf("Expected %f, got %v for input %v", tc.expected, result, tc.input)
			}
		}
	})

	t.Run("Bool converter", func(t *testing.T) {
		converter := mapper.typeConverters[TypeBool]

		// Test different input types
		testCases := []struct {
			input       any
			expected    bool
			expectError bool
		}{
			{input: true, expected: true},
			{input: false, expected: false},
			{input: 1, expected: true},
			{input: 0, expected: false},
			{input: 5.1, expected: true},
			{input: "true", expected: true},
			{input: "false", expected: false},
			{input: []byte("true"), expected: true},
			{input: []byte("false"), expected: false},
			{input: "invalid", expectError: true},
		}

		for _, tc := range testCases {
			result, err := converter(tc.input)
			if tc.expectError {
				if err == nil {
					t.Errorf("Expected error converting %v to bool but got none", tc.input)
				}
				continue
			}
			if err != nil {
				t.Errorf("Unexpected error converting %v to bool: %v", tc.input, err)
				continue
			}
			if result != tc.expected {
				t.Errorf("Expected %v, got %v for input %v", tc.expected, result, tc.input)
			}
		}
	})

	t.Run("UUID converter", func(t *testing.T) {
		converter := mapper.typeConverters[TypeUUID]

		// Test different input types
		testCases := []struct {
			input       any
			expected    uuid.UUID
			expectError bool
		}{
			{input: "550e8400-e29b-41d4-a716-446655440000", expected: testUUID},
			{input: testUUID.String(), expected: testUUID},
			{input: "invalid-uuid", expectError: true},
		}

		for _, tc := range testCases {
			result, err := converter(tc.input)
			if tc.expectError {
				if err == nil {
					t.Errorf("Expected error converting %v to UUID but got none", tc.input)
				}
				continue
			}
			if err != nil {
				t.Errorf("Unexpected error converting %v to UUID: %v", tc.input, err)
				continue
			}
			if result.(uuid.UUID) != tc.expected {
				t.Errorf("Expected %v, got %v for input %v", tc.expected, result, tc.input)
			}
		}
	})

	t.Run("DateTime converter", func(t *testing.T) {
		converter := mapper.typeConverters[TypeDateTime]

		// Test different input types
		testCases := []struct {
			input       any
			expected    time.Time
			expectError bool
		}{
			{input: refDate, expected: refDate},
			{input: "2023-10-15T12:30:45Z", expected: refDate},
			{input: "2023-10-15 12:30:45", expected: refDate.In(time.UTC)},
			{input: int64(refDate.Unix()), expected: time.Unix(refDate.Unix(), 0)},
			{input: float64(refDate.Unix()), expected: time.Unix(refDate.Unix(), 0)},
			{input: "invalid-date", expectError: true},
		}

		for _, tc := range testCases {
			result, err := converter(tc.input)
			if tc.expectError {
				if err == nil {
					t.Errorf("Expected error converting %v to DateTime but got none", tc.input)
				}
				continue
			}
			if err != nil {
				t.Errorf("Unexpected error converting %v to DateTime: %v", tc.input, err)
				continue
			}

			resultTime := result.(time.Time)
			if !resultTime.Equal(tc.expected) {
				t.Errorf("Expected %v, got %v for input %v", tc.expected, resultTime, tc.input)
			}
		}
	})
}

// Helper function to check if a string contains a substring
func contains(s, substr string) bool {
	return strings.Contains(s, substr)
}
