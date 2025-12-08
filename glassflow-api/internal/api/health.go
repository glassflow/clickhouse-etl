package api

import (
	"context"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"
)

type HealthResponse struct {
	Body HealthStatus
}

type HealthStatus struct {
	Status string `json:"status"`
}

func HealthzSwaggerDocs() huma.Operation {
	return huma.Operation{
		OperationID: "get-healthz",
		Method:      http.MethodGet,
		Summary:     "Health check endpoint",
		Description: "Returns 200 OK if the service is healthy",
	}
}

func (h *handler) healthz(w http.ResponseWriter, r *http.Request) {
	if h.trackingClient != nil && h.trackingClient.IsEnabled() {
		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()
		h.trackingClient.SendEvent(ctx, "readiness_ping", "api", map[string]interface{}{})
	}
	w.WriteHeader(http.StatusOK)
}

func (h *handler) healthzV2(ctx context.Context, _ *struct{}) (*HealthResponse, error) {
	if h.trackingClient != nil && h.trackingClient.IsEnabled() {
		ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
		defer cancel()
		h.trackingClient.SendEvent(ctx, "readiness_ping", "api", map[string]interface{}{})
	}
	return &HealthResponse{Body: HealthStatus{Status: "ok"}}, nil
}
