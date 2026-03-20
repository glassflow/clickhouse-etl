package http

import (
	nethttp "net/http"

	coltracepb "go.opentelemetry.io/proto/otlp/collector/trace/v1"
)

func (h handler) exportTraces(w nethttp.ResponseWriter, r *nethttp.Request) {
	req := &coltracepb.ExportTraceServiceRequest{}
	if err := decodeOTLPRequest(r, req); err != nil {
		nethttp.Error(w, err.Error(), nethttp.StatusBadRequest)
		return
	}

	// TODO: handle req

	writeOTLPResponse(w, r, &coltracepb.ExportTraceServiceResponse{})
}
