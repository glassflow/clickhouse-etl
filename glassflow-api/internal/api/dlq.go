package api

import (
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"github.com/gorilla/mux"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/service"
)

func (h *handler) consumeDLQ(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)

	var batchSize int
	batchParam, ok := params["batchSize"]
	if ok {
		var err error
		batchSize, err = strconv.Atoi(batchParam)
		if err != nil {
			h.log.Error("cannot convert batchSize to int", slog.Any("error", err))
			serverError(w)
			return
		}
	}

	dlqBatch, err := models.NewDLQBatchSize(batchSize)
	if err != nil {
		jsonError(w, http.StatusUnprocessableEntity, fmt.Sprintf("batch size cannot be greater than %d", models.DLQMaxBatchSize), nil)
	}

	id, ok := params["id"]
	if !ok {
		h.log.Error("Cannot extract pipeline id", slog.Any("params", params))
		serverError(w)
		return
	}

	pid, err := models.NewPipelineID(id)
	if err != nil {
		jsonError(w, http.StatusUnprocessableEntity, err.Error(), map[string]string{"pipeline_id": id})
		return
	}

	msgs, err := h.ds.ConsumeDLQ(r.Context(), pid, dlqBatch)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrDLQNotExists):
			jsonError(w, http.StatusNotFound, "dlq for pipeline does not exist", map[string]string{"pipeline_id": id})
		case errors.Is(err, service.ErrNoMessagesInDLQ):
			w.WriteHeader(http.StatusNoContent)
		default:
			h.log.Error("Consuming DLQ failed", slog.String("pipeline_id", pid.String()), slog.Any("error", err))
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

	id, ok := params["id"]
	if !ok {
		h.log.Error("Cannot extract pipeline id", slog.Any("params", params))
		serverError(w)
		return
	}

	pid, err := models.NewPipelineID(id)
	if err != nil {
		jsonError(w, http.StatusUnprocessableEntity, err.Error(), map[string]string{"pipeline_id": id})
		return
	}

	state, err := h.ds.GetDLQState(r.Context(), pid)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrDLQNotExists):
			jsonError(w, http.StatusNotFound, "dlq for pipeline does not exist", map[string]string{"pipeline_id": id})
		default:
			h.log.Error("DLQ state fetch failed", slog.String("pipeline_id", pid.String()), slog.Any("error", err))
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
