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
}

func NewRouter(log *slog.Logger, pmgr *service.PipelineManager) http.Handler {
	h := handler{
		log: log,

		pipelineManager: pmgr,
	}

	r := mux.NewRouter()

	r.HandleFunc("/api/v1/healthz", h.healthz).Methods("GET")
	r.HandleFunc("/api/v1/pipeline", h.createPipeline).Methods("POST")
	r.HandleFunc("/api/v1/pipeline", h.getPipeline).Methods("GET")
	r.HandleFunc("/api/v1/pipeline/shutdown", h.shutdownPipeline).Methods("DELETE")

	r.Use(Recovery(log), RequestLogging(log))

	return r
}
