package api

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
)

func ValidatePipelineDocs() huma.Operation {
	return huma.Operation{
		OperationID: "validate-pipeline",
		Method:      http.MethodPost,
		Summary:     "Validate pipeline configuration",
		Description: "Validates a pipeline JSON without creating it. Runs the same validations as the create pipeline endpoint (schema, sink, source, join, filter, etc.) and returns success or validation errors.",
	}
}

type ValidatePipelineInput struct {
	Body pipelineJSON `json:"body"`
}

type ValidatePipelineResponse struct {
	Body struct{} `json:"-"`
}

func (h *handler) validatePipeline(ctx context.Context, input *ValidatePipelineInput) (*ValidatePipelineResponse, error) {
	_, err := input.Body.toModel()
	if err != nil {
		return nil, &ErrorDetail{
			Status:  http.StatusUnprocessableEntity,
			Code:    "unprocessable_entity",
			Message: "failed to convert request to pipeline model",
			Details: map[string]any{
				"error": err.Error(),
			},
		}
	}

	return &ValidatePipelineResponse{}, nil
}
