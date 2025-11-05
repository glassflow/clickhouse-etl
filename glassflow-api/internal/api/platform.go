package api

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
)

func PlatformSwaggerDocs() huma.Operation {
	return huma.Operation{
		OperationID: "get-platform",
		Method:      http.MethodGet,
		Summary:     "Get platform information",
		Description: "Returns information about the platform and orchestrator being used",
	}
}

type PlatformResponse struct {
	Body PlatformInfo
}

type PlatformInfo struct {
	Orchestrator string `json:"orchestrator" doc:"Type of orchestrator being used"`
	APIVersion   string `json:"api_version,omitempty" doc:"API version"`
}

func (h *handler) platform(_ context.Context, _ *struct{}) (*PlatformResponse, error) {
	orchType := "unknown"
	if h.pipelineService != nil {
		orchType = h.pipelineService.GetOrchestratorType()
	}

	resp := &PlatformResponse{
		Body: PlatformInfo{
			Orchestrator: orchType,
		},
	}
	// API version is not currently available, so we'll skip it
	// resp.Body.APIVersion = "v1"

	return resp, nil
}
