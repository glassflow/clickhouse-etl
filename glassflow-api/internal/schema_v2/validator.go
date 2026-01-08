package schemav2

import (
	"errors"
	"fmt"

	"github.com/tidwall/gjson"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

// validate schema to schema - validate that all schema fields from previous schema exist in the new schema with the same types
func validateSchemaToSchema(newSchemaFields, previousSchemaFields models.SchemaFields) error {
	// Create a map of new schema fields for quick lookup
	newSchema := make(map[string]string)
	for _, field := range newSchemaFields.Fields {
		newSchema[field.Name] = field.Type
	}

	// Check that all previous fields exist in new schema with same types
	var errs []error
	for _, previousField := range previousSchemaFields.Fields {
		newType, exists := newSchema[previousField.Name]
		if !exists {
			errs = append(errs, fmt.Errorf("field %s from previous schema is missing in the new schema", previousField.Name))
			continue
		}

		if newType != previousField.Type {
			errs = append(errs, fmt.Errorf("field %s type changed: previous schema has %s, new schema has %s",
				previousField.Name, previousField.Type, newType))
		}
	}

	if len(errs) > 0 {
		return errors.Join(errs...)
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
