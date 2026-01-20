package registry

import (
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

func TestParseJSONSchema(t *testing.T) {
	tests := []struct {
		name        string
		schema      string
		expected    []models.Field
		expectError bool
		errorType   error
	}{
		{
			name: "simple JSON schema with basic types",
			schema: `{
                "$schema": "http://json-schema.org/draft-07/schema#",
                "title": "User",
                "type": "object",
                "properties": {
                    "user_id": {"type": "string"},
                    "username": {"type": "string"},
                    "age": {"type": "integer"},
                    "score": {"type": "number"},
                    "is_active": {"type": "boolean"}
                }
            }`,
			expected: []models.Field{
				{Name: "user_id", Type: internal.KafkaTypeString},
				{Name: "username", Type: internal.KafkaTypeString},
				{Name: "age", Type: internal.KafkaTypeInt},
				{Name: "score", Type: internal.KafkaTypeFloat},
				{Name: "is_active", Type: internal.KafkaTypeBool},
			},
			expectError: false,
		},
		{
			name: "JSON schema with array type",
			schema: `{
                "$schema": "http://json-schema.org/draft-07/schema#",
                "title": "Order",
                "type": "object",
                "properties": {
                    "order_id": {"type": "string"},
                    "tags": {
                        "type": "array",
                        "items": {"type": "string"}
                    },
                    "quantities": {
                        "type": "array",
                        "items": {"type": "integer"}
                    }
                }
            }`,
			expected: []models.Field{
				{Name: "order_id", Type: internal.KafkaTypeString},
				{Name: "tags", Type: internal.KafkaTypeArray},
				{Name: "quantities", Type: internal.KafkaTypeArray},
			},
			expectError: false,
		},
		{
			name: "JSON schema with object/map type",
			schema: `{
                "$schema": "http://json-schema.org/draft-07/schema#",
                "title": "Customer",
                "type": "object",
                "properties": {
                    "customer_id": {"type": "string"},
                    "metadata": {
                        "type": "object",
                        "additionalProperties": {"type": "string"}
                    },
                    "address": {
                        "type": "object",
                        "properties": {
                            "street": {"type": "string"},
                            "city": {"type": "string"}
                        }
                    }
                }
            }`,
			expected: []models.Field{
				{Name: "customer_id", Type: internal.KafkaTypeString},
				{Name: "address.street", Type: internal.KafkaTypeString},
				{Name: "address.city", Type: internal.KafkaTypeString},
			},
			expectError: false,
		},
		{
			name: "JSON schema with all one empty object",
			schema: `{
                "type": "object",
                "properties": {
                    "string_field": {"type": "string"},
                    "int_field": {"type": "integer"},
                    "number_field": {"type": "number"},
                    "bool_field": {"type": "boolean"},
                    "array_field": {"type": "array"},
                    "object_field": {"type": "object"}
                }
            }`,
			expected: []models.Field{
				{Name: "string_field", Type: internal.KafkaTypeString},
				{Name: "int_field", Type: internal.KafkaTypeInt},
				{Name: "number_field", Type: internal.KafkaTypeFloat},
				{Name: "bool_field", Type: internal.KafkaTypeBool},
				{Name: "array_field", Type: internal.KafkaTypeArray},
			},
			expectError: false,
		},
		{
			name: "real-world e-commerce order schema",
			schema: `{
                "$schema": "http://json-schema.org/draft-07/schema#",
                "title": "Order",
                "type": "object",
                "properties": {
                    "order_id": {"type": "string"},
                    "customer_id": {"type": "string"},
                    "total_amount": {"type": "number"},
                    "items": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "product_id": {"type": "string"},
                                "quantity": {"type": "integer"}
                            }
                        }
                    },
                    "metadata": {
                        "type": "object",
                        "additionalProperties": {"type": "string"}
                    },
                    "is_paid": {"type": "boolean"}
                }
            }`,
			expected: []models.Field{
				{Name: "order_id", Type: internal.KafkaTypeString},
				{Name: "customer_id", Type: internal.KafkaTypeString},
				{Name: "total_amount", Type: internal.KafkaTypeFloat},
				{Name: "items", Type: internal.KafkaTypeArray},
				{Name: "is_paid", Type: internal.KafkaTypeBool},
			},
			expectError: false,
		},
		{
			name: "schema with fields without type (should skip them)",
			schema: `{
                "type": "object",
                "properties": {
                    "valid_field": {"type": "string"},
                    "invalid_field": {"description": "no type specified"},
                    "another_valid": {"type": "integer"}
                }
            }`,
			expected: []models.Field{
				{Name: "valid_field", Type: internal.KafkaTypeString},
				{Name: "another_valid", Type: internal.KafkaTypeInt},
			},
			expectError: false,
		},
		{
			name: "non-object type",
			schema: `{
                "$schema": "http://json-schema.org/draft-07/schema#",
                "type": "string"
            }`,
			expected:    []models.Field{},
			expectError: true,
			errorType:   models.ErrInvalidSchema,
		},
		{
			name: "schema without properties",
			schema: `{
                "$schema": "http://json-schema.org/draft-07/schema#",
                "title": "Empty",
                "type": "object"
            }`,
			expected:    []models.Field{},
			expectError: true,
			errorType:   models.ErrInvalidSchema,
		},
		{
			name: "schema without type field",
			schema: `{
                "$schema": "http://json-schema.org/draft-07/schema#",
                "properties": {
                    "field": {"type": "string"}
                }
            }`,
			expected:    []models.Field{},
			expectError: true,
			errorType:   models.ErrInvalidSchema,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := parseJSONSchema(tt.schema)

			if tt.expectError {
				require.Error(t, err)
				if tt.errorType != nil {
					require.ErrorIs(t, err, tt.errorType)
				}
			} else {
				require.NoError(t, err)
				require.Equal(t, tt.expected, result)
			}
		})
	}
}

func TestResolveJSONSchemaType(t *testing.T) {
	tests := []struct {
		name        string
		property    string
		expected    string
		expectError bool
	}{
		{
			name:        "string type",
			property:    `{"type": "string"}`,
			expected:    internal.KafkaTypeString,
			expectError: false,
		},
		{
			name:        "integer type",
			property:    `{"type": "integer"}`,
			expected:    internal.KafkaTypeInt,
			expectError: false,
		},
		{
			name:        "number type",
			property:    `{"type": "number"}`,
			expected:    internal.KafkaTypeFloat,
			expectError: false,
		},
		{
			name:        "boolean type",
			property:    `{"type": "boolean"}`,
			expected:    internal.KafkaTypeBool,
			expectError: false,
		},
		{
			name:        "array type",
			property:    `{"type": "array", "items": {"type": "string"}}`,
			expected:    internal.KafkaTypeArray,
			expectError: false,
		},
		{
			name:        "object type",
			property:    `{"type": "object", "properties": {"field": {"type": "string"}}}`,
			expected:    internal.KafkaTypeMap,
			expectError: false,
		},
		{
			name:        "object with additionalProperties",
			property:    `{"type": "object", "additionalProperties": {"type": "string"}}`,
			expected:    internal.KafkaTypeMap,
			expectError: false,
		},
		{
			name:        "missing type field",
			property:    `{"description": "no type"}`,
			expected:    "",
			expectError: true,
		},
		{
			name:        "unsupported type",
			property:    `{"type": "null"}`,
			expected:    "",
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := gjson.Parse(tt.property)
			typeResult, err := resolveJSONSchemaType(result)

			if tt.expectError {
				require.Error(t, err)
				require.ErrorIs(t, err, models.ErrUnsupportedDataType)
				require.Empty(t, typeResult)
			} else {
				require.NoError(t, err)
				require.Equal(t, tt.expected, typeResult)
			}
		})
	}
}

func TestParseJSONSchemaEdgeCases(t *testing.T) {
	t.Run("empty properties object", func(t *testing.T) {
		schema := `{
            "type": "object",
            "properties": {}
        }`
		result, err := parseJSONSchema(schema)
		require.NoError(t, err)
		require.Empty(t, result)
	})

	t.Run("mixed valid and invalid fields", func(t *testing.T) {
		schema := `{
            "type": "object",
            "properties": {
                "valid1": {"type": "string"},
                "invalid1": {"description": "missing type"},
                "valid2": {"type": "integer"},
                "invalid2": {"type": "unknown_type"}
            }
        }`
		result, err := parseJSONSchema(schema)
		require.NoError(t, err)
		require.Len(t, result, 2)
		require.Equal(t, models.Field{Name: "valid1", Type: internal.KafkaTypeString}, result[0])
		require.Equal(t, models.Field{Name: "valid2", Type: internal.KafkaTypeInt}, result[1])
	})

	t.Run("nested array in object", func(t *testing.T) {
		schema := `{
            "type": "object",
            "properties": {
                "data": {
                    "type": "object",
                    "properties": {
                        "items": {"type": "array"}
                    }
                }
            }
        }`
		result, err := parseJSONSchema(schema)
		require.NoError(t, err)
		require.Equal(t, models.Field{Name: "data.items", Type: internal.KafkaTypeArray}, result[0])
	})

	t.Run("invalid fields only", func(t *testing.T) {
		schema := `{
			"type": "object",
			"properties": {
				"invalid1": {"description": "missing type"},
				"invalid2": {"type": "unknown_type"}
			}
		}`
		result, err := parseJSONSchema(schema)
		require.NoError(t, err)
		require.Len(t, result, 0)
	})
}
