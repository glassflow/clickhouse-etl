package api

import (
	"context"
	"net/http"

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
	w.WriteHeader(http.StatusOK)
}

func (h *handler) healthzV2(ctx context.Context, _ *struct{}) (*HealthResponse, error) {
	return &HealthResponse{Body: HealthStatus{Status: "ok"}}, nil
}
