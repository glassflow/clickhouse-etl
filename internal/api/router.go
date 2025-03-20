package api

import (
	"log/slog"
	"net/http"

	"github.com/gorilla/mux"
)

type handler struct {
	log *slog.Logger
}

func NewRouter(log *slog.Logger) http.Handler {
	h := handler{
		log: log,
	}

	r := mux.NewRouter()
	r.HandleFunc("/healthz", h.healthz)

	return r
}
