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

func CreatePipelineDocs() huma.Operation {
	return huma.Operation{
		OperationID: "create-pipeline",
		Method:      http.MethodPost,
		Summary:     "Create a new pipeline",
		Description: "Creates a new pipeline",
	}
}

type CreatePipelineInput struct {
	Body pipelineJSON `json:"body"`
}

type CreatePipelineResponse struct {
	Body struct{} `json:"-"`
}

func (h *handler) createPipeline(ctx context.Context, input *CreatePipelineInput) (*CreatePipelineResponse, error) {
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

	err = h.pipelineService.CreatePipeline(ctx, &pipeline)
	if err != nil {
		var pErr models.PipelineConfigError
		switch {
		case errors.Is(err, service.ErrPipelineQuotaReached), errors.Is(err, service.ErrIDExists):
			return nil, &ErrorDetail{
				Status:  http.StatusForbidden,
				Code:    "forbidden",
				Message: "pipeline creation failed, only single pipeline in docker allowed",
				Details: map[string]any{
					"pipeline_id": pipeline.ID,
					"error":       err.Error(),
				},
			}
		case errors.As(err, &pErr):
			return nil, &ErrorDetail{
				Status:  http.StatusUnprocessableEntity,
				Code:    "unprocessable_entity",
				Message: "pipeline creation failed due to configuration error",
				Details: map[string]any{
					"error": err.Error(),
				},
			}
		default:
			return nil, &ErrorDetail{
				Status:  http.StatusInternalServerError,
				Code:    "internal_error",
				Message: fmt.Sprintf("failed to create pipeline %q", pipeline.ID),
				Details: map[string]any{
					"pipeline_id": pipeline.ID,
					"error":       err.Error(),
				},
			}
		}
	}

	return &CreatePipelineResponse{}, nil
}
