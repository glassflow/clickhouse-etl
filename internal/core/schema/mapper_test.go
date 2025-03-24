package schema

import (
	"encoding/base64"
	"encoding/json"
	"reflect"
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestSchemaMapper_PrepareClickHouseValues(t *testing.T) {
	// Setup test schema config
	config := SchemaConfig{
		Fields: map[string]DataType{
			"id":        TypeInt,
			"name":      TypeString,
			"active":    TypeBool,
			"score":     TypeFloat,
			"timestamp": TypeString,
		},
		PrimaryKey: "id",
		Columns: []ClickHouseColumn{
			{ColumnName: "user_id", FieldName: "id", ColumnType: "Int64"},
			{ColumnName: "user_name", FieldName: "name", ColumnType: "String"},
			{ColumnName: "is_active", FieldName: "active", ColumnType: "Bool"},
			{ColumnName: "user_score", FieldName: "score", ColumnType: "Float64"},
			{ColumnName: "created_at", FieldName: "timestamp", ColumnType: "DateTime"},
		},
	}

	mapper, err := NewSchemaMapper(config)
	if err != nil {
		t.Fatalf("Failed to create schema mapper: %v", err)
	}

	// Test case 1: Valid JSON data
	testJSON := `{
        "id": 123,
        "name": "test user",
        "active": true,
        "score": 85.5,
        "timestamp": "2023-01-15T14:30:45Z"
    }`

	values, err := mapper.PrepareClickHouseValues([]byte(testJSON))
	if err != nil {
		t.Fatalf("PrepareClickHouseValues failed: %v", err)
	}

	// Expected order based on the columns defined in the config
	expectedValues := []any{
		int64(123),             // user_id
		"test user",            // user_name
		true,                   // is_active
		85.5,                   // user_score
		"2023-01-15T14:30:45Z", // created_at
	}

	if len(values) != len(expectedValues) {
		t.Fatalf("Expected %d values, got %d", len(expectedValues), len(values))
	}

	for i, v := range values {
		if !reflect.DeepEqual(v, expectedValues[i]) {
			t.Errorf("Values[%d]: expected %v (%T), got %v (%T)",
				i, expectedValues[i], expectedValues[i], v, v)
		}
	}

	// Test case 2: Missing fields in JSON
	incompleteJSON := `{
        "id": 456,
        "name": "incomplete user"
    }`

	values, err = mapper.PrepareClickHouseValues([]byte(incompleteJSON))
	if err != nil {
		t.Fatalf("PrepareClickHouseValues with incomplete data failed: %v", err)
	}

	// Check we have the right number of items (with some nil values)
	if len(values) != len(mapper.GetOrderedColumns()) {
		t.Errorf("Expected %d values (with nils), got %d",
			len(mapper.GetOrderedColumns()), len(values))
	}

	// Check specific values are correct
	if values[0] != int64(456) {
		t.Errorf("Expected user_id 456, got %v", values[0])
	}
	if values[1] != "incomplete user" {
		t.Errorf("Expected user_name 'incomplete user', got %v", values[1])
	}

	// Test case 3: Invalid JSON
	_, err = mapper.PrepareClickHouseValues([]byte(`{invalid json}`))
	if err == nil {
		t.Error("Expected error for invalid JSON, got nil")
	}
}

func TestSchemaMapper_GetMappedValues(t *testing.T) {
	// Setup test schema config (same as above)
	config := SchemaConfig{
		Fields: map[string]DataType{
			"id":        TypeInt,
			"name":      TypeString,
			"active":    TypeBool,
			"score":     TypeFloat,
			"timestamp": TypeString,
		},
		PrimaryKey: "id",
		Columns: []ClickHouseColumn{
			{ColumnName: "user_id", FieldName: "id", ColumnType: "Int64"},
			{ColumnName: "user_name", FieldName: "name", ColumnType: "String"},
			{ColumnName: "is_active", FieldName: "active", ColumnType: "Bool"},
			{ColumnName: "user_score", FieldName: "score", ColumnType: "Float64"},
			{ColumnName: "created_at", FieldName: "timestamp", ColumnType: "DateTime"},
		},
	}

	mapper, err := NewSchemaMapper(config)
	if err != nil {
		t.Fatalf("Failed to create schema mapper: %v", err)
	}

	// Test case 1: Complete data map
	testData := map[string]any{
		"user_id":    int64(123),
		"user_name":  "test user",
		"is_active":  true,
		"user_score": 85.5,
		"created_at": time.Date(2023, 1, 15, 14, 30, 45, 0, time.UTC),
	}

	values := mapper.GetMappedValues(testData)

	// Expected values in the expected order
	expectedValues := []any{
		int64(123),  // user_id
		"test user", // user_name
		true,        // is_active
		85.5,        // user_score
		time.Date(2023, 1, 15, 14, 30, 45, 0, time.UTC), // created_at
	}

	if len(values) != len(expectedValues) {
		t.Fatalf("Expected %d values, got %d", len(expectedValues), len(values))
	}

	for i, v := range values {
		if !reflect.DeepEqual(v, expectedValues[i]) {
			t.Errorf("Values[%d]: expected %v (%T), got %v (%T)",
				i, expectedValues[i], expectedValues[i], v, v)
		}
	}

	// Test case 2: Incomplete data map
	incompleteData := map[string]any{
		"user_id":   int64(456),
		"user_name": "incomplete user",
	}

	values = mapper.GetMappedValues(incompleteData)

	// Check we have the right number of items (with some nil values)
	if len(values) != len(mapper.GetOrderedColumns()) {
		t.Errorf("Expected %d values (with nils), got %d",
			len(mapper.GetOrderedColumns()), len(values))
	}

	// Check specific values are correct
	if values[0] != int64(456) {
		t.Errorf("Expected user_id 456, got %v", values[0])
	}
	if values[1] != "incomplete user" {
		t.Errorf("Expected user_name 'incomplete user', got %v", values[1])
	}
	// Other values should be nil
	for i := 2; i < len(values); i++ {
		if values[i] != nil {
			t.Errorf("Expected nil value at position %d, got %v", i, values[i])
		}
	}

	// Test case 3: Testing relationship between PrepareForClickHouse and GetMappedValues
	testJSON := `{
        "id": 789,
        "name": "combined test",
        "active": true,
        "score": 92.5,
        "timestamp": "2023-05-10T09:15:30Z"
    }`

	var rawData map[string]any
	if err := json.Unmarshal([]byte(testJSON), &rawData); err != nil {
		t.Fatalf("Failed to unmarshal test JSON: %v", err)
	}

	// Process with PrepareForClickHouse
	mappedData, err := mapper.PrepareForClickHouse([]byte(testJSON))
	if err != nil {
		t.Fatalf("PrepareForClickHouse failed: %v", err)
	}

	// Get values using both methods
	valuesFromPrepare, err := mapper.PrepareClickHouseValues([]byte(testJSON))
	if err != nil {
		t.Fatalf("PrepareClickHouseValues failed: %v", err)
	}

	valuesFromMapped := mapper.GetMappedValues(mappedData)

	// Both should produce identical results
	if !reflect.DeepEqual(valuesFromPrepare, valuesFromMapped) {
		t.Errorf("PrepareClickHouseValues and GetMappedValues produced different results")
		t.Errorf("PrepareClickHouseValues: %v", valuesFromPrepare)
		t.Errorf("GetMappedValues: %v", valuesFromMapped)
	}
}

func TestSchemaMapper_EmptyPrimaryKey(t *testing.T) {
	// Setup test schema config with empty primary key
	config := SchemaConfig{
		Fields: map[string]DataType{
			"id":     TypeInt,
			"name":   TypeString,
			"active": TypeBool,
		},
		PrimaryKey: "", // Empty primary key
		Columns: []ClickHouseColumn{
			{ColumnName: "user_id", FieldName: "id", ColumnType: "Int64"},
			{ColumnName: "user_name", FieldName: "name", ColumnType: "String"},
			{ColumnName: "is_active", FieldName: "active", ColumnType: "Bool"},
		},
	}

	mapper, err := NewSchemaMapper(config)
	if err != nil {
		t.Fatalf("Failed to create schema mapper with empty primary key: %v", err)
	}

	// Test 1: GetPrimaryKey should return an error with empty primary key
	testJSON := `{"id": 123, "name": "test user", "active": true}`
	_, err = mapper.GetPrimaryKey([]byte(testJSON))
	if err == nil {
		t.Error("GetPrimaryKey should return an error when primary key is not defined")
	}
	if err != nil && err.Error() != "no primary key defined in schema" {
		t.Errorf("Expected 'no primary key defined in schema' error, got: %v", err)
	}

	// Test 2: PrepareClickHouseValues should still work without primary key
	values, err := mapper.PrepareClickHouseValues([]byte(testJSON))
	if err != nil {
		t.Fatalf("PrepareClickHouseValues failed with empty primary key: %v", err)
	}

	expectedValues := []any{
		int64(123),  // user_id
		"test user", // user_name
		true,        // is_active
	}

	if len(values) != len(expectedValues) {
		t.Fatalf("Expected %d values, got %d", len(expectedValues), len(values))
	}

	for i, v := range values {
		if !reflect.DeepEqual(v, expectedValues[i]) {
			t.Errorf("Values[%d]: expected %v (%T), got %v (%T)",
				i, expectedValues[i], expectedValues[i], v, v)
		}
	}

	// Test 3: GetMappedValues should work without primary key
	mappedData := map[string]any{
		"user_id":   int64(123),
		"user_name": "test user",
		"is_active": true,
	}

	values = mapper.GetMappedValues(mappedData)

	if len(values) != len(expectedValues) {
		t.Fatalf("Expected %d values, got %d", len(expectedValues), len(values))
	}

	for i, v := range values {
		if !reflect.DeepEqual(v, expectedValues[i]) {
			t.Errorf("Values[%d]: expected %v (%T), got %v (%T)",
				i, expectedValues[i], expectedValues[i], v, v)
		}
	}
}

func TestSchemaMapper_GetSimpleCase(t *testing.T) {
	// Setup test schema config (same as above)
	config := SchemaConfig{
		Fields: map[string]DataType{
			"id":         "string",
			"event_type": "string",
			"timestamp":  "string",
			"data":       "string",
		},
		PrimaryKey: "",
		Columns: []ClickHouseColumn{
			{ColumnName: "id", FieldName: "id", ColumnType: "String"},
			{ColumnName: "event_type", FieldName: "event_type", ColumnType: "String"},
			{ColumnName: "timestamp", FieldName: "timestamp", ColumnType: "DateTime"},
			{ColumnName: "data", FieldName: "data", ColumnType: "String"},
		},
	}

	mapper, err := NewSchemaMapper(config)

	if err != nil {
		t.Fatalf("Failed to create schema mapper with empty primary key: %v", err)
	}

	testJSON := `{"id": "1", "event_type": "r", "timestamp": "2025-03-21 16:24:45", "data": "some"}`
	values, err := mapper.PrepareClickHouseValues([]byte(testJSON))
	if err != nil {
		t.Fatalf("PrepareClickHouseValues failed with empty primary key: %v", err)
	}

	expectedValues := []any{
		"1",                   // id
		"r",                   // event_type
		"2025-03-21 16:24:45", // timestamp
		"some",                // data
	}

	if len(values) != len(expectedValues) {
		t.Fatalf("Expected %d values, got %d", len(expectedValues), len(values))
	}

	for i, v := range values {
		if !reflect.DeepEqual(v, expectedValues[i]) {
			t.Errorf("Values[%d]: expected %v (%T), got %v (%T)",
				i, expectedValues[i], expectedValues[i], v, v)
		}
	}

	mappedData := map[string]any{
		"id":         "1",
		"event_type": "r",
		"timestamp":  "2025-03-21 16:24:45",
		"data":       "some",
	}

	values = mapper.GetMappedValues(mappedData)

	if len(values) != len(expectedValues) {
		t.Fatalf("Expected %d values, got %d", len(expectedValues), len(values))
	}

	for i, v := range values {
		if !reflect.DeepEqual(v, expectedValues[i]) {
			t.Errorf("Values[%d]: expected %v (%T), got %v (%T)",
				i, expectedValues[i], expectedValues[i], v, v)
		}
	}
}

func TestSchemaMapper_AllDataTypes(t *testing.T) {
	// Setup test schema with all supported data types
	config := SchemaConfig{
		Fields: map[string]DataType{
			"str_field":   TypeString,
			"int_field":   TypeInt,
			"float_field": TypeFloat,
			"bool_field":  TypeBool,
			"bytes_field": TypeBytes,
			"uuid_field":  TypeUUID,
			"array_field": TypeArray,
		},
		PrimaryKey: "",
		Columns: []ClickHouseColumn{
			{ColumnName: "str_column", FieldName: "str_field", ColumnType: "String"},
			{ColumnName: "int_column", FieldName: "int_field", ColumnType: "Int64"},
			{ColumnName: "float_column", FieldName: "float_field", ColumnType: "Float64"},
			{ColumnName: "bool_column", FieldName: "bool_field", ColumnType: "Bool"},
			{ColumnName: "bytes_column", FieldName: "bytes_field", ColumnType: "String"},
			{ColumnName: "uuid_column", FieldName: "uuid_field", ColumnType: "UUID"},
			{ColumnName: "array_column", FieldName: "array_field", ColumnType: "Array(String)"},
		},
	}

	mapper, err := NewSchemaMapper(config)
	if err != nil {
		t.Fatalf("Failed to create schema mapper: %v", err)
	}

	// Base64 encoded "hello world"
	base64Str := "aGVsbG8gd29ybGQ="
	decodedBytes, _ := base64.StdEncoding.DecodeString(base64Str)

	// Valid UUID
	testUUID := "6ba7b810-9dad-11d1-80b4-00c04fd430c8"
	parsedUUID, _ := uuid.Parse(testUUID)

	// Test normal JSON with all types
	testJSON := `{
		"str_field": "test string",
		"int_field": 42,
		"float_field": 3.14159,
		"bool_field": true,
		"bytes_field": "aGVsbG8gd29ybGQ=",
		"uuid_field": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
		"array_field": ["one", "two", "three"]
	}`

	values, err := mapper.PrepareClickHouseValues([]byte(testJSON))
	if err != nil {
		t.Fatalf("PrepareClickHouseValues failed: %v", err)
	}

	expectedValues := []any{
		"test string",                // str_column
		int64(42),                    // int_column
		3.14159,                      // float_column
		true,                         // bool_column
		decodedBytes,                 // bytes_column
		parsedUUID,                   // uuid_column
		[]any{"one", "two", "three"}, // array_column
	}

	if len(values) != len(expectedValues) {
		t.Fatalf("Expected %d values, got %d", len(expectedValues), len(values))
	}

	for i, v := range values {
		if i == 4 { // Special handling for bytes comparison
			bytesVal, ok := v.([]byte)
			if !ok {
				t.Errorf("Values[4]: expected []byte, got %T", v)
			} else if string(bytesVal) != string(decodedBytes) {
				t.Errorf("Values[4]: expected %s, got %s", decodedBytes, bytesVal)
			}
			continue
		}

		if !reflect.DeepEqual(v, expectedValues[i]) {
			t.Errorf("Values[%d]: expected %v (%T), got %v (%T)",
				i, expectedValues[i], expectedValues[i], v, v)
		}
	}

	// Test type conversions
	conversionJSON := `{
		"str_field": 123,
		"int_field": "42",
		"float_field": "3.14159",
		"bool_field": "true",
		"bytes_field": "aGVsbG8gd29ybGQ=",
		"uuid_field": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
		"array_field": "[\"json\", \"string\", \"array\"]"
	}`

	values, err = mapper.PrepareClickHouseValues([]byte(conversionJSON))
	if err != nil {
		t.Fatalf("PrepareClickHouseValues failed with conversions: %v", err)
	}

	// Verify type conversions
	if values[0] != "123" {
		t.Errorf("Expected numeric-to-string conversion to \"123\", got %v", values[0])
	}

	if values[1] != int64(42) {
		t.Errorf("Expected string-to-int conversion to 42, got %v", values[1])
	}

	if values[2] != 3.14159 {
		t.Errorf("Expected string-to-float conversion to 3.14159, got %v", values[2])
	}

	if values[3] != true {
		t.Errorf("Expected string-to-bool conversion to true, got %v", values[3])
	}

	// Test array parsed from JSON string
	arrayVal, ok := values[6].([]any)
	if !ok {
		t.Errorf("Expected array type, got %T", values[6])
	} else if len(arrayVal) != 3 || arrayVal[0] != "json" {
		t.Errorf("Expected [\"json\", \"string\", \"array\"], got %v", arrayVal)
	}

	// Test invalid values
	invalidJSON := `{
		"str_field": "valid",
		"int_field": "not_a_number",
		"uuid_field": "invalid-uuid-format"
	}`

	_, err = mapper.PrepareClickHouseValues([]byte(invalidJSON))
	if err == nil {
		t.Error("Expected error for invalid values, got nil")
	}
}

func TestSchemaMapper_InvalidConfigurations(t *testing.T) {
	// Test 1: Invalid primary key
	invalidPKConfig := SchemaConfig{
		Fields: map[string]DataType{
			"id":   TypeInt,
			"name": TypeString,
		},
		PrimaryKey: "non_existent_field", // Field doesn't exist
		Columns: []ClickHouseColumn{
			{ColumnName: "user_id", FieldName: "id", ColumnType: "Int64"},
			{ColumnName: "user_name", FieldName: "name", ColumnType: "String"},
		},
	}

	_, err := NewSchemaMapper(invalidPKConfig)
	if err == nil {
		t.Error("Expected error for non-existent primary key field, got nil")
	}

	// Test 2: Column references non-existent field
	invalidColConfig := SchemaConfig{
		Fields: map[string]DataType{
			"id":   TypeInt,
			"name": TypeString,
		},
		PrimaryKey: "id",
		Columns: []ClickHouseColumn{
			{ColumnName: "user_id", FieldName: "id", ColumnType: "Int64"},
			{ColumnName: "user_name", FieldName: "name", ColumnType: "String"},
			{ColumnName: "created_at", FieldName: "timestamp", ColumnType: "DateTime"}, // Field doesn't exist
		},
	}

	_, err = NewSchemaMapper(invalidColConfig)
	if err == nil {
		t.Error("Expected error for column referencing non-existent field, got nil")
	}

	// Test 3: Empty schema
	emptyConfig := SchemaConfig{
		Fields:     map[string]DataType{},
		PrimaryKey: "",
		Columns:    []ClickHouseColumn{},
	}

	// This should succeed as an empty schema is technically valid
	_, err = NewSchemaMapper(emptyConfig)
	if err != nil {
		t.Errorf("Expected empty schema to be valid, got error: %v", err)
	}
}

func TestSchemaMapper_GetPrimaryKey(t *testing.T) {
	// Setup test schema config with primary key
	config := SchemaConfig{
		Fields: map[string]DataType{
			"id":      TypeUUID,
			"name":    TypeString,
			"counter": TypeInt,
		},
		PrimaryKey: "id", // Using UUID as primary key
		Columns: []ClickHouseColumn{
			{ColumnName: "user_id", FieldName: "id", ColumnType: "UUID"},
			{ColumnName: "user_name", FieldName: "name", ColumnType: "String"},
			{ColumnName: "user_counter", FieldName: "counter", ColumnType: "Int64"},
		},
	}

	mapper, err := NewSchemaMapper(config)
	if err != nil {
		t.Fatalf("Failed to create schema mapper: %v", err)
	}

	// Test 1: Valid UUID primary key
	validUUID := "6ba7b810-9dad-11d1-80b4-00c04fd430c8"
	testJSON := `{"id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8", "name": "test user", "counter": 42}`

	pk, err := mapper.GetPrimaryKey([]byte(testJSON))
	if err != nil {
		t.Fatalf("GetPrimaryKey failed: %v", err)
	}

	// Check UUID was parsed correctly
	parsedUUID, ok := pk.(uuid.UUID)
	if !ok {
		t.Errorf("Expected primary key to be UUID, got %T", pk)
	} else {
		expectedUUID, _ := uuid.Parse(validUUID)
		if parsedUUID != expectedUUID {
			t.Errorf("Expected UUID %v, got %v", expectedUUID, parsedUUID)
		}
	}

	// Test 2: Missing primary key in JSON
	missingPkJSON := `{"name": "test user", "counter": 42}`
	_, err = mapper.GetPrimaryKey([]byte(missingPkJSON))
	if err == nil {
		t.Error("Expected error for missing primary key, got nil")
	}

	// Test 3: Invalid UUID format
	invalidUUIDJSON := `{"id": "not-a-uuid", "name": "test user", "counter": 42}`
	_, err = mapper.GetPrimaryKey([]byte(invalidUUIDJSON))
	if err == nil {
		t.Error("Expected error for invalid UUID format, got nil")
	}

	// Test 4: Invalid JSON
	_, err = mapper.GetPrimaryKey([]byte(`{invalid json}`))
	if err == nil {
		t.Error("Expected error for invalid JSON, got nil")
	}
}

func TestDateTimeConverter(t *testing.T) {
	// Initialize a schema mapper with the datetime converter
	schemaConfig := SchemaConfig{
		Fields: map[string]DataType{
			"timestamp": TypeDateTime,
		},
		Columns: []ClickHouseColumn{
			{ColumnName: "event_time", FieldName: "timestamp", ColumnType: "DateTime64(3)"},
		},
	}

	mapper, err := NewSchemaMapper(schemaConfig)
	if err != nil {
		t.Fatalf("Failed to create schema mapper: %v", err)
	}

	// Get the datetime converter function
	converter := mapper.typeConverters[TypeDateTime]

	testCases := []struct {
		name     string
		input    any
		expected time.Time
		hasError bool
	}{
		{
			name:     "RFC3339",
			input:    "2023-05-15T14:30:45Z",
			expected: time.Date(2023, 5, 15, 14, 30, 45, 0, time.UTC),
			hasError: false,
		},
		{
			name:     "ISO format with T",
			input:    "2023-05-15T14:30:45",
			expected: time.Date(2023, 5, 15, 14, 30, 45, 0, time.UTC),
			hasError: false,
		},
		{
			name:     "Simple date time format",
			input:    "2023-05-15 14:30:45",
			expected: time.Date(2023, 5, 15, 14, 30, 45, 0, time.UTC),
			hasError: false,
		},
		{
			name:     "Date only",
			input:    "2023-05-15",
			expected: time.Date(2023, 5, 15, 0, 0, 0, 0, time.UTC),
			hasError: false,
		},
		{
			name:     "US date format",
			input:    "05/15/2023",
			expected: time.Date(2023, 5, 15, 0, 0, 0, 0, time.UTC),
			hasError: false,
		},
		{
			name:     "European date format",
			input:    "15.05.2023",
			expected: time.Date(2023, 5, 15, 0, 0, 0, 0, time.UTC),
			hasError: false,
		},
		{
			name:     "Unix timestamp as integer",
			input:    int64(1684161045), // 2023-05-15 14:30:45 UTC
			expected: time.Date(2023, 5, 15, 14, 30, 45, 0, time.UTC),
			hasError: false,
		},
		{
			name:     "Unix timestamp as float",
			input:    float64(1684161045.5), // 2023-05-15 14:30:45.5 UTC
			expected: time.Date(2023, 5, 15, 14, 30, 45, 500000000, time.UTC),
			hasError: false,
		},
		{
			name:     "Unix timestamp as string",
			input:    "1684161045",
			expected: time.Date(2023, 5, 15, 14, 30, 45, 0, time.UTC),
			hasError: false,
		},
		{
			name:     "Time object",
			input:    time.Date(2023, 5, 15, 14, 30, 45, 0, time.UTC),
			expected: time.Date(2023, 5, 15, 14, 30, 45, 0, time.UTC),
			hasError: false,
		},
		{
			name:     "Invalid format",
			input:    "not a date",
			expected: time.Time{},
			hasError: true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result, err := converter(tc.input)

			if tc.hasError {
				if err == nil {
					t.Errorf("Expected error for input %v but got none", tc.input)
				}
				return
			}

			if err != nil {
				t.Fatalf("Unexpected error: %v", err)
			}

			// Convert result to time.Time
			timeResult, ok := result.(time.Time)
			if !ok {
				t.Fatalf("Expected time.Time result but got %T", result)
			}

			// Compare times, ignoring time zone
			if !timeResult.Equal(tc.expected) {
				t.Errorf("Expected %v but got %v", tc.expected, timeResult)
			}
		})
	}
}

func TestPrepareForClickHouseWithDateTime(t *testing.T) {
	// Test end-to-end processing with datetime field
	schemaConfig := SchemaConfig{
		Fields: map[string]DataType{
			"id":        TypeInt,
			"name":      TypeString,
			"timestamp": TypeDateTime,
		},
		Columns: []ClickHouseColumn{
			{ColumnName: "user_id", FieldName: "id", ColumnType: "UInt32"},
			{ColumnName: "user_name", FieldName: "name", ColumnType: "String"},
			{ColumnName: "event_time", FieldName: "timestamp", ColumnType: "DateTime64(3)"},
		},
	}

	mapper, err := NewSchemaMapper(schemaConfig)
	if err != nil {
		t.Fatalf("Failed to create schema mapper: %v", err)
	}

	// JSON with different datetime formats
	testCases := []struct {
		name     string
		json     string
		expected map[string]any
	}{
		{
			name: "ISO format",
			json: `{"id": 1, "name": "Alice", "timestamp": "2023-05-15T14:30:45Z"}`,
			expected: map[string]any{
				"user_id":    int64(1),
				"user_name":  "Alice",
				"event_time": time.Date(2023, 5, 15, 14, 30, 45, 0, time.UTC),
			},
		},
		{
			name: "Simple format",
			json: `{"id": 2, "name": "Bob", "timestamp": "2023-05-15 14:30:45"}`,
			expected: map[string]any{
				"user_id":    int64(2),
				"user_name":  "Bob",
				"event_time": time.Date(2023, 5, 15, 14, 30, 45, 0, time.UTC),
			},
		},
		{
			name: "Unix timestamp",
			json: `{"id": 3, "name": "Charlie", "timestamp": 1684161045}`,
			expected: map[string]any{
				"user_id":    int64(3),
				"user_name":  "Charlie",
				"event_time": time.Date(2023, 5, 15, 14, 30, 45, 0, time.UTC),
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result, err := mapper.PrepareForClickHouse([]byte(tc.json))
			if err != nil {
				t.Fatalf("Unexpected error: %v", err)
			}

			// Check all expected values
			for k, expectedVal := range tc.expected {
				actualVal, exists := result[k]
				if !exists {
					t.Errorf("Missing key %s in result", k)
					continue
				}

				switch expected := expectedVal.(type) {
				case time.Time:
					// For time values, use Equal for comparison
					actualTime, ok := actualVal.(time.Time)
					if !ok {
						t.Errorf("Expected time.Time for %s but got %T", k, actualVal)
						continue
					}
					if !actualTime.Equal(expected) {
						t.Errorf("For key %s, expected %v but got %v", k, expected, actualTime)
					}
				default:
					// For other values, use regular equality check
					if actualVal != expectedVal {
						t.Errorf("For key %s, expected %v but got %v", k, expectedVal, actualVal)
					}
				}
			}
		})
	}
}

func TestParseDateTime(t *testing.T) {
	testCases := []struct {
		input    string
		expected time.Time
		hasError bool
	}{
		{"2023-05-15T14:30:45Z", time.Date(2023, 5, 15, 14, 30, 45, 0, time.UTC), false},
		{"2023-05-15T14:30:45.123Z", time.Date(2023, 5, 15, 14, 30, 45, 123000000, time.UTC), false},
		{"2023-05-15T14:30:45", time.Date(2023, 5, 15, 14, 30, 45, 0, time.UTC), false},
		{"2023-05-15 14:30:45", time.Date(2023, 5, 15, 14, 30, 45, 0, time.UTC), false},
		{"2023-05-15 14:30:45.123", time.Date(2023, 5, 15, 14, 30, 45, 123000000, time.UTC), false},
		{"2023-05-15", time.Date(2023, 5, 15, 0, 0, 0, 0, time.UTC), false},
		{"05/15/2023", time.Date(2023, 5, 15, 0, 0, 0, 0, time.UTC), false},
		{"15.05.2023", time.Date(2023, 5, 15, 0, 0, 0, 0, time.UTC), false},
		{"1684161045", time.Date(2023, 5, 15, 14, 30, 45, 0, time.UTC), false},
		{"not-a-date", time.Time{}, true},
	}

	for _, tc := range testCases {
		result, err := parseDateTime(tc.input)

		if tc.hasError {
			if err == nil {
				t.Errorf("Expected error for input %q but got none", tc.input)
			}
			continue
		}

		if err != nil {
			t.Errorf("Unexpected error for input %q: %v", tc.input, err)
			continue
		}

		if !result.Equal(tc.expected) {
			t.Errorf("For input %q, expected %v but got %v", tc.input, tc.expected, result)
		}
	}
}

func TestMissingDateTimeField(t *testing.T) {
	schemaConfig := SchemaConfig{
		Fields: map[string]DataType{
			"id":        TypeInt,
			"timestamp": TypeDateTime,
		},
		Columns: []ClickHouseColumn{
			{ColumnName: "user_id", FieldName: "id", ColumnType: "UInt32"},
			{ColumnName: "event_time", FieldName: "timestamp", ColumnType: "DateTime64(3)"},
		},
	}

	mapper, err := NewSchemaMapper(schemaConfig)
	if err != nil {
		t.Fatalf("Failed to create schema mapper: %v", err)
	}

	// JSON without timestamp field
	json := `{"id": 1}`

	result, err := mapper.PrepareForClickHouse([]byte(json))
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}

	// Check that user_id is present
	if userId, exists := result["user_id"]; !exists {
		t.Errorf("Missing user_id in result")
	} else if userId != int64(1) {
		t.Errorf("Expected user_id=1 but got %v", userId)
	}

	// Check that event_time is not present (as it was missing in input)
	if _, exists := result["event_time"]; exists {
		t.Errorf("event_time should not be in result as it was missing in input")
	}
}
