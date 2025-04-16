package api

import (
	"errors"
	"log/slog"
	"net/http"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/service"
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
		var activePipelineErr service.ActivePipelineError
		var pErr models.PipelineConfigError
		switch {
		case errors.As(err, &activePipelineErr):
			jsonError(w, http.StatusForbidden, err.Error(), nil)
		case errors.As(err, &pErr):
			jsonError(w, http.StatusUnprocessableEntity, err.Error(), nil)

		default:
			h.log.Error("failed to setup pipeline", slog.Any("error", err))
			serverError(w)
		}
	}
}

func (h *handler) shutdownPipeline(w http.ResponseWriter, _ *http.Request) {
	err := h.pipelineManager.ShutdownPipeline()
	if err != nil {
		switch {
		case errors.Is(err, service.ErrPipelineNotFound):
			jsonError(w, http.StatusNotFound, "no active pipeline to shutdown", nil)
		default:
			serverError(w)
		}
		return
	}

	h.log.Info("pipeline shutdown")
	w.WriteHeader(http.StatusNoContent)
}
