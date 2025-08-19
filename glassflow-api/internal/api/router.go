package api

import (
	"log/slog"
	"net/http"

	"github.com/gorilla/mux"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/service"
)

type handler struct {
	log *slog.Logger

	pipelineManager service.PipelineManager
	dlqSvc          service.DLQ
}

func NewRouter(log *slog.Logger, pSvc service.PipelineManager, dlqSvc service.DLQ) http.Handler {
	r := mux.NewRouter()

	h := handler{
		log:             log,
		pipelineManager: pSvc,
		dlqSvc:          dlqSvc,
	}

	r.HandleFunc("/api/v1/healthz", h.healthz).Methods("GET")
	r.HandleFunc("/api/v1/pipeline", h.createPipeline).Methods("POST")
	r.HandleFunc("/api/v1/pipeline/{id}", h.getPipeline).Methods("GET")
	r.HandleFunc("/api/v1/pipeline/{id}", h.updatePipelineName).Methods("PATCH")
	r.HandleFunc("/api/v1/pipeline", h.getPipelines).Methods("GET")
	r.HandleFunc("/api/v1/pipeline/{id}/health", h.getPipelineHealth).Methods("GET")
	r.HandleFunc("/api/v1/pipeline/{id}/dlq/consume", h.consumeDLQ).
		Queries("batch_size", "{batchSize}").
		Methods("GET")
	r.HandleFunc("/api/v1/pipeline/{id}/dlq/state", h.getDLQState).Methods("GET")
	r.HandleFunc("/api/v1/pipeline/{id}", h.shutdownPipeline).Methods("DELETE")
	r.HandleFunc("/api/v1/pipeline/{id}/terminate", h.terminatePipeline).Methods("DELETE")

	r.Use(Recovery(log), RequestLogging(log))

	return r
}
