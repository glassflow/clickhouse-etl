package api

import (
	"context"
	"errors"
	"fmt"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/service"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/status"
)

func EditPipelineDocs() huma.Operation {
	return huma.Operation{
		OperationID: "edit-pipeline",
		Method:      http.MethodPost,
		Summary:     "Edit a pipeline",
		Description: "Edits an existing pipeline configuration",
	}
}

type EditPipelineInput struct {
	ID   string       `path:"id" minLength:"1" doc:"Pipeline ID"`
	Body pipelineJSON `json:"body"`
}

type EditPipelineResponse struct {
	Body struct{} `json:"-"`
}

func (h *handler) editPipeline(ctx context.Context, input *EditPipelineInput) (*EditPipelineResponse, error) {
	// Validate that pipeline_id in JSON matches the route parameter
	if input.Body.PipelineID != input.ID {
		return nil, &ErrorDetail{
			Status:  http.StatusBadRequest,
			Code:    "bad_request",
			Message: "pipeline ID in request body must match the route parameter",
			Details: map[string]any{
				"route_id": input.ID,
				"json_id":  input.Body.PipelineID,
			},
		}
	}

	pipeline, err := input.Body.toModel()
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

	err = h.pipelineService.EditPipeline(ctx, input.ID, &pipeline)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrPipelineNotExists):
			return nil, &ErrorDetail{
				Status:  http.StatusNotFound,
				Code:    "not_found",
				Message: fmt.Sprintf("no pipeline with id %q to edit", input.ID),
				Details: map[string]any{
					"pipeline_id": input.ID,
					"error":       err.Error(),
				},
			}
		case errors.Is(err, service.ErrNotImplemented):
			return nil, &ErrorDetail{
				Status:  http.StatusNotImplemented,
				Code:    "not_implemented",
				Message: "feature not implemented for this version",
				Details: map[string]any{
					"pipeline_id": input.ID,
					"error":       err.Error(),
				},
			}
		default:
			// Check if it's a status validation error
			if statusErr, ok := status.GetStatusValidationError(err); ok {
				details := map[string]any{
					"pipeline_id":      input.ID,
					"current_status":   string(statusErr.CurrentStatus),
					"requested_status": string(statusErr.RequestedStatus),
					"error":            err.Error(),
				}
				if len(statusErr.ValidTransitions) > 0 {
					validTransitions := make([]string, len(statusErr.ValidTransitions))
					for i, transition := range statusErr.ValidTransitions {
						validTransitions[i] = string(transition)
					}
					details["valid_transitions"] = validTransitions
				}
				return nil, &ErrorDetail{
					Status:  statusErr.HTTPStatus(),
					Code:    statusErr.Code,
					Message: statusErr.Message,
					Details: details,
				}
			}
			return nil, &ErrorDetail{
				Status:  http.StatusInternalServerError,
				Code:    "internal_error",
				Message: fmt.Sprintf("failed to edit pipeline %q", input.ID),
				Details: map[string]any{
					"pipeline_id": input.ID,
					"error":       err.Error(),
				},
			}
		}
	}

	return &EditPipelineResponse{}, nil
}
