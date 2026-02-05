package json

import (
	"fmt"

	"github.com/expr-lang/expr"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

// ValidateTransformationAgainstSchema validates that all transformation expressions against given schema fields
// It doesn't take effect on transformation business logic
func ValidateTransformationAgainstSchema(
	transformations []models.Transform,
	fields []models.Field,
) error {
	if len(transformations) == 0 {
		return nil
	}

	env := make(map[string]any)
	for _, field := range fields {
		// Create sample values based on type
		switch field.Type {
		case internal.KafkaTypeString:
			env[field.Name] = ""
		case internal.KafkaTypeInt, internal.KafkaTypeInt8, internal.KafkaTypeInt16,
			internal.KafkaTypeInt32, internal.KafkaTypeInt64,
			internal.KafkaTypeUint, internal.KafkaTypeUint8,
			internal.KafkaTypeUint16, internal.KafkaTypeUint32,
			internal.KafkaTypeUint64:
			env[field.Name] = 0
		case internal.KafkaTypeFloat, internal.KafkaTypeFloat32,
			internal.KafkaTypeFloat64:
			env[field.Name] = 0.0
		case internal.KafkaTypeBool:
			env[field.Name] = false
		case internal.KafkaTypeBytes:
			env[field.Name] = []byte{}
		case internal.KafkaTypeArray:
			env[field.Name] = []any{}
		case internal.KafkaTypeMap:
			env[field.Name] = map[string]any{}
		default:
			return fmt.Errorf("unsupported field type %q for field %q", field.Type, field.Name)
		}
	}

	var options []expr.Option
	options = append(options, expr.Env(env))
	options = append(options, predefinedTransformations...)

	for i, transformation := range transformations {
		_, err := expr.Compile(
			transformation.Expression,
			options...,
		)
		if err != nil {
			return fmt.Errorf(
				"transformation %d (output: %s, expression: %q) : %w",
				i,
				transformation.OutputName,
				transformation.Expression,
				err,
			)
		}
	}

	return nil
}
