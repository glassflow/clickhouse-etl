package http

import (
	nethttp "net/http"

	collogspb "go.opentelemetry.io/proto/otlp/collector/logs/v1"
)

func (h handler) exportLogs(w nethttp.ResponseWriter, r *nethttp.Request) {
	req := &collogspb.ExportLogsServiceRequest{}
	if err := decodeOTLPRequest(r, req); err != nil {
		nethttp.Error(w, err.Error(), nethttp.StatusBadRequest)
		return
	}

	// TODO: handle req

	writeOTLPResponse(w, r, &collogspb.ExportLogsServiceResponse{})
}
