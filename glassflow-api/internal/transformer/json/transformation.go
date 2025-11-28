package json

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/expr-lang/expr"
	"github.com/expr-lang/expr/vm"
	"github.com/spf13/cast"
)

type TransformationConfig struct {
	Expr         string `json:"expr"`
	OutputColumn string `json:"output_column"`
	Type         string `json:"type"`
}

type Transformer struct {
	Transformations     []TransformationConfig
	compiledExpressions []*vm.Program
}

// NewTransformer creates a new Transformer and compiles all expressions
func NewTransformer(transformations []TransformationConfig) (*Transformer, error) {
	compiledExpressions := make([]*vm.Program, len(transformations))
	for i, transformation := range transformations {
		program, err := expr.Compile(transformation.Expr, expr.Function("concat", concat))
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

		convertedValue, err := convertType(result, transformation.Type)
		if err != nil {
			return nil, fmt.Errorf("convert result for column %s: %w", transformation.OutputColumn, err)
		}

		outputData[transformation.OutputColumn] = convertedValue
	}

	outputBytes, err := json.Marshal(outputData)
	if err != nil {
		return nil, fmt.Errorf("marshal output data: %w", err)
	}

	return outputBytes, nil
}

// concat is a helper function for concatenating strings in expressions
func concat(args ...any) (any, error) {
	var builder strings.Builder
	for _, arg := range args {
		builder.WriteString(fmt.Sprint(arg))
	}
	return builder.String(), nil
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
	default:
		return value, nil
	}
}
