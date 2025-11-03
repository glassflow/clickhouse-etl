package json

import (
	"encoding/json"
	"fmt"

	"github.com/expr-lang/expr"
	"github.com/expr-lang/expr/vm"
)

type Filter struct {
	Enabled            bool
	Expression         string
	CompiledExpression *vm.Program
}

func New(expression string, filterEnabled bool) (*Filter, error) {
	var compiledExpression *vm.Program

	if filterEnabled {
		var err error
		compiledExpression, err = expr.Compile(expression)
		if err != nil {
			return nil, fmt.Errorf("compiling expression: %w", err)
		}
	}

	return &Filter{
		Expression:         expression,
		CompiledExpression: compiledExpression,
		Enabled:            filterEnabled,
	}, nil
}

func (filter *Filter) Matches(jsonData []byte) (bool, error) {
	if !filter.Enabled {
		return false, nil
	}
	exprEnv := make(map[string]interface{})
	err := json.Unmarshal(jsonData, &exprEnv)
	if err != nil {
		return false, fmt.Errorf("unmarshal json: %w", err)
	}

	result, err := expr.Run(filter.CompiledExpression, exprEnv)
	if err != nil {
		return false, fmt.Errorf("evaluating expression: %w", err)
	}
	if _, ok := result.(bool); !ok {
		return false, fmt.Errorf("invalid expression")
	}

	return result.(bool), nil
}
