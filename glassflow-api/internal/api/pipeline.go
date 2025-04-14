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
		var joinTopicErr models.UnsupportedNumberOfTopicsForJoinError
		switch {
		case errors.As(err, &activePipelineErr):
			jsonError(w, http.StatusForbidden, err.Error(), nil)
		case errors.Is(err, models.ErrUnsupportedNumberOfTopics), errors.As(err, &joinTopicErr):
			jsonError(w, http.StatusUnprocessableEntity, "invalid request", map[string]string{"topics": err.Error()})
		case errors.Is(err, models.ErrAmbiguousTopicsProvided), errors.Is(err, models.ErrInvalidJoinTopicConfiguration), errors.Is(err, models.ErrSameJoinOrientations):
			jsonError(w, http.StatusUnprocessableEntity, "invalid request", map[string]string{"join": err.Error()})
		case errors.Is(err, models.ErrEmptyKafkaBrokers):
			jsonError(w, http.StatusForbidden, err.Error(), map[string]string{"sources": err.Error()})
		default:
			h.log.Error("failed to setup pipeline", slog.Any("error", err))
			serverError(w)
		}
	}
}

func (h *handler) shutdownPipeline(w http.ResponseWriter, _ *http.Request) {
	err := h.pipelineManager.ShutdownPipeline()
	if err != nil && errors.Is(err, service.ErrPipelineNotFound) {
		jsonError(w, http.StatusNotFound, "no active pipeline to shutdown", nil)
		return
	}

	h.log.Info("pipeline shutdown")
	w.WriteHeader(http.StatusNoContent)
}
