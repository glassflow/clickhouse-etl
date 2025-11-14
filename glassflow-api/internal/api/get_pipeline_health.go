package api

import (
	"context"
	"errors"
	"fmt"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/service"
)

func GetPipelineHealthDocs() huma.Operation {
	return huma.Operation{
		OperationID: "get-pipeline-health",
		Method:      http.MethodGet,
		Summary:     "Get pipeline health",
		Description: "Returns the health status of a specific pipeline",
	}
}

type GetPipelineHealthInput struct {
	ID string `path:"id" minLength:"1" doc:"Pipeline ID"`
}

type GetPipelineHealthResponse struct {
	Body models.PipelineHealth
}

func (h *handler) getPipelineHealth(ctx context.Context, input *GetPipelineHealthInput) (*GetPipelineHealthResponse, error) {
	health, err := h.pipelineService.GetPipelineHealth(ctx, input.ID)
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
				Message: "failed to get pipeline health",
				Details: map[string]any{
					"pipeline_id": input.ID,
					"error":       err.Error(),
				},
			}
		}
	}

	return &GetPipelineHealthResponse{Body: health}, nil
}
