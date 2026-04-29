package http

import (
	"errors"
	nethttp "net/http"

	colmetricspb "go.opentelemetry.io/proto/otlp/collector/metrics/v1"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/otlp-receiver/server/processor"
)

func (h handler) exportMetrics(w nethttp.ResponseWriter, r *nethttp.Request) {
	pipelineID := r.Header.Get(internal.OTLPPipelineIDHeader)
	if pipelineID == "" {
		nethttp.Error(w, "missing x-glassflow-pipeline-id header", nethttp.StatusBadRequest)
		return
	}

	req := &colmetricspb.ExportMetricsServiceRequest{}
	if err := decodeOTLPRequest(r, h.maxBodyBytes, req); err != nil {
		if errors.Is(err, errRequestTooLarge) {
			nethttp.Error(w, err.Error(), nethttp.StatusRequestEntityTooLarge)
			return
		}
		nethttp.Error(w, err.Error(), nethttp.StatusBadRequest)
		return
	}

	if err := h.otlpDataProcessor.ProcessMetrics(r.Context(), pipelineID, req); err != nil {
		if errors.Is(err, processor.ErrReceiverOverloaded) {
			w.Header().Set("Retry-After", "1")
			nethttp.Error(w, err.Error(), nethttp.StatusServiceUnavailable)
			return
		}
		nethttp.Error(w, err.Error(), nethttp.StatusInternalServerError)
		return
	}

	writeOTLPResponse(w, r, &colmetricspb.ExportMetricsServiceResponse{})
}
