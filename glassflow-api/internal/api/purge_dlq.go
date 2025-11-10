package api

import (
	"context"
	"errors"
	"fmt"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

func PurgeDLQDocs() huma.Operation {
	return huma.Operation{
		OperationID: "purge-pipeline-dlq",
		Method:      http.MethodPost,
		Summary:     "Purge DLQ for a pipeline",
		Description: "Purges all messages from the Dead Letter Queue for the specified pipeline",
	}
}

type PurgeDLQInput struct {
	ID string `path:"id" minLength:"1" doc:"Pipeline ID"`
}

type PurgeDLQResponse struct {
	Body struct{} `json:"-"`
}

func (h *handler) purgeDLQ(ctx context.Context, input *PurgeDLQInput) (*PurgeDLQResponse, error) {
	dlqStream := models.GetDLQStreamName(input.ID)
	err := h.dlqSvc.PurgeDLQ(ctx, dlqStream)
	if err != nil {
		switch {
		case errors.Is(err, internal.ErrDLQNotExists):
			return nil, &ErrorDetail{
				Status:  http.StatusNotFound,
				Code:    "not_found",
				Message: fmt.Sprintf("dlq for pipeline_id %q does not exist", input.ID),
				Details: map[string]any{
					"pipeline_id": input.ID,
				},
			}
		default:
			return nil, &ErrorDetail{
				Status:  http.StatusInternalServerError,
				Code:    "internal_error",
				Message: "DLQ purge failed",
				Details: map[string]any{
					"pipeline_id": input.ID,
					"error":       err.Error(),
				},
			}
		}
	}

	return &PurgeDLQResponse{}, nil
}
