package api

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

func GetDLQStateDocs() huma.Operation {
	return huma.Operation{
		OperationID: "get-pipeline-dlq-state",
		Method:      http.MethodGet,
		Summary:     "Get DLQ state for a pipeline",
		Description: "Retrieves the state of the Dead Letter Queue for the specified pipeline, including message counts and timestamps",
	}
}

type GetDLQStateInput struct {
	ID string `path:"id" minLength:"1" doc:"Pipeline ID"`
}

type GetDLQStateResponse struct {
	Body DLQStateInfo
}

type DLQStateInfo struct {
	LastReceivedAt     *time.Time `json:"last_received_at" doc:"Timestamp of the last message received in the DLQ"`
	LastConsumedAt     *time.Time `json:"last_consumed_at" doc:"Timestamp of the last message consumed from the DLQ"`
	TotalMessages      uint64     `json:"total_messages" doc:"Total number of messages ever added to the DLQ"`
	UnconsumedMessages uint64     `json:"unconsumed_messages" doc:"Number of messages currently in the DLQ"`
}

func (h *handler) getDLQState(ctx context.Context, input *GetDLQStateInput) (*GetDLQStateResponse, error) {
	dlqStream := models.GetDLQStreamName(input.ID)

	state, err := h.dlqSvc.GetDLQState(ctx, dlqStream)
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
				Message: "DLQ state fetch failed",
				Details: map[string]any{
					"pipeline_id": input.ID,
					"error":       err.Error(),
				},
			}
		}
	}

	res := DLQStateInfo{
		LastReceivedAt:     state.LastReceivedAt,
		LastConsumedAt:     state.LastConsumedAt,
		TotalMessages:      state.TotalMessages,
		UnconsumedMessages: state.UnconsumedMessages,
	}

	return &GetDLQStateResponse{Body: res}, nil
}
