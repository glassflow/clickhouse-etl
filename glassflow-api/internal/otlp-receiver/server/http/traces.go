package http

import (
	"errors"
	nethttp "net/http"

	coltracepb "go.opentelemetry.io/proto/otlp/collector/trace/v1"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/otlp-receiver/server/processor"
)

func (h handler) exportTraces(w nethttp.ResponseWriter, r *nethttp.Request) {
	pipelineID := r.Header.Get(internal.OTLPPipelineIDHeader)
	if pipelineID == "" {
		nethttp.Error(w, "missing x-glassflow-pipeline-id header", nethttp.StatusBadRequest)
		return
	}

	req := &coltracepb.ExportTraceServiceRequest{}
	if err := decodeOTLPRequest(r, req); err != nil {
		nethttp.Error(w, err.Error(), nethttp.StatusBadRequest)
		return
	}

	if err := h.otlpDataProcessor.ProcessTraces(r.Context(), pipelineID, req); err != nil {
		if errors.Is(err, processor.ErrReceiverOverloaded) {
			w.Header().Set("Retry-After", "1")
			nethttp.Error(w, err.Error(), nethttp.StatusServiceUnavailable)
			return
		}
		nethttp.Error(w, err.Error(), nethttp.StatusInternalServerError)
		return
	}

	writeOTLPResponse(w, r, &coltracepb.ExportTraceServiceResponse{})
}
