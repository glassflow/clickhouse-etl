package api

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/filter"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

func ValidateFilterDocs() huma.Operation {
	return huma.Operation{
		OperationID: "validate-filter-expression",
		Method:      http.MethodPost,
		Summary:     "Validate filter expression",
		Description: "Validates a filter expression against provided fields",
	}
}

type ValidateFilterInput struct {
	Body struct {
		Expression string                   `json:"expression" minLength:"1" doc:"Filter expression to validate"`
		Fields     []models.StreamDataField `json:"fields" doc:"schema for validation"`
	}
}

type ValidateFilterResponse struct {
	Body struct{} `json:"-"`
}

func (h *handler) validateFilter(
	_ context.Context,
	input *ValidateFilterInput,
) (*ValidateFilterResponse, error) {
	err := filter.ValidateFilterExpression(input.Body.Expression, input.Body.Fields)
	if err != nil {
		return nil, &ErrorDetail{
			Status:  http.StatusBadRequest,
			Code:    "validation_error",
			Message: "Filter expression validation failed",
			Details: map[string]any{
				"error": err.Error(),
			},
		}
	}

	return &ValidateFilterResponse{}, nil
}
