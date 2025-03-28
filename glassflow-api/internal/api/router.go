package api

import (
	"log/slog"
	"net/http"

	"github.com/gorilla/mux"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/service"
)

type handler struct {
	log *slog.Logger

	bridgeManager *service.BridgeManager
}

func NewRouter(log *slog.Logger, bmgr *service.BridgeManager) http.Handler {
	h := handler{
		log: log,

		bridgeManager: bmgr,
	}

	r := mux.NewRouter()
	r.HandleFunc("/healthz", h.healthz).Methods("GET")
	r.HandleFunc("/bridge", h.startBridge).Methods("POST")
	r.HandleFunc("/pipeline", h.createPipeline).Methods("POST")

	r.Use(Recovery(log), RequestLogging(log))

	return r
}
