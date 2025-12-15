package api

import (
	"context"
	"errors"
	"fmt"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/service"
)

func UpdatePipelineNameDocs() huma.Operation {
	return huma.Operation{
		OperationID: "update-pipeline-name",
		Method:      http.MethodPatch,
		Summary:     "Update pipeline name",
		Description: "Updates the name of an existing pipeline",
	}
}

type UpdatePipelineNameInput struct {
	ID   string `path:"id" minLength:"1" doc:"Pipeline ID"`
	Body struct {
		Name string `json:"name" doc:"New pipeline name"`
	}
}

type UpdatePipelineNameResponse struct {
	Body struct{} `json:"-"`
}

func (h *handler) updatePipelineName(ctx context.Context, input *UpdatePipelineNameInput) (*UpdatePipelineNameResponse, error) {
	err := h.pipelineService.UpdatePipelineName(ctx, input.ID, input.Body.Name)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrPipelineNotExists):
			return nil, &ErrorDetail{
				Status:  http.StatusNotFound,
				Code:    "not_found",
				Message: fmt.Sprintf("pipeline with id %q does not exist", input.ID),
				Details: map[string]any{
					"pipeline_id": input.ID,
					"error":       err.Error(),
				},
			}
		default:
			return nil, &ErrorDetail{
				Status:  http.StatusInternalServerError,
				Code:    "internal_error",
				Message: "failed to update pipeline name",
				Details: map[string]any{
					"pipeline_id": input.ID,
					"error":       err.Error(),
				},
			}
		}
	}

	return &UpdatePipelineNameResponse{}, nil
}
