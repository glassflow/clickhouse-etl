package schemav2

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/tidwall/gjson"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

func TestValidateJSONToSchema(t *testing.T) {
	tests := []struct {
		name      string
		msg       []byte
		schema    []models.Field
		wantError bool
		errorMsg  string
	}{
		{
			name: "valid JSON matching schema",
			msg:  []byte(`{"id": 123, "name": "test"}`),
			schema: []models.Field{
				{Name: "id", Type: internal.KafkaTypeInt},
				{Name: "name", Type: internal.KafkaTypeString},
			},
			wantError: false,
		},
		{
			name: "invalid JSON",
			msg:  []byte(`{invalid json`),
			schema: []models.Field{
				{Name: "id", Type: internal.KafkaTypeInt},
			},
			wantError: true,
			errorMsg:  "invalid JSON message",
		},
		{
			name: "missing field in message",
			msg:  []byte(`{"id": 123}`),
			schema: []models.Field{
				{Name: "id", Type: internal.KafkaTypeInt},
				{Name: "name", Type: internal.KafkaTypeString},
			},
			wantError: true,
			errorMsg:  "field 'name' is missing in the message",
		},
		{
			name: "type mismatch - expected string got number",
			msg:  []byte(`{"id": 123, "name": 456}`),
			schema: []models.Field{
				{Name: "id", Type: internal.KafkaTypeInt},
				{Name: "name", Type: internal.KafkaTypeString},
			},
			wantError: true,
			errorMsg:  "field 'name' type validation failed",
		},
		{
			name: "type mismatch - expected number got string",
			msg:  []byte(`{"id": "123"}`),
			schema: []models.Field{
				{Name: "id", Type: internal.KafkaTypeInt},
			},
			wantError: true,
			errorMsg:  "field 'id' type validation failed",
		},
		{
			name: "valid complex types",
			msg:  []byte(`{"active": true, "tags": ["tag1", "tag2"], "metadata": {"key": "value"}}`),
			schema: []models.Field{
				{Name: "active", Type: internal.KafkaTypeBool},
				{Name: "tags", Type: internal.KafkaTypeArray},
				{Name: "metadata", Type: internal.KafkaTypeMap},
			},
			wantError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateJSONToSchema(tt.msg, tt.schema)
			if tt.wantError {
				assert.Error(t, err)
				if tt.errorMsg != "" {
					assert.Contains(t, err.Error(), tt.errorMsg)
				}
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestValidateFieldType(t *testing.T) {
	tests := []struct {
		name      string
		field     models.Field
		jsonValue string
		wantError bool
		errorMsg  string
	}{
		{
			name:      "valid string",
			field:     models.Field{Name: "name", Type: internal.KafkaTypeString},
			jsonValue: `"hello"`,
			wantError: false,
		},
		{
			name:      "invalid string - number provided",
			field:     models.Field{Name: "name", Type: internal.KafkaTypeString},
			jsonValue: `123`,
			wantError: true,
			errorMsg:  "expected string",
		},
		{
			name:      "valid integer",
			field:     models.Field{Name: "age", Type: internal.KafkaTypeInt},
			jsonValue: `42`,
			wantError: false,
		},
		{
			name:      "valid float",
			field:     models.Field{Name: "price", Type: internal.KafkaTypeFloat},
			jsonValue: `99.99`,
			wantError: false,
		},
		{
			name:      "invalid number - string provided",
			field:     models.Field{Name: "age", Type: internal.KafkaTypeInt},
			jsonValue: `"42"`,
			wantError: true,
			errorMsg:  "expected number",
		},
		{
			name:      "valid boolean true",
			field:     models.Field{Name: "active", Type: internal.KafkaTypeBool},
			jsonValue: `true`,
			wantError: false,
		},
		{
			name:      "valid boolean false",
			field:     models.Field{Name: "active", Type: internal.KafkaTypeBool},
			jsonValue: `false`,
			wantError: false,
		},
		{
			name:      "invalid boolean - string provided",
			field:     models.Field{Name: "active", Type: internal.KafkaTypeBool},
			jsonValue: `"true"`,
			wantError: true,
			errorMsg:  "expected boolean",
		},
		{
			name:      "valid array",
			field:     models.Field{Name: "tags", Type: internal.KafkaTypeArray},
			jsonValue: `["tag1", "tag2"]`,
			wantError: false,
		},
		{
			name:      "invalid array - object provided",
			field:     models.Field{Name: "tags", Type: internal.KafkaTypeArray},
			jsonValue: `{"key": "value"}`,
			wantError: true,
			errorMsg:  "expected array",
		},
		{
			name:      "valid map/object",
			field:     models.Field{Name: "metadata", Type: internal.KafkaTypeMap},
			jsonValue: `{"key": "value"}`,
			wantError: false,
		},
		{
			name:      "invalid map - array provided",
			field:     models.Field{Name: "metadata", Type: internal.KafkaTypeMap},
			jsonValue: `["item1", "item2"]`,
			wantError: true,
			errorMsg:  "expected object",
		},
		{
			name:      "valid bytes (string)",
			field:     models.Field{Name: "data", Type: internal.KafkaTypeString},
			jsonValue: `"base64data"`,
			wantError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			value := gjson.Parse(tt.jsonValue)
			err := validateFieldType(tt.field, value)
			if tt.wantError {
				assert.Error(t, err)
				if tt.errorMsg != "" {
					assert.Contains(t, err.Error(), tt.errorMsg)
				}
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestValidateSchemaToSchema(t *testing.T) {
	tests := []struct {
		name                 string
		newSchemaFields      []models.Field
		previousSchemaFields []models.Field
		wantError            bool
		errorContains        []string
	}{
		{
			name: "valid schema - same fields",
			previousSchemaFields: []models.Field{
				{Name: "id", Type: internal.KafkaTypeInt},
				{Name: "name", Type: internal.KafkaTypeString},
			},
			newSchemaFields: []models.Field{
				{Name: "id", Type: internal.KafkaTypeInt},
				{Name: "name", Type: internal.KafkaTypeString},
			},
			wantError: false,
		},
		{
			name: "valid schema - new schema has additional fields",
			previousSchemaFields: []models.Field{
				{Name: "id", Type: internal.KafkaTypeInt},
				{Name: "name", Type: internal.KafkaTypeString},
			},
			newSchemaFields: []models.Field{
				{Name: "id", Type: internal.KafkaTypeInt},
				{Name: "name", Type: internal.KafkaTypeString},
				{Name: "email", Type: internal.KafkaTypeString},
				{Name: "age", Type: internal.KafkaTypeInt},
			},
			wantError: false,
		},
		{
			name: "invalid - missing field in new schema",
			previousSchemaFields: []models.Field{
				{Name: "id", Type: internal.KafkaTypeInt},
				{Name: "name", Type: internal.KafkaTypeString},
			},
			newSchemaFields: []models.Field{
				{Name: "id", Type: internal.KafkaTypeInt},
			},
			wantError: true,
			errorContains: []string{
				"field name from previous schema is missing in the new schema",
			},
		},
		{
			name: "invalid - type changed",
			previousSchemaFields: []models.Field{
				{Name: "id", Type: internal.KafkaTypeInt},
				{Name: "name", Type: internal.KafkaTypeString},
			},
			newSchemaFields: []models.Field{
				{Name: "id", Type: internal.KafkaTypeString},
				{Name: "name", Type: internal.KafkaTypeString},
			},
			wantError: true,
			errorContains: []string{
				"field id type changed",
				"previous schema has int",
				"new schema has string",
			},
		},
		{
			name: "invalid - multiple errors: missing fields and type changes",
			previousSchemaFields: []models.Field{
				{Name: "id", Type: internal.KafkaTypeInt},
				{Name: "name", Type: internal.KafkaTypeString},
				{Name: "active", Type: internal.KafkaTypeBool},
			},
			newSchemaFields: []models.Field{
				{Name: "id", Type: internal.KafkaTypeString},
				{Name: "email", Type: internal.KafkaTypeString},
			},
			wantError: true,
			errorContains: []string{
				"field id type changed",
				"field name from previous schema is missing",
				"field active from previous schema is missing",
			},
		},
		{
			name:                 "valid - empty previous schema",
			previousSchemaFields: []models.Field{},
			newSchemaFields: []models.Field{
				{Name: "id", Type: internal.KafkaTypeInt},
				{Name: "name", Type: internal.KafkaTypeString},
			},
			wantError: false,
		},
		{
			name: "invalid - multiple type changes",
			previousSchemaFields: []models.Field{
				{Name: "id", Type: internal.KafkaTypeInt},
				{Name: "count", Type: internal.KafkaTypeInt},
				{Name: "active", Type: internal.KafkaTypeBool},
			},
			newSchemaFields: []models.Field{
				{Name: "id", Type: internal.KafkaTypeString},
				{Name: "count", Type: internal.KafkaTypeString},
				{Name: "active", Type: internal.KafkaTypeString},
			},
			wantError: true,
			errorContains: []string{
				"field id type changed",
				"field count type changed",
				"field active type changed",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateSchemaToSchema(tt.newSchemaFields, tt.previousSchemaFields)
			if tt.wantError {
				assert.Error(t, err)
				for _, msg := range tt.errorContains {
					assert.Contains(t, err.Error(), msg)
				}
			} else {
				assert.NoError(t, err)
			}
		})
	}
}
