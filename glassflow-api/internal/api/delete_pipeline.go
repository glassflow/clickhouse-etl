package api

import (
	"context"
	"errors"
	"fmt"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/service"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/status"
)

func DeletePipelineDocs() huma.Operation {
	return huma.Operation{
		OperationID: "delete-pipeline",
		Method:      http.MethodDelete,
		Summary:     "Delete a pipeline",
		Description: "Deletes an existing pipeline. Pipeline must be in stopped or failed status.",
	}
}

type DeletePipelineInput struct {
	ID string `path:"id" minLength:"1" doc:"Pipeline ID"`
}

type DeletePipelineResponse struct {
	Body struct{} `json:"-"`
}

func (h *handler) deletePipeline(ctx context.Context, input *DeletePipelineInput) (*DeletePipelineResponse, error) {
	// Get the pipeline to check its status
	pipeline, err := h.pipelineService.GetPipeline(ctx, input.ID)
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
				Message: "failed to get pipeline for deletion",
				Details: map[string]any{
					"pipeline_id": input.ID,
					"error":       err.Error(),
				},
			}
		}
	}

	// Check if pipeline is in a deletable state (stopped)
	currentStatus := string(pipeline.Status.OverallStatus)
	if currentStatus != internal.PipelineStatusStopped && currentStatus != internal.PipelineStatusFailed {
		return nil, &ErrorDetail{
			Status:  http.StatusBadRequest,
			Code:    "bad_request",
			Message: fmt.Sprintf("pipeline can only be deleted if it's stopped, current status: %s", currentStatus),
			Details: map[string]any{
				"pipeline_id":    input.ID,
				"current_status": currentStatus,
			},
		}
	}

	err = h.pipelineService.DeletePipeline(ctx, input.ID)
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
				Message: "failed to delete pipeline",
				Details: map[string]any{
					"pipeline_id": input.ID,
					"error":       err.Error(),
				},
			}
		}
	}

	h.log.InfoContext(ctx, "pipeline deleted")

	return &DeletePipelineResponse{}, nil
}
