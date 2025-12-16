package api

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

func GetPipelinesDocs() huma.Operation {
	return huma.Operation{
		OperationID: "get-pipelines",
		Method:      http.MethodGet,
		Summary:     "Get all pipelines",
		Description: "Returns a list of all pipelines",
	}
}

type GetPipelinesInput struct {
}

type GetPipelinesResponse struct {
	Body []models.ListPipelineConfig
}

func (h *handler) getPipelines(ctx context.Context, _ *GetPipelinesInput) (*GetPipelinesResponse, error) {
	pipelines, err := h.pipelineService.GetPipelines(ctx)
	if err != nil {
		return nil, &ErrorDetail{
			Status:  http.StatusInternalServerError,
			Code:    "internal_error",
			Message: "Unable to list pipelines",
			Details: map[string]any{
				"error": err.Error(),
			},
		}
	}

	return &GetPipelinesResponse{Body: pipelines}, nil
}
