package api

import (
	"errors"
	"log/slog"
	"net/http"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

func (h *handler) createPipeline(w http.ResponseWriter, r *http.Request) {
	req, err := parseRequest[models.PipelineRequest](w, r)
	if err != nil {
		var jsonErr invalidJSONError
		if errors.As(err, &jsonErr) {
			jsonError(w, http.StatusBadRequest, err.Error(), nil)
		} else {
			h.log.Error("failed to read create pipeline request", slog.Any("error", err))
			serverError(w)
		}
		return
	}

	err = h.pipelineManager.SetupPipeline(req)
	if err != nil {
		h.log.Error("failed to setup pipeline", slog.Any("error", err))
		serverError(w)
	}
}

func (h *handler) shutdownPipeline(w http.ResponseWriter, _ *http.Request) {
	err := h.pipelineManager.ShutdownPipeline()
	if err != nil {
		h.log.Error("failed to shutdown pipeline", slog.Any("error", err))
		serverError(w)
	}
}
