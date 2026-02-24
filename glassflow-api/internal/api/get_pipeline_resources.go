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

// PipelineResourcesImmutableFields lists the resource field paths that cannot be changed after pipeline creation.
// format RFC6901 JSON Pointer
var PipelineResourcesImmutableFields = []string{
	"nats/stream/maxAge",
	"nats/stream/maxBytes",
	"transform/storage/size",
	"join/replicas",
}

func GetPipelineResourcesDocs() huma.Operation {
	return huma.Operation{
		OperationID: "get-pipeline-resources",
		Method:      http.MethodGet,
		Summary:     "Get pipeline resources",
		Description: "Returns resource configuration and field immutability policy for a pipeline",
	}
}

type GetPipelineResourcesInput struct {
	ID string `path:"id" minLength:"1" doc:"Pipeline ID"`
}

type pipelineResourcesBody struct {
	PipelineResources models.PipelineResources `json:"pipeline_resources"`
	FieldsPolicy      FieldsPolicy             `json:"fields_policy"`
}

type FieldsPolicy struct {
	Immutable []string `json:"immutable"`
}

type GetPipelineResourcesResponse struct {
	Body pipelineResourcesBody
}

func (h *handler) getPipelineResources(ctx context.Context, input *GetPipelineResourcesInput) (*GetPipelineResourcesResponse, error) {
	row, err := h.pipelineService.GetPipelineResources(ctx, input.ID)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrPipelineNotExists):
			return nil, &ErrorDetail{
				Status:  http.StatusNotFound,
				Code:    "not_found",
				Message: fmt.Sprintf("resources for pipeline %q not found", input.ID),
				Details: map[string]any{
					"pipeline_id": input.ID,
				},
			}
		default:
			return nil, &ErrorDetail{
				Status:  http.StatusInternalServerError,
				Code:    "internal_error",
				Message: "Unable to load pipeline resources",
				Details: map[string]any{
					"pipeline_id": input.ID,
					"error":       err.Error(),
				},
			}
		}
	}

	return &GetPipelineResourcesResponse{
		Body: pipelineResourcesBody{
			PipelineResources: row.Resources,
			FieldsPolicy: FieldsPolicy{
				Immutable: PipelineResourcesImmutableFields,
			},
		},
	}, nil
}
