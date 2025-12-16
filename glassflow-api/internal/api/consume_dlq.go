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

func ConsumeDLQDocs() huma.Operation {
	return huma.Operation{
		OperationID: "consume-pipeline-dlq",
		Method:      http.MethodGet,
		Summary:     "Consume DLQ messages for a pipeline",
		Description: "Fetches messages from the Dead Letter Queue for the specified pipeline",
	}
}

type ConsumeDLQInput struct {
	ID        string `path:"id" minLength:"1" doc:"Pipeline ID"`
	BatchSize int    `query:"batch_size" minimum:"1" maximum:"1000" doc:"Number of messages to consume (default: 1000)"`
}

type ConsumeDLQResponse struct {
	Body []DLQConsumeMessage
}

type DLQConsumeMessage struct {
	Component       string `json:"component" doc:"The component where the error occurred"`
	Error           string `json:"error" doc:"The error message"`
	OriginalMessage string `json:"original_message" doc:"The original message that failed processing"`
}

func (h *handler) consumeDLQ(ctx context.Context, input *ConsumeDLQInput) (*ConsumeDLQResponse, error) {
	dlqBatch, err := models.NewDLQBatchSize(input.BatchSize)
	if err != nil {
		return nil, &ErrorDetail{
			Status:  http.StatusUnprocessableEntity,
			Code:    "unprocessable_entity",
			Message: fmt.Sprintf("batch size cannot be greater than %d", internal.DLQMaxBatchSize),
			Details: map[string]any{
				"batch_size": input.BatchSize,
				"error":      err.Error(),
			},
		}
	}

	dlqStream := models.GetDLQStreamName(input.ID)
	msgs, err := h.dlqSvc.FetchDLQMessages(ctx, dlqStream, dlqBatch.Int)
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
		case errors.Is(err, internal.ErrNoMessagesInDLQ):
			return nil, nil
		default:
			return nil, &ErrorDetail{
				Status:  http.StatusInternalServerError,
				Code:    "internal_error",
				Message: "Consuming DLQ failed",
				Details: map[string]any{
					"pipeline_id": input.ID,
					"error":       err.Error(),
				},
			}
		}
	}

	dlqMsgsRes := make([]DLQConsumeMessage, 0, len(msgs))
	for _, msg := range msgs {
		dlqMsgsRes = append(dlqMsgsRes, DLQConsumeMessage{
			Component:       msg.Component,
			Error:           msg.Error,
			OriginalMessage: msg.OriginalMessage.String(),
		})
	}

	return &ConsumeDLQResponse{Body: dlqMsgsRes}, nil
}
