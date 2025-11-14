package api

import (
	"context"
	"errors"
	"log/slog"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/service"
)

func UpdatePipelineMetadataDocs() huma.Operation {
	return huma.Operation{
		OperationID: "update-pipeline-metadata",
		Method:      http.MethodPatch,
		Summary:     "Update pipeline metadata",
		Description: "Updates the metadata of a pipeline",
	}
}

type UpdatePipelineMetadataInput struct {
	ID       string                  `path:"id" minLength:"1" doc:"Pipeline ID"`
	Metadata models.PipelineMetadata `json:"metadata"`
}

type UpdatePipelineMetadataResponse struct {
	Body struct{} `json:"-"`
}

func (h *handler) updatePipelineMetadata(ctx context.Context, input *UpdatePipelineMetadataInput) (*UpdatePipelineMetadataResponse, error) {
	err := h.pipelineService.UpdatePipelineMetadata(ctx, input.ID, input.Metadata)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrPipelineNotExists):
			return nil, &ErrorDetail{
				Status:  http.StatusNotFound,
				Code:    "not_found",
				Message: "no pipeline with given id found",
				Details: map[string]any{
					"pipeline_id": input.ID,
					"error":       err.Error(),
				},
			}
		default:
			return nil, &ErrorDetail{
				Status:  http.StatusInternalServerError,
				Code:    "internal_error",
				Message: "failed to update pipeline metadata",
				Details: map[string]any{
					"pipeline_id": input.ID,
					"error":       err.Error(),
				},
			}
		}
	}

	h.log.InfoContext(ctx, "pipeline metadata updated", slog.String("pipeline_id", input.ID))

	return &UpdatePipelineMetadataResponse{}, nil
}
