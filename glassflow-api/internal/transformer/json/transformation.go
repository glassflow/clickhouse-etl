package json

import (
	"encoding/json"
	"fmt"

	"github.com/expr-lang/expr"
	"github.com/expr-lang/expr/vm"
	"github.com/spf13/cast"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

type Transformer struct {
	Transformations     []models.Transform
	compiledExpressions []*vm.Program
}

// NewTransformer creates a new Transformer and compiles all expressions
func NewTransformer(transformations []models.Transform) (*Transformer, error) {
	compiledExpressions := make([]*vm.Program, len(transformations))
	for i, transformation := range transformations {
		program, err := expr.Compile(
			transformation.Expression,
			expr.Function("parseQuery", parseQueryString),
			expr.Function("getQueryParam", getQueryParam),
			expr.Function("getNestedParam", getNestedParam),
			expr.Function("parseISO8601", parseISO8601),
			expr.Function("toDate", toDate),
			expr.Function("urlDecode", urlDecode),
			expr.Function("toString", toString),
			expr.Function("containsStr", containsStr),
			expr.Function("hasPrefix", hasPrefix),
			expr.Function("hasSuffix", hasSuffix),
			expr.Function("upper", upper),
			expr.Function("lower", lower),
			expr.Function("trim", trimSpaces),
			expr.Function("split", splitStr),
			expr.Function("join", join),
			expr.Function("replace", replace),
			expr.Function("toInt", toInt),
			expr.Function("toFloat", toFloat),
			expr.Function("parseUserAgent", parseUserAgent),
			expr.Function("waterfall", waterfall),
			expr.Function("extractPathType", extractPathType),
			expr.Function("hasKeyPrefix", hasKeyPrefix),
			expr.Function("hasAnyKey", hasAnyKey),
			expr.Function("keys", keys),
		)
		if err != nil {
			return nil, fmt.Errorf("compile transformation %d expression: %w", i, err)
		}
		compiledExpressions[i] = program
	}

	return &Transformer{
		Transformations:     transformations,
		compiledExpressions: compiledExpressions,
	}, nil
}

// Transform applies transformations to input bytes and returns transformed bytes
func (t *Transformer) Transform(inputBytes []byte) ([]byte, error) {
	if len(t.compiledExpressions) == 0 {
		return inputBytes, nil
	}
	var inputData map[string]any
	if err := json.Unmarshal(inputBytes, &inputData); err != nil {
		return nil, fmt.Errorf("unmarshal input data: %w", err)
	}

	outputData := make(map[string]any)
	for i, transformation := range t.Transformations {
		result, err := expr.Run(t.compiledExpressions[i], inputData)
		if err != nil {
			return nil, fmt.Errorf("run transformation %d: %w", i, err)
		}

		convertedValue, err := convertType(result, transformation.OutputType)
		if err != nil {
			return nil, fmt.Errorf("convert result for column %s: %w", transformation.OutputName, err)
		}

		outputData[transformation.OutputName] = convertedValue
	}

	outputBytes, err := json.Marshal(outputData)
	if err != nil {
		return nil, fmt.Errorf("marshal output data: %w", err)
	}

	return outputBytes, nil
}

func convertType(value any, targetType string) (any, error) {
	switch targetType {
	case "string":
		return cast.ToStringE(value)
	case "int":
		return cast.ToIntE(value)
	case "int64":
		return cast.ToInt64E(value)
	case "float64":
		return cast.ToFloat64E(value)
	case "bool":
		return cast.ToBoolE(value)
	case "[]string":
		// Already a []string, return as-is
		if slice, ok := value.([]string); ok {
			return slice, nil
		}
		return value, nil
	default:
		return value, nil
	}
}
