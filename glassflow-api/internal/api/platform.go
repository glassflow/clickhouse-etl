package api

import (
	"encoding/json"
	"net/http"
)

type PlatformResponse struct {
	Orchestrator string `json:"orchestrator"`
	APIVersion   string `json:"api_version,omitempty"`
}

// platform returns information about the platform and orchestrator being used
func (h *handler) platform(w http.ResponseWriter, _ *http.Request) {
	// Get orchestrator type from the pipeline manager
	orchType := "unknown"
	if h.pipelineService != nil {
		orchType = h.pipelineService.GetOrchestratorType()
	}

	response := PlatformResponse{
		Orchestrator: orchType,
		// API version is not currently available, so we'll skip it
		// APIVersion: "v1",
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)

	if err := json.NewEncoder(w).Encode(response); err != nil {
		h.log.Error("failed to encode platform response", "error", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
	}
}
