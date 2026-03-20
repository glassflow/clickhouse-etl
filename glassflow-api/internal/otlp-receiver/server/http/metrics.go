package http

import (
	nethttp "net/http"

	colmetricspb "go.opentelemetry.io/proto/otlp/collector/metrics/v1"
)

func (h handler) exportMetrics(w nethttp.ResponseWriter, r *nethttp.Request) {
	req := &colmetricspb.ExportMetricsServiceRequest{}
	if err := decodeOTLPRequest(r, req); err != nil {
		nethttp.Error(w, err.Error(), nethttp.StatusBadRequest)
		return
	}

	// TODO: handle req

	writeOTLPResponse(w, r, &colmetricspb.ExportMetricsServiceResponse{})
}
