package transformer

import (
	"context"
	"fmt"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/transformer/json"
)

// Evaluate evaluates transformation expressions against sample data
// Takes raw JSON bytes as input and returns transformed JSON bytes
func Evaluate(ctx context.Context, transformations []models.Transform, sampleJSON []byte) ([]byte, error) {
	transformer, err := json.NewTransformer(transformations)
	if err != nil {
		return nil, fmt.Errorf("compile transformations: %w", err)
	}

	resultMessage, err := transformer.Transform(ctx, models.NewNatsMessage(sampleJSON, nil))
	if err != nil {
		return nil, fmt.Errorf("execute transformation: %w", err)
	}

	return resultMessage.Payload(), nil
}
