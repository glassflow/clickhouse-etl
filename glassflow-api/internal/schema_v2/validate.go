package schemav2

import (
	"errors"
	"fmt"
	"strings"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/tidwall/gjson"
)

// validate schema to schema - validate that all schema fields from previous schema exist in the new schema with the same types
func validateSchemaToSchema(newSchemaFields, previousSchemaFields []models.Field) error {
	// Create a map of new schema fields for quick lookup
	newSchema := make(map[string]string)
	for _, field := range newSchemaFields {
		newSchema[field.Name] = field.Type
	}

	// Check that all previous fields exist in new schema with same types
	var errs []error
	for _, previousField := range previousSchemaFields {
		newType, exists := newSchema[previousField.Name]
		if !exists {
			errs = append(errs, fmt.Errorf("field %s from previous schema is missing in the new schema", previousField.Name))
			continue
		}

		if internal.NormalizeToBasicKafkaType(newType) != internal.NormalizeToBasicKafkaType(previousField.Type) {
			errs = append(errs, fmt.Errorf("field %s type changed: previous schema has %s, new schema has %s",
				previousField.Name, previousField.Type, newType))
		}
	}

	if len(errs) > 0 {
		return errors.Join(errs...)
	}

	return nil
}

// escapeGjsonPath escapes dots in a field name so gjson treats them as literal characters
// rather than path separators. For example, "container.image.name" becomes "container\.image\.name"
// which makes gjson look for the literal key "container.image.name" instead of traversing
// nested objects container -> image -> name.
func escapeJsonPath(path string) string {
	return strings.ReplaceAll(path, ".", `\.`)
}

// getFieldValue retrieves a field value from a parsed gjson result, supporting both
// literal dotted keys (e.g. "container.image.name": "value") and nested object paths
// (e.g. {"container": {"image": {"name": "value"}}}). It tries the escaped (literal) path
// first, then falls back to the unescaped (nested) path.
func getFieldValue(parsedMsg gjson.Result, fieldName string) gjson.Result {
	// Try escaped path first (literal dot key)
	if strings.Contains(fieldName, ".") {
		fieldValue := parsedMsg.Get(escapeJsonPath(fieldName))
		if fieldValue.Exists() {
			return fieldValue
		}
	}

	// Fall back to unescaped path (nested object traversal)
	return parsedMsg.Get(fieldName)
}

// validateJSONToSchema - validate message against schema fields
func validateJSONToSchema(msg []byte, schema []models.Field) error {
	if !gjson.ValidBytes(msg) {
		return fmt.Errorf("invalid JSON message")
	}

	parsedMsg := gjson.ParseBytes(msg)

	for _, field := range schema {
		fieldValue := getFieldValue(parsedMsg, field.Name)

		if !fieldValue.Exists() {
			return fmt.Errorf("field '%s' is missing in the message", field.Name)
		}

		// Basic type checking
		err := validateFieldType(field, fieldValue)
		if err != nil {
			return fmt.Errorf("field '%s' type validation failed: %w", field.Name, err)
		}
	}

	return nil
}

// validateFieldType checks if the gjson.Result matches the expected type
func validateFieldType(expected models.Field, value gjson.Result) error {
	switch expected.Type {
	case internal.KafkaTypeString:
		if value.Type != gjson.String {
			return fmt.Errorf("expected string, got %s", value.Type.String())
		}
	case internal.KafkaTypeInt, internal.KafkaTypeUint, internal.KafkaTypeFloat:
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
