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

func GetOTLPConfigDocs() huma.Operation {
	return huma.Operation{
		OperationID: "get-otlp-config",
		Method:      http.MethodGet,
		Summary:     "Get OTLP config",
		Description: "Returns OTLP routing configuration and status for a pipeline",
	}
}

type GetOTLPConfigInput struct {
	ID string `path:"id" minLength:"1" doc:"Pipeline ID"`
}

type GetOTLPConfigResponse struct {
	Body models.OTLPConfig
}

func (h *handler) getOTLPConfig(ctx context.Context, input *GetOTLPConfigInput) (*GetOTLPConfigResponse, error) {
	pipelineOTLPConfig, err := h.pipelineService.GetOTLPConfig(ctx, input.ID)
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
				Message: "failed to get pipeline",
				Details: map[string]any{
					"pipeline_id": input.ID,
					"error":       err.Error(),
				},
			}
		}
	}

	return &GetOTLPConfigResponse{
		Body: pipelineOTLPConfig,
	}, nil
}
