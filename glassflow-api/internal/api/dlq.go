package api

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gorilla/mux"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

type DLQ interface {
	FetchDLQMessages(ctx context.Context, stream string, batchSize int) ([]models.DLQMessage, error)
	GetDLQState(ctx context.Context, stream string) (zero models.DLQState, _ error)
	PurgeDLQ(ctx context.Context, stream string) (err error)
}

func (h *handler) consumeDLQ(w http.ResponseWriter, r *http.Request) {
	batchSize, err := strconv.Atoi(r.URL.Query().Get("batch_size"))
	if err != nil || batchSize <= 0 {
		batchSize = internal.DLQDefaultBatchSize
		h.log.Debug("using default: ", slog.Int("batch_size", batchSize))
	}

	dlqBatch, err := models.NewDLQBatchSize(batchSize)
	if err != nil {
		jsonError(w, http.StatusUnprocessableEntity, fmt.Sprintf("batch size cannot be greater than %d", internal.DLQMaxBatchSize), nil)
	}

	params := mux.Vars(r)
	pipelineID, ok := params["id"]
	if !ok {
		h.log.Error("Cannot extract pipeline id", slog.Any("params", params))
		serverError(w)
		return
	}

	if len(strings.TrimSpace(pipelineID)) == 0 {
		jsonError(w, http.StatusUnprocessableEntity, err.Error(), map[string]string{"pipeline_id": pipelineID})
		return
	}

	dlqStream := models.GetDLQStreamName(pipelineID)
	msgs, err := h.dlqSvc.FetchDLQMessages(r.Context(), dlqStream, dlqBatch.Int)
	if err != nil {
		switch {
		case errors.Is(err, internal.ErrDLQNotExists):
			jsonError(w, http.StatusNotFound, "dlq for pipeline does not exist", map[string]string{"pipeline_id": pipelineID})
		case errors.Is(err, internal.ErrNoMessagesInDLQ):
			w.WriteHeader(http.StatusNoContent)
		default:
			h.log.Error("Consuming DLQ failed", slog.String("pipeline_id", pipelineID), slog.Any("error", err))
			serverError(w)
		}
		return
	}

	dlqMsgsRes := make([]dlqConsumeResponse, 0, len(msgs))
	for _, msg := range msgs {
		dlqMsgsRes = append(dlqMsgsRes, dlqConsumeResponse{
			Component:       msg.Component,
			Error:           msg.Error,
			OriginalMessage: msg.OriginalMessage.String(),
		})
	}

	jsonResponse(w, http.StatusOK, dlqMsgsRes)
}

type dlqConsumeResponse struct {
	Component       string `json:"component"`
	Error           string `json:"error"`
	OriginalMessage string `json:"original_message"`
}

func (h *handler) getDLQState(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)

	pipelineID, ok := params["id"]
	if !ok {
		h.log.Error("Cannot extract pipeline id", slog.Any("params", params))
		serverError(w)
		return
	}

	if len(strings.TrimSpace(pipelineID)) == 0 {
		jsonError(w, http.StatusUnprocessableEntity, "pipeline id cannot be empty", map[string]string{"pipeline_id": pipelineID})
		return
	}

	dlqStream := models.GetDLQStreamName(pipelineID)

	state, err := h.dlqSvc.GetDLQState(r.Context(), dlqStream)
	if err != nil {
		switch {
		case errors.Is(err, internal.ErrDLQNotExists):
			jsonError(w, http.StatusNotFound, "dlq for pipeline does not exist", map[string]string{"pipeline_id": pipelineID})
		default:
			h.log.Error("DLQ state fetch failed", slog.String("pipeline_id", pipelineID), slog.Any("error", err))
			serverError(w)
		}
		return
	}

	res := dlqStateResponse{
		LastReceivedAt:     state.LastReceivedAt,
		LastConsumedAt:     state.LastConsumedAt,
		TotalMessages:      state.TotalMessages,
		UnconsumedMessages: state.UnconsumedMessages,
	}

	jsonResponse(w, http.StatusOK, res)
}


type dlqStateResponse struct {
	LastReceivedAt     *time.Time `json:"last_received_at"`
	LastConsumedAt     *time.Time `json:"last_consumed_at"`
	TotalMessages      uint64     `json:"total_messages"`
	UnconsumedMessages uint64     `json:"unconsumed_messages"`
}
