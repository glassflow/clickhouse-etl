package api

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/transformer"
)

func EvaluateTransformDocs() huma.Operation {
	return huma.Operation{
		OperationID: "evaluate-transformation-expression",
		Method:      http.MethodPost,
		Summary:     "Evaluate transformation expression",
		Description: "Evaluates transformation expressions against provided sample data",
	}
}

type EvaluateTransformInput struct {
	Body EvaluateTransformInputBody
}

type EvaluateTransformInputBody struct {
	Type   string                                `json:"type" minLength:"1" doc:"Transformation type (expr_lang_transform)"`
	Config models.StatelessTransformationsConfig `json:"config"`
	// sample will have everything we need, I think for now we can skip fields
	//Fields []models.StreamDataField              `json:"fields" doc:"Schema for validation"`
	Sample json.RawMessage `json:"sample" doc:"Sample data to evaluate expressions against"`
}

type EvaluateTransformResponse struct {
	Body json.RawMessage
}

func (h *handler) evaluateTransform(
	ctx context.Context,
	input *EvaluateTransformInput,
) (*EvaluateTransformResponse, error) {
	// Validate transformation type
	if input.Body.Type != "expr_lang_transform" {
		return nil, &ErrorDetail{
			Status:  http.StatusBadRequest,
			Code:    "invalid_transformation_type",
			Message: "Invalid transformation type",
			Details: map[string]any{
				"error": "only expr_lang_transform is supported",
			},
		}
	}

	// Evaluate transformations using transformer package
	resultJSON, err := transformer.Evaluate(ctx, input.Body.Config.Transform, input.Body.Sample)
	if err != nil {
		return nil, &ErrorDetail{
			Status:  http.StatusBadRequest,
			Code:    "transformation_error",
			Message: "Failed to evaluate transformation",
			Details: map[string]any{
				"error": err.Error(),
			},
		}
	}

	return &EvaluateTransformResponse{Body: resultJSON}, nil
}
