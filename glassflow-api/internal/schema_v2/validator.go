package schemav2

import (
	"fmt"

	"github.com/tidwall/gjson"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

// validateSchemaToMapping - validate schema fields against schema mapping
func validateSchemaToMapping(sourceID string, schema models.SchemaFields, mapping *models.Mapping) error {
	return validateSchemaToFieldMapping(sourceID, schema, mapping)
}

// validateSchemaToFieldMapping - validate that mapping fields exist in the schema and types match
func validateSchemaToFieldMapping(sourceID string, schema models.SchemaFields, mapping *models.Mapping) error {
	sourceSchema := make(map[string]string)
	for _, field := range schema.Fields {
		sourceSchema[field.Name] = field.Type
	}

	for _, field := range mapping.Fields {
		if field.SourceID != sourceID {
			continue
		}

		fieldType, exists := sourceSchema[field.SourceField]
		if !exists {
			return fmt.Errorf("field %s is absent in the source schema", field.SourceField)
		}

		if fieldType != field.SourceType {
			return fmt.Errorf("field %s type mismatch: schema has %s, mapping has %s", field.SourceField, fieldType, field.SourceType)
		}
	}

	return nil
}

// validateJSONToSchema - validate message against schema fields
func validateJSONToSchema(msg []byte, schema models.SchemaFields) error {
	if !gjson.ValidBytes(msg) {
		return fmt.Errorf("invalid JSON message")
	}

	parsedMsg := gjson.ParseBytes(msg)

	for _, field := range schema.Fields {
		fieldValue := parsedMsg.Get(field.Name)

		if !fieldValue.Exists() {
			return fmt.Errorf("field %s is missing in the message", field.Name)
		}

		// Basic type checking
		err := validateFieldType(field, fieldValue)
		if err != nil {
			return fmt.Errorf("field %s type validation failed: %w", field.Name, err)
		}
	}

	return nil
}

// validateFieldType checks if the gjson.Result matches the expected type
func validateFieldType(expected models.Field, value gjson.Result) error {
	switch expected.Type {
	case internal.KafkaTypeString, internal.KafkaTypeBytes:
		if value.Type != gjson.String {
			return fmt.Errorf("expected string, got %s", value.Type.String())
		}
	case internal.KafkaTypeInt, internal.KafkaTypeInt8, internal.KafkaTypeInt16,
		internal.KafkaTypeInt32, internal.KafkaTypeInt64, internal.KafkaTypeUint,
		internal.KafkaTypeUint8, internal.KafkaTypeUint16, internal.KafkaTypeUint32,
		internal.KafkaTypeUint64, internal.KafkaTypeFloat, internal.KafkaTypeFloat32,
		internal.KafkaTypeFloat64:
		if value.Type != gjson.Number {
			return fmt.Errorf("expected number, got %s", value.Type.String())
		}
	case internal.KafkaTypeBool:
		if value.Type != gjson.True && value.Type != gjson.False {
			return fmt.Errorf("expected boolean, got %s", value.Type.String())
		}
	case internal.KafkaTypeArray:
		if !value.IsArray() {
			return fmt.Errorf("expected array, got %s", value.Type.String())
		}
	case internal.KafkaTypeMap:
		if !value.IsObject() {
			return fmt.Errorf("expected object, got %s", value.Type.String())
		}
	}

	return nil
}
