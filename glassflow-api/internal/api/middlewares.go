package api

import (
	"log/slog"
	"net/http"
	"runtime/debug"
	"time"
)

func Recovery(log *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer func() {
				if err := recover(); err != nil {
					log.Error("panic", slog.Any("error", err), slog.String("stacktrace", string(debug.Stack())))
					w.WriteHeader(http.StatusInternalServerError)
				}
			}()

			next.ServeHTTP(w, r)
		})
	}
}

type loggingResponseWriter struct {
	http.ResponseWriter
	status int
}

func newLoggingResponseWriter(w http.ResponseWriter) *loggingResponseWriter {
	return &loggingResponseWriter{ResponseWriter: w, status: http.StatusOK}
}

func (w *loggingResponseWriter) WriteHeader(code int) {
	w.status = code
	w.ResponseWriter.WriteHeader(code)
}

func RequestLogging(log *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			lw := newLoggingResponseWriter(w)

			defer func() {
				logger := log.With(
					slog.Duration("latency", time.Since(start)),
					slog.String("remote_ip", r.RemoteAddr),
					slog.String("host", r.Host),
					slog.String("method", r.Method),
					slog.String("path", r.URL.Path),
					slog.String("referer", r.Referer()),
					slog.String("user_agent", r.UserAgent()),
					slog.Int("status", lw.status))

				var level slog.Level
				if lw.status >= http.StatusInternalServerError {
					level = slog.LevelError
				} else {
					level = slog.LevelInfo
				}
				logger.Log(r.Context(), level, "request")
			}()

			next.ServeHTTP(lw, r)
		})
	}
}
