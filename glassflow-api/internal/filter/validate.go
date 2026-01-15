package filter

import (
	"encoding/json"
	"fmt"

	"github.com/expr-lang/expr"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/schema"
	"github.com/tidwall/sjson"
)

func ValidateFilterExpression(expression string, fields []models.StreamDataField) error {
	if expression == "" {
		return fmt.Errorf("empty expression")
	}

	jsonInput := ""
	for _, field := range fields {
		normalizedType := internal.NormalizeToBasicKafkaType(field.FieldType)
		defaultTypeValue, err := schema.GetDefaultValueForKafkaType(schema.KafkaDataType(normalizedType))
		if err != nil {
			return fmt.Errorf("get default value for field %s: %w", field.FieldType, err)
		}

		jsonInput, err = sjson.Set(jsonInput, field.FieldName, defaultTypeValue)
		if err != nil {
			return fmt.Errorf("failed to set field")
		}
	}
	exprEnv := make(map[string]interface{})
	err := json.Unmarshal([]byte(jsonInput), &exprEnv)
	if err != nil {
		return fmt.Errorf("unmarshal json: %w", err)
	}

	compiledExecutor, err := expr.Compile(expression, expr.Env(exprEnv))
	if err != nil {
		return fmt.Errorf("compile expression: %w", err)
	}

	result, err := expr.Run(compiledExecutor, exprEnv)
	if err != nil {
		return fmt.Errorf("eval expression: %w", err)
	}

	if _, ok := result.(bool); !ok {
		return fmt.Errorf("expression evaluated to %t", result)
	}

	return nil
}

// Temporary function to validate filter expression against v2 schema fields
func ValidateFilterExpressionV2(expression string, fields []models.Field) error {
	if expression == "" {
		return fmt.Errorf("empty expression")
	}

	jsonInput := ""
	for _, field := range fields {
		defaultTypeValue, err := schema.GetDefaultValueForKafkaType(schema.KafkaDataType(field.Type))
		if err != nil {
			return fmt.Errorf("get default value for field %s: %w", field.Type, err)
		}

		jsonInput, err = sjson.Set(jsonInput, field.Name, defaultTypeValue)
		if err != nil {
			return fmt.Errorf("failed to set field")
		}
	}
	exprEnv := make(map[string]interface{})
	err := json.Unmarshal([]byte(jsonInput), &exprEnv)
	if err != nil {
		return fmt.Errorf("unmarshal json: %w", err)
	}

	compiledExecutor, err := expr.Compile(expression, expr.Env(exprEnv))
	if err != nil {
		return fmt.Errorf("compile expression: %w", err)
	}

	result, err := expr.Run(compiledExecutor, exprEnv)
	if err != nil {
		return fmt.Errorf("eval expression: %w", err)
	}

	if _, ok := result.(bool); !ok {
		return fmt.Errorf("expression evaluated to %t", result)
	}

	return nil
}
