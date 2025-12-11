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

func (*handler) healthz(w http.ResponseWriter, _ *http.Request) {
	w.WriteHeader(http.StatusOK)
}

func (h *handler) healthzV2(_ context.Context, _ *struct{}) (*HealthResponse, error) {
	return &HealthResponse{Body: HealthStatus{Status: "ok"}}, nil
}
