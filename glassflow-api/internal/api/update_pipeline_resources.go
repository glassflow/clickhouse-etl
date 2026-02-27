package api

import (
	"context"
	"errors"
	"fmt"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/service"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/status"
)

func UpdatePipelineResourcesDocs() huma.Operation {
	return huma.Operation{
		OperationID: "update-pipeline-resources",
		Method:      http.MethodPut,
		Summary:     "Update pipeline resources",
		Description: "Updates resource configuration for a stopped pipeline",
	}
}

type UpdatePipelineResourcesInput struct {
	ID   string `path:"id" minLength:"1" doc:"Pipeline ID"`
	Body struct {
		PipelineResources models.PipelineResources `json:"pipeline_resources"`
	}
}

type UpdatePipelineResourcesResponse struct {
	Body pipelineResourcesBody
}

func (h *handler) updatePipelineResources(ctx context.Context, input *UpdatePipelineResourcesInput) (*UpdatePipelineResourcesResponse, error) {
	newResources := input.Body.PipelineResources

	merged, err := h.pipelineService.UpdatePipelineResources(ctx, input.ID, newResources)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrPipelineNotExists):
			return nil, &ErrorDetail{
				Status:  http.StatusNotFound,
				Code:    "not_found",
				Message: fmt.Sprintf("pipeline %q not found", input.ID),
				Details: map[string]any{"pipeline_id": input.ID},
			}
		case errors.Is(err, service.ErrPipelineResourcesValidation):
			return nil, &ErrorDetail{
				Status:  http.StatusUnprocessableEntity,
				Code:    "unprocessable_entity",
				Message: err.Error(),
			}
		default:
			if statusErr, ok := status.GetStatusValidationError(err); ok {
				return nil, &ErrorDetail{
					Status:  http.StatusConflict,
					Code:    statusErr.Code,
					Message: statusErr.Message,
					Details: map[string]any{
						"pipeline_id":    input.ID,
						"current_status": string(statusErr.CurrentStatus),
					},
				}
			}
			return nil, &ErrorDetail{
				Status:  http.StatusInternalServerError,
				Code:    "internal_error",
				Message: "unable to update pipeline resources",
				Details: map[string]any{"pipeline_id": input.ID, "error": err.Error()},
			}
		}
	}

	return &UpdatePipelineResourcesResponse{
		Body: pipelineResourcesBody{
			PipelineResources: merged,
			FieldsPolicy: FieldsPolicy{
				ImmutableAfterCreate: models.PipelineResourcesImmutableAfterCreate,
				AlwaysImmutable:      models.PipelineResourcesAlwaysImmutable,
			},
		},
	}, nil
}
