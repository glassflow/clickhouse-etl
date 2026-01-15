package json

import (
	"strings"
	"testing"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

func TestValidateTransformationAgainstSchema(t *testing.T) {
	tests := []struct {
		name            string
		schema          models.SchemaFields
		transformations []models.Transform
		wantErr         bool
		errContains     string
	}{
		{
			name: "valid transformation with existing field",
			schema: models.SchemaFields{
				Fields: []models.Field{
					{Name: "name", Type: internal.KafkaTypeString},
					{Name: "age", Type: internal.KafkaTypeInt32},
				},
			},
			transformations: []models.Transform{
				{
					Expression: `upper(name)`,
					OutputName: "upper_name",
					OutputType: "string",
				},
			},
			wantErr: false,
		},
		{
			name: "valid transformation with multiple fields",
			schema: models.SchemaFields{
				Fields: []models.Field{
					{Name: "first_name", Type: internal.KafkaTypeString},
					{Name: "last_name", Type: internal.KafkaTypeString},
					{Name: "age", Type: internal.KafkaTypeInt32},
				},
			},
			transformations: []models.Transform{
				{
					Expression: `upper(first_name)`,
					OutputName: "FIRST_NAME",
					OutputType: "string",
				},
				{
					Expression: `lower(last_name)`,
					OutputName: "last_name_lower",
					OutputType: "string",
				},
				{
					Expression: `age * 365`,
					OutputName: "age_in_days",
					OutputType: "int",
				},
			},
			wantErr: false,
		},
		{
			name: "valid transformation with string concatenation",
			schema: models.SchemaFields{
				Fields: []models.Field{
					{Name: "first_name", Type: internal.KafkaTypeString},
					{Name: "last_name", Type: internal.KafkaTypeString},
				},
			},
			transformations: []models.Transform{
				{
					Expression: `first_name + " " + last_name`,
					OutputName: "full_name",
					OutputType: "string",
				},
			},
			wantErr: false,
		},
		{
			name: "valid transformation with custom functions",
			schema: models.SchemaFields{
				Fields: []models.Field{
					{Name: "text", Type: internal.KafkaTypeString},
					{Name: "number", Type: internal.KafkaTypeInt32},
				},
			},
			transformations: []models.Transform{
				{
					Expression: `containsStr(text, "hello")`,
					OutputName: "has_hello",
					OutputType: "bool",
				},
				{
					Expression: `toString(number)`,
					OutputName: "number_str",
					OutputType: "string",
				},
			},
			wantErr: false,
		},
		{
			name: "invalid transformation - unknown field",
			schema: models.SchemaFields{
				Fields: []models.Field{
					{Name: "name", Type: internal.KafkaTypeString},
				},
			},
			transformations: []models.Transform{
				{
					Expression: `upper(unknown_field)`,
					OutputName: "result",
					OutputType: "string",
				},
			},
			wantErr:     true,
			errContains: "unknown_field",
		},
		{
			name: "invalid transformation - field not in schema",
			schema: models.SchemaFields{
				Fields: []models.Field{
					{Name: "id", Type: internal.KafkaTypeInt32},
					{Name: "name", Type: internal.KafkaTypeString},
				},
			},
			transformations: []models.Transform{
				{
					Expression: `email + "@example.com"`,
					OutputName: "full_email",
					OutputType: "string",
				},
			},
			wantErr:     true,
			errContains: "email",
		},
		{
			name: "invalid transformation - syntax error",
			schema: models.SchemaFields{
				Fields: []models.Field{
					{Name: "name", Type: internal.KafkaTypeString},
				},
			},
			transformations: []models.Transform{
				{
					Expression: `upper(name`,
					OutputName: "result",
					OutputType: "string",
				},
			},
			wantErr: true,
		},
		{
			name: "empty transformations - should pass",
			schema: models.SchemaFields{
				Fields: []models.Field{
					{Name: "name", Type: internal.KafkaTypeString},
				},
			},
			transformations: []models.Transform{},
			wantErr:         false,
		},
		{
			name: "nil transformations - should pass",
			schema: models.SchemaFields{
				Fields: []models.Field{
					{Name: "name", Type: internal.KafkaTypeString},
				},
			},
			transformations: nil,
			wantErr:         false,
		},
		{
			name: "valid transformation with nested field access",
			schema: models.SchemaFields{
				Fields: []models.Field{
					{Name: "user", Type: internal.KafkaTypeString},
					{Name: "data", Type: internal.KafkaTypeMap},
				},
			},
			transformations: []models.Transform{
				{
					Expression: `getNestedParam(data, "address.city")`,
					OutputName: "city",
					OutputType: "string",
				},
			},
			wantErr: false,
		},
		{
			name: "valid transformation with waterfall function",
			schema: models.SchemaFields{
				Fields: []models.Field{
					{Name: "primary", Type: internal.KafkaTypeString},
					{Name: "secondary", Type: internal.KafkaTypeString},
				},
			},
			transformations: []models.Transform{
				{
					Expression: `waterfall(primary, secondary, "default")`,
					OutputName: "value",
					OutputType: "string",
				},
			},
			wantErr: false,
		},
		{
			name: "valid transformation with type conversion",
			schema: models.SchemaFields{
				Fields: []models.Field{
					{Name: "number_str", Type: internal.KafkaTypeString},
					{Name: "value", Type: internal.KafkaTypeInt32},
				},
			},
			transformations: []models.Transform{
				{
					Expression: `toInt(number_str)`,
					OutputName: "parsed_number",
					OutputType: "int",
				},
				{
					Expression: `toFloat(value)`,
					OutputName: "float_value",
					OutputType: "float64",
				},
			},
			wantErr: false,
		},
		{
			name: "valid transformation with boolean fields",
			schema: models.SchemaFields{
				Fields: []models.Field{
					{Name: "is_active", Type: internal.KafkaTypeBool},
					{Name: "count", Type: internal.KafkaTypeInt32},
				},
			},
			transformations: []models.Transform{
				{
					Expression: `is_active && count > 0`,
					OutputName: "is_valid",
					OutputType: "bool",
				},
			},
			wantErr: false,
		},
		{
			name: "valid transformation with all supported types",
			schema: models.SchemaFields{
				Fields: []models.Field{
					{Name: "str_field", Type: internal.KafkaTypeString},
					{Name: "int_field", Type: internal.KafkaTypeInt},
					{Name: "int32_field", Type: internal.KafkaTypeInt32},
					{Name: "int64_field", Type: internal.KafkaTypeInt64},
					{Name: "uint_field", Type: internal.KafkaTypeUint},
					{Name: "uint32_field", Type: internal.KafkaTypeUint32},
					{Name: "float_field", Type: internal.KafkaTypeFloat},
					{Name: "float32_field", Type: internal.KafkaTypeFloat32},
					{Name: "float64_field", Type: internal.KafkaTypeFloat64},
					{Name: "bool_field", Type: internal.KafkaTypeBool},
					{Name: "bytes_field", Type: internal.KafkaTypeBytes},
					{Name: "array_field", Type: internal.KafkaTypeArray},
					{Name: "map_field", Type: internal.KafkaTypeMap},
				},
			},
			transformations: []models.Transform{
				{
					Expression: `upper(str_field)`,
					OutputName: "upper_str",
					OutputType: "string",
				},
				{
					Expression: `int_field + int32_field + int64_field`,
					OutputName: "sum_ints",
					OutputType: "int64",
				},
				{
					Expression: `float_field + float32_field + float64_field`,
					OutputName: "sum_floats",
					OutputType: "float64",
				},
				{
					Expression: `bool_field && uint_field > 0`,
					OutputName: "is_valid",
					OutputType: "bool",
				},
			},
			wantErr: false,
		},
		{
			name: "valid transformation with array and map types",
			schema: models.SchemaFields{
				Fields: []models.Field{
					{Name: "tags", Type: internal.KafkaTypeArray},
					{Name: "metadata", Type: internal.KafkaTypeMap},
					{Name: "name", Type: internal.KafkaTypeString},
				},
			},
			transformations: []models.Transform{
				{
					Expression: `keys(metadata)`,
					OutputName: "meta_keys",
					OutputType: "[]string",
				},
				{
					Expression: `hasKeyPrefix(metadata, "user_")`,
					OutputName: "has_user_keys",
					OutputType: "bool",
				},
			},
			wantErr: false,
		},
		{
			name: "valid transformation with split and join",
			schema: models.SchemaFields{
				Fields: []models.Field{
					{Name: "csv_data", Type: internal.KafkaTypeString},
					{Name: "items", Type: internal.KafkaTypeArray},
				},
			},
			transformations: []models.Transform{
				{
					Expression: `split(csv_data, ",")`,
					OutputName: "values",
					OutputType: "[]string",
				},
			},
			wantErr: false,
		},
		{
			name: "valid transformation with hasPrefix and hasSuffix",
			schema: models.SchemaFields{
				Fields: []models.Field{
					{Name: "filename", Type: internal.KafkaTypeString},
					{Name: "url", Type: internal.KafkaTypeString},
				},
			},
			transformations: []models.Transform{
				{
					Expression: `hasPrefix(url, "https://")`,
					OutputName: "is_secure",
					OutputType: "bool",
				},
				{
					Expression: `hasSuffix(filename, ".json")`,
					OutputName: "is_json",
					OutputType: "bool",
				},
			},
			wantErr: false,
		},
		{
			name: "valid transformation with replace",
			schema: models.SchemaFields{
				Fields: []models.Field{
					{Name: "text", Type: internal.KafkaTypeString},
				},
			},
			transformations: []models.Transform{
				{
					Expression: `replace(text, "old", "new")`,
					OutputName: "updated_text",
					OutputType: "string",
				},
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateTransformationAgainstSchema(tt.transformations, tt.schema.Fields)

			if tt.wantErr {
				if err == nil {
					t.Errorf("ValidateTransformationAgainstSchema() error = nil, wantErr = true")
					return
				}
				if tt.errContains != "" {
					if !strings.Contains(err.Error(), tt.errContains) {
						t.Errorf("ValidateTransformationAgainstSchema() error = %v, should contain %q", err, tt.errContains)
					}
				}
			} else {
				if err != nil {
					t.Errorf("ValidateTransformationAgainstSchema() error = %v, wantErr = false", err)
				}
			}
		})
	}
}
