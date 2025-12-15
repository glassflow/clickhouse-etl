package api

import (
	"context"
	"errors"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/service"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/status"
)

func ResumePipelineDocs() huma.Operation {
	return huma.Operation{
		OperationID: "resume-pipeline",
		Method:      http.MethodPost,
		Summary:     "Resume a pipeline",
		Description: "Resumes a paused or stopped pipeline",
	}
}

type ResumePipelineInput struct {
	ID string `path:"id" minLength:"1" doc:"Pipeline ID"`
}

type ResumePipelineResponse struct {
	Body struct{} `json:"-"`
}

func (h *handler) resumePipeline(ctx context.Context, input *ResumePipelineInput) (*ResumePipelineResponse, error) {
	err := h.pipelineService.ResumePipeline(ctx, input.ID)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrPipelineNotExists):
			return nil, &ErrorDetail{
				Status:  http.StatusNotFound,
				Code:    "not_found",
				Message: "no pipeline with given id to resume",
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
				Message: "failed to resume pipeline",
				Details: map[string]any{
					"pipeline_id": input.ID,
					"error":       err.Error(),
				},
			}
		}
	}

	h.log.InfoContext(ctx, "pipeline resumed", "pipeline_id", input.ID)

	return &ResumePipelineResponse{}, nil
}
