package json

import (
	"encoding/json"
	"fmt"

	"github.com/expr-lang/expr"
	"github.com/expr-lang/expr/vm"
)

type Filter struct {
	Expression         string
	CompiledExpression *vm.Program
}

func New(expression string) (*Filter, error) {
	compiledExpression, err := expr.Compile(expression)
	if err != nil {
		return nil, fmt.Errorf("compiling expression: %w", err)
	}

	return &Filter{
		Expression:         expression,
		CompiledExpression: compiledExpression,
	}, nil
}

func (f *Filter) Matches(jsonData []byte) (bool, error) {
	exprEnv := make(map[string]interface{})
	err := json.Unmarshal(jsonData, &exprEnv)
	if err != nil {
		return false, fmt.Errorf("unmarshal json: %w", err)
	}

	result, err := expr.Run(f.CompiledExpression, exprEnv)
	if err != nil {
		return false, fmt.Errorf("evaluating expression: %w", err)
	}
	if _, ok := result.(bool); !ok {
		return false, fmt.Errorf("invalid expression")
	}

	return result.(bool), nil
}
