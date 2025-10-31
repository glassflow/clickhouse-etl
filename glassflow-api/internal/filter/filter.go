package filter

import (
	"fmt"

	"github.com/expr-lang/expr"
	"github.com/expr-lang/expr/vm"
)

type Filter struct {
	Expression         string
	CompiledExpression *vm.Program
}

func New(expression string) (*Filter, error) {
	expressionExecutor, err := expr.Compile(expression)
	if err != nil {
		return nil, fmt.Errorf("compiling expression: %w", err)
	}

	return &Filter{
		Expression:         expression,
		CompiledExpression: expressionExecutor,
	}, nil
}

func (f *Filter) Satisfies(jsonData []byte) (bool, error) {
	result, err := expr.Run(f.CompiledExpression, jsonData)
	if err != nil {
		return false, fmt.Errorf("evaluating expression: %w", err)
	}
	if _, ok := result.(bool); !ok {
		return false, fmt.Errorf("invalid expression")
	}

	return result.(bool), nil
}
