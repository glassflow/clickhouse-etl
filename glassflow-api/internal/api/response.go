package api

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/status"
)

func jsonResponse(w http.ResponseWriter, code int, v any) {
	encoded, err := json.Marshal(v)
	if err != nil {
		// Let middleware handle the error.
		panic(fmt.Errorf("failed to marshal json response: %w", err))
	}

	w.Header().Set("content-type", "application/json")
	w.WriteHeader(code)
	_, err = w.Write(encoded)
	if err != nil {
		// Let middleware handle the error.
		panic(fmt.Errorf("failed to marshal json response: %w", err))
	}
}

func serverError(w http.ResponseWriter) {
	http.Error(w, http.StatusText(http.StatusInternalServerError), http.StatusInternalServerError)
}

type FieldError struct {
	Field   string `json:"field"`
	Code    string `json:"code"`
	Message string `json:"message"`
}

type ErrorDetail struct {
	Status  int            `json:"status"`
	Code    string         `json:"code"`
	Message string         `json:"message"`
	Errors  []FieldError   `json:"errors,omitempty"`
	Details map[string]any `json:"details,omitempty"`
}

func (e *ErrorDetail) Error() string {
	return e.Message
}

func (e *ErrorDetail) GetStatus() int {
	return e.Status
}

type errorResponse struct {
	Message string            `json:"message"`
	Field   map[string]string `json:"field,omitempty"`
}

type statusValidationErrorResponse struct {
	Message          string   `json:"message"`
	Code             string   `json:"code"`
	CurrentStatus    string   `json:"current_status,omitempty"`
	RequestedStatus  string   `json:"requested_status,omitempty"`
	ValidTransitions []string `json:"valid_transitions,omitempty"`
}

func jsonError(w http.ResponseWriter, code int, message string, field map[string]string) {
	jsonResponse(w, code, &errorResponse{
		Message: message,
		Field:   field,
	})
}

func jsonStatusValidationError(w http.ResponseWriter, statusErr *status.StatusValidationError) {
	response := &statusValidationErrorResponse{
		Message:         statusErr.Message,
		Code:            statusErr.Code,
		CurrentStatus:   string(statusErr.CurrentStatus),
		RequestedStatus: string(statusErr.RequestedStatus),
	}

	// Convert valid transitions to strings
	if len(statusErr.ValidTransitions) > 0 {
		response.ValidTransitions = make([]string, len(statusErr.ValidTransitions))
		for i, transition := range statusErr.ValidTransitions {
			response.ValidTransitions[i] = string(transition)
		}
	}

	jsonResponse(w, statusErr.HTTPStatus(), response)
}
