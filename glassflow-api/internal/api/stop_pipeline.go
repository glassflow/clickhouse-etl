package api

import (
	"context"
	"errors"
	"log/slog"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/service"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/status"
)

func StopPipelineDocs() huma.Operation {
	return huma.Operation{
		OperationID: "stop-pipeline",
		Method:      http.MethodPost,
		Summary:     "Stop a pipeline",
		Description: "Stops the pipeline",
	}
}

type StopPipelineInput struct {
	ID string `path:"id" minLength:"1" doc:"Pipeline ID"`
}

type StopPipelineResponse struct {
	Body struct{} `json:"-"`
}

func (h *handler) stopPipeline(ctx context.Context, input *StopPipelineInput) (*StopPipelineResponse, error) {
	err := h.pipelineService.StopPipeline(ctx, input.ID)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrPipelineNotExists):
			return nil, &ErrorDetail{
				Status:  http.StatusNotFound,
				Code:    "not_found",
				Message: "no active pipeline with given id to stop",
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
			if statusErr, ok := status.GetStatusValidationError(err); ok {
				return nil, &ErrorDetail{
					Status:  statusErr.HTTPStatus(),
					Code:    statusErr.ErrorCode(),
					Message: statusErr.Message,
					Details: map[string]any{
						"pipeline_id":       input.ID,
						"current_status":    statusErr.CurrentStatus,
						"requested_status":  statusErr.RequestedStatus,
						"valid_transitions": statusErr.ValidTransitions,
						"error":             err.Error(),
					},
				}
			}
			return nil, &ErrorDetail{
				Status:  http.StatusInternalServerError,
				Code:    "internal_error",
				Message: "failed to stop pipeline",
				Details: map[string]any{
					"pipeline_id": input.ID,
					"error":       err.Error(),
				},
			}
		}
	}

	h.log.InfoContext(ctx, "pipeline stop", slog.String("pipeline_id", input.ID))

	return &StopPipelineResponse{}, nil
}
