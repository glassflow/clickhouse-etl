package api

import (
	"context"
	"errors"
	"fmt"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/service"
)

func GetPipelineDocs() huma.Operation {
	return huma.Operation{
		OperationID: "get-pipeline",
		Method:      http.MethodGet,
		Summary:     "Get pipeline",
		Description: "Returns the configuration of a specific pipeline",
	}
}

type GetPipelineInput struct {
	ID string `path:"id" minLength:"1" doc:"Pipeline ID"`
}

type GetPipelineResponse struct {
	Body pipelineJSON
}

func (h *handler) getPipeline(ctx context.Context, input *GetPipelineInput) (*GetPipelineResponse, error) {
	p, err := h.pipelineService.GetPipeline(ctx, input.ID)
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
				Message: "Unable to load pipeline",
				Details: map[string]any{
					"pipeline_id": input.ID,
					"error":       err.Error(),
				},
			}
		}
	}

	return &GetPipelineResponse{Body: toPipelineJSON(p)}, nil
}
