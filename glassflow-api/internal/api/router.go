package api

import (
	"log/slog"
	"net/http"

	"github.com/gorilla/mux"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/service"
)

type handler struct {
	log *slog.Logger

	pipelineManager *service.PipelineManager
	ds              *service.DLQ
}

func NewRouter(log *slog.Logger, psvc *service.PipelineManager, dsvc *service.DLQ) http.Handler {
	h := handler{
		log: log,

		pipelineManager: psvc,
		ds:              dsvc,
	}

	r := mux.NewRouter()

	r.HandleFunc("/api/v1/healthz", h.healthz).Methods("GET")
	r.HandleFunc("/api/v1/pipeline", h.createPipeline).Methods("POST")
	r.HandleFunc("/api/v1/pipeline/{id}", h.getPipeline).Methods("GET")
	r.HandleFunc("/api/v1/pipeline/shutdown", h.shutdownPipeline).Methods("DELETE")
	r.HandleFunc("/api/v1/pipeline/{id}/dlq/consume", h.consumeDLQ).
		Queries("batch_size", "{batchSize}").
		Methods("GET")
	r.HandleFunc("/api/v1/pipeline/{id}/dlq/state", h.getDLQState).Methods("GET")

	r.Use(Recovery(log), RequestLogging(log))

	return r
}
