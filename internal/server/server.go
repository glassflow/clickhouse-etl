package server

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/gorilla/mux"
)

type Server struct {
	*http.Server
	log *slog.Logger
}

func NewHTTPServer(addr string, readTimeout, writeTimeout, idleTimeout time.Duration, log *slog.Logger) *Server {
	//nolint: exhaustruct // optional server config
	return &Server{
		Server: &http.Server{
			Addr:              addr,
			Handler:           nil,
			ReadTimeout:       readTimeout,
			ReadHeaderTimeout: readTimeout,
			WriteTimeout:      writeTimeout,
			IdleTimeout:       idleTimeout,
		},
		log: log,
	}
}

func (s *Server) Start() error {
	r := mux.NewRouter()
	r.HandleFunc("/healthz", healthz)

	s.Handler = r

	s.log.Info("HTTP server listening", slog.String("Addr", s.Addr))

	err := s.ListenAndServe()
	if err != nil && !errors.Is(err, http.ErrServerClosed) {
		return fmt.Errorf("start server: %w", err)
	}

	return nil
}

func (s *Server) Shutdown(timeout time.Duration) error {
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), timeout)
	defer shutdownCancel()

	err := s.Server.Shutdown(shutdownCtx)
	if err != nil {
		return fmt.Errorf("stop server: %w", err)
	}

	return nil
}
