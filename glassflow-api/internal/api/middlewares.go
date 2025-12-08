package api

import (
	"context"
	"log/slog"
	"net/http"
	"runtime/debug"
	"time"

	"github.com/gorilla/mux"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/metric"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/pkg/observability"
)

// contextKey is a type for context keys to avoid collisions
type contextKey string

// routeContextKey is the context key for storing route information
// Using string constant to avoid import cycles with service package
const routeContextKey contextKey = "route"

func Recovery(log *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer func() {
				if err := recover(); err != nil {
					log.ErrorContext(r.Context(), "panic", "error", err, "stacktrace", string(debug.Stack()))
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
					slog.String("component", "glassflow_api"),
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

type metricsResponseWriter struct {
	http.ResponseWriter
	status int
}

func (w *metricsResponseWriter) WriteHeader(code int) {
	w.status = code
	w.ResponseWriter.WriteHeader(code)
}

func newMetricsResponseWriter(w http.ResponseWriter) *metricsResponseWriter {
	return &metricsResponseWriter{
		ResponseWriter: w,
		status:         http.StatusOK,
	}
}

func RequestMetrics(meter *observability.Meter) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if meter == nil {
				next.ServeHTTP(w, r)
				return
			}

			start := time.Now()

			route := extractRoute(r)
			if route == "" {
				route = "unknown"
			}

			mw := newMetricsResponseWriter(w)

			next.ServeHTTP(mw, r)

			attrs := []attribute.KeyValue{
				attribute.String("method", r.Method),
				attribute.String("path", route),
				attribute.Int("status", mw.status),
			}

			ctx := r.Context()

			meter.HTTPRequestCount.Add(ctx, 1, metric.WithAttributes(attrs...))
			meter.HTTPRequestDuration.Record(ctx, time.Since(start).Seconds(), metric.WithAttributes(attrs...))
		})
	}
}

func extractRoute(r *http.Request) string {
	routeStr := r.Pattern

	if routeStr == "" {
		route := mux.CurrentRoute(r)
		if route != nil {
			routeStr, _ = route.GetPathTemplate()
		}
	}
	return routeStr
}

// RouteContext adds the route to the request context for tracking purposes
func RouteContext() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			route := extractRoute(r)
			if route != "" {
				ctx := context.WithValue(r.Context(), routeContextKey, route)
				r = r.WithContext(ctx)
			}
			next.ServeHTTP(w, r)
		})
	}
}
