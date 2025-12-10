package transformer

import (
	"fmt"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/transformer/json"
)

// Evaluate evaluates transformation expressions against sample data
// Takes raw JSON bytes as input and returns transformed JSON bytes
func Evaluate(transformations []models.Transform, sampleJSON []byte) ([]byte, error) {
	transformer, err := json.NewTransformer(transformations)
	if err != nil {
		return nil, fmt.Errorf("compile transformations: %w", err)
	}

	resultBytes, err := transformer.Transform(sampleJSON)
	if err != nil {
		return nil, fmt.Errorf("execute transformation: %w", err)
	}

	return resultBytes, nil
}
