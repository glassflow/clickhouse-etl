package api

import (
	"context"
	"errors"
	"fmt"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/service"
)

func GetPipelineResourcesValidationDocs() huma.Operation {
	return huma.Operation{
		OperationID: "get-pipeline-resources-validation",
		Method:      http.MethodGet,
		Summary:     "Get pipeline resources validation rules",
		Description: "Returns field immutability policy for pipeline resource configuration",
	}
}

type GetPipelineResourcesValidationInput struct {
	ID string `path:"id" minLength:"1" doc:"Pipeline ID"`
}

type pipelineResourcesValidationBody struct {
	FieldsPolicy FieldsPolicy `json:"fields_policy"`
}

type GetPipelineResourcesValidationResponse struct {
	Body pipelineResourcesValidationBody
}

func (h *handler) getPipelineResourcesValidation(ctx context.Context, input *GetPipelineResourcesValidationInput) (*GetPipelineResourcesValidationResponse, error) {
	immutable, err := h.pipelineService.GetPipelineResourcesValidation(ctx, input.ID)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrPipelineNotExists):
			return nil, &ErrorDetail{
				Status:  http.StatusNotFound,
				Code:    "not_found",
				Message: fmt.Sprintf("pipeline %q not found", input.ID),
				Details: map[string]any{"pipeline_id": input.ID},
			}
		default:
			return nil, &ErrorDetail{
				Status:  http.StatusInternalServerError,
				Code:    "internal_error",
				Message: "unable to load pipeline resources validation",
				Details: map[string]any{"pipeline_id": input.ID, "error": err.Error()},
			}
		}
	}

	return &GetPipelineResourcesValidationResponse{
		Body: pipelineResourcesValidationBody{
			FieldsPolicy: FieldsPolicy{
				Immutable: immutable,
			},
		},
	}, nil
}
