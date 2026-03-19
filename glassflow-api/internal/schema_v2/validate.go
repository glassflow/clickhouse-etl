package schemav2

import (
	"errors"
	"fmt"
	"strings"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/tidwall/gjson"
)

// fieldCheckType represents the precomputed expected gjson type for a schema field.
type fieldCheckType int

const (
	isNone   fieldCheckType = iota
	isString                // gjson.String
	isNumber                // gjson.Number (covers int, uint, float)
	isBool                  // gjson.True or gjson.False
	isArray                 // IsArray()
	isObject                // IsObject()
)

// fieldCheck holds precomputed validation info for a single schema field,
// avoiding repeated string operations and type normalization per message.
type fieldCheck struct {
	name        string
	escapedName string         // pre-escaped gjson path (dots escaped); empty if no dots
	hasDots     bool           // whether the field name contains dots
	checkType   fieldCheckType // precomputed expected type
}

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

// validateType checks if the gjson.Result matches the precomputed expected type
func (fc *fieldCheck) validateType(value gjson.Result) error {
	switch fc.checkType {
	case isString:
		if value.Type != gjson.String {
			return fmt.Errorf("expected string, got %s", value.Type.String())
		}
	case isNumber:
		if value.Type != gjson.Number {
			return fmt.Errorf("expected number, got %s", value.Type.String())
		}
	case isBool:
		if value.Type != gjson.True && value.Type != gjson.False {
			return fmt.Errorf("expected boolean, got %s", value.Type.String())
		}
	case isArray:
		if !value.IsArray() {
			return fmt.Errorf("expected array, got %s", value.Type.String())
		}
	case isObject:
		if !value.IsObject() {
			return fmt.Errorf("expected object, got %s", value.Type.String())
		}
	}

	return nil
}

// jsonValidator holds precomputed field validation info for reuse across messages
type jsonValidator struct {
	checks     []fieldCheck   // ordered field checks matching schema field order
	fieldNames map[string]int // field name → index in checks, for O(1) lookup during ForEach
	found      []bool         // reusable buffer tracking which fields were seen; safe for single-threaded use
}

// newJSONValidator precomputes all field validation info from schema fields
func newJSONValidator(fields []models.Field) *jsonValidator {
	checks := make([]fieldCheck, len(fields))
	fieldNames := make(map[string]int, len(fields))

	for i, field := range fields {
		check := fieldCheck{
			name:    field.Name,
			hasDots: strings.Contains(field.Name, "."),
		}
		if check.hasDots {
			check.escapedName = strings.ReplaceAll(field.Name, ".", `\.`)
		}

		normalizedType := internal.NormalizeToBasicKafkaType(field.Type)
		switch normalizedType {
		case internal.KafkaTypeString:
			check.checkType = isString
		case internal.KafkaTypeInt, internal.KafkaTypeUint, internal.KafkaTypeFloat:
			check.checkType = isNumber
		case internal.KafkaTypeBool:
			check.checkType = isBool
		case internal.KafkaTypeArray:
			check.checkType = isArray
		case internal.KafkaTypeMap:
			check.checkType = isObject
		default:
			check.checkType = isNone // no type validation for unknown types
		}

		checks[i] = check
		fieldNames[check.name] = i
	}

	return &jsonValidator{
		checks:     checks,
		fieldNames: fieldNames,
		found:      make([]bool, len(checks)),
	}
}

// validate checks a JSON message against precomputed field expectations
func (v *jsonValidator) validate(msg []byte) error {
	parsedMsg := gjson.ParseBytes(msg)
	if parsedMsg.Type != gjson.JSON {
		return fmt.Errorf("invalid JSON message")
	}

	// Reset found flags (cheap: 1 byte per field, no allocation)
	for i := range v.found {
		v.found[i] = false
	}
	remaining := len(v.checks)

	// Single ForEach pass: validate type inline and mark fields as found
	var forEachErr error
	parsedMsg.ForEach(func(key, value gjson.Result) bool {
		idx, ok := v.fieldNames[key.String()]
		if !ok {
			return true
		}
		check := &v.checks[idx]
		if err := check.validateType(value); err != nil {
			forEachErr = fmt.Errorf("field '%s' type validation failed: %w", check.name, err)
			return false
		}
		v.found[idx] = true
		remaining--
		if remaining == 0 {
			return false // all fields found, stop early
		}
		return true
	})

	if forEachErr != nil {
		return forEachErr
	}

	// All fields were found and validated in the ForEach pass.
	if remaining == 0 {
		return nil
	}

	// Some fields were not found as top-level keys. Handle missing fields and
	// dotted fields that may exist as nested objects (e.g. {"container": {"image": {"name": "v"}}}).
	for i := range v.checks {
		if v.found[i] {
			continue
		}
		check := &v.checks[i]
		var value gjson.Result
		if check.hasDots {
			value = parsedMsg.Get(check.escapedName)
			if !value.Exists() {
				value = parsedMsg.Get(check.name)
			}
		}
		if !value.Exists() {
			return fmt.Errorf("field '%s' is missing in the message", check.name)
		}
		if err := check.validateType(value); err != nil {
			return fmt.Errorf("field '%s' type validation failed: %w", check.name, err)
		}
	}

	return nil
}
