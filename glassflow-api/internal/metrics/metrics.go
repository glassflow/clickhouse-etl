package metrics

import (
	"net/http"
	"time"

	"github.com/gorilla/mux"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

// Global registry (can be replaced by custom one later if needed)
var Registry = prometheus.NewRegistry()

var (
	HTTPRequestsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: "glassflow",
			Subsystem: "api",
			Name:      "http_requests_total",
			Help:      "Total number of HTTP requests received",
		},
		[]string{"method", "route", "status"},
	)
	HTTPRequestDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Namespace: "glassflow",
			Subsystem: "api",
			Name:      "http_request_duration_seconds",
			Help:      "Duration of HTTP requests in seconds",
			Buckets:   prometheus.DefBuckets,
		},
		[]string{"method", "route"},
	)
)

func init() {
	Registry.MustRegister(HTTPRequestsTotal, HTTPRequestDuration)
}

// MetricsHandler returns an HTTP handler that serves Prometheus metrics.
func MetricsHandler() http.Handler {
	return promhttp.HandlerFor(Registry, promhttp.HandlerOpts{})
}

// HTTPMetricsMiddleware is a middleware that records HTTP metrics for each request in a normalized form.
func HTTPMetricsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		ww := &statusWriter{ResponseWriter: w, status: 200}
		next.ServeHTTP(ww, r)

		route := r.URL.Path
		if cr := mux.CurrentRoute(r); cr != nil {
			if tmpl, err := cr.GetPathTemplate(); err == nil && tmpl != "" {
				route = tmpl
			}
		}

		HTTPRequestsTotal.WithLabelValues(r.Method, route, http.StatusText(ww.status)).Inc()
		HTTPRequestDuration.WithLabelValues(r.Method, route).Observe(time.Since(start).Seconds())
	})
}

type statusWriter struct {
	http.ResponseWriter
	status int
}

func (w *statusWriter) WriteHeader(code int) {
	w.status = code
	w.ResponseWriter.WriteHeader(code)
}
