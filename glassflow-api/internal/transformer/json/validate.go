package json

import (
	"fmt"
	"strings"

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
		zero, err := zeroValueForKafkaType(field.Type)
		if err != nil {
			return fmt.Errorf("field %q: %w", field.Name, err)
		}
		if err := setNestedField(env, strings.Split(field.Name, "."), zero); err != nil {
			return fmt.Errorf("field %q: %w", field.Name, err)
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

func zeroValueForKafkaType(kafkaType string) (any, error) {
	switch internal.NormalizeToBasicKafkaType(kafkaType) {
	case internal.KafkaTypeString:
		return "", nil
	case internal.KafkaTypeInt, internal.KafkaTypeUint:
		return 0, nil
	case internal.KafkaTypeFloat:
		return 0.0, nil
	case internal.KafkaTypeBool:
		return false, nil
	case internal.KafkaTypeArray:
		return []any{}, nil
	case internal.KafkaTypeMap:
		return map[string]any{}, nil
	default:
		return nil, fmt.Errorf("unsupported field type %q", kafkaType)
	}
}

// setNestedField walks env along path, creating intermediate map[string]any nodes,
// and assigns value at the leaf. Leaf declarations win over conflicting parent
// declarations so that declaration order in the schema does not matter.
func setNestedField(env map[string]any, path []string, value any) error {
	if len(path) == 0 {
		return fmt.Errorf("empty field path")
	}
	if len(path) == 1 {
		env[path[0]] = value
		return nil
	}

	head, rest := path[0], path[1:]
	existing, ok := env[head]
	if !ok {
		next := make(map[string]any)
		env[head] = next
		return setNestedField(next, rest, value)
	}
	next, ok := existing.(map[string]any)
	if !ok {
		next = make(map[string]any)
		env[head] = next
	}
	return setNestedField(next, rest, value)
}
