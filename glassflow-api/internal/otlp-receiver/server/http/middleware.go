package http

import (
	"io"
	nethttp "net/http"
	"time"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/pkg/observability"
)

var otlpPathComponent = map[string]string{
	"/v1/traces":  observability.MetricComponentOTLPTraces.String(),
	"/v1/logs":    observability.MetricComponentOTLPLogs.String(),
	"/v1/metrics": observability.MetricComponentOTLPMetrics.String(),
}

func otlpMetricsMiddleware(next nethttp.Handler) nethttp.Handler {
	return nethttp.HandlerFunc(func(w nethttp.ResponseWriter, r *nethttp.Request) {
		component, ok := otlpPathComponent[r.URL.Path]
		if !ok {
			next.ServeHTTP(w, r)
			return
		}

		pid := r.Header.Get(internal.OTLPPipelineIDHeader)
		if pid == "" {
			nethttp.Error(w, "missing "+internal.OTLPPipelineIDHeader+" header", nethttp.StatusBadRequest)
			return
		}

		cr := &countingReader{ReadCloser: r.Body}
		r.Body = cr
		sw := &statusWriter{ResponseWriter: w, statusCode: nethttp.StatusOK}
		start := time.Now()

		next.ServeHTTP(sw, r)

		observability.RecordBytesProcessedByPipelineID(r.Context(), component, "in", pid, cr.n)
		status := "ok"
		if sw.statusCode >= 500 {
			status = "error"
		}
		observability.RecordReceiverRequest(r.Context(), component, "http", status, pid, time.Since(start).Seconds())
	})
}

type statusWriter struct {
	nethttp.ResponseWriter
	statusCode int
}

func (sw *statusWriter) WriteHeader(code int) {
	sw.statusCode = code
	sw.ResponseWriter.WriteHeader(code)
}

type countingReader struct {
	io.ReadCloser
	n int64
}

func (cr *countingReader) Read(p []byte) (int, error) {
	n, err := cr.ReadCloser.Read(p)
	cr.n += int64(n)
	return n, err
}
