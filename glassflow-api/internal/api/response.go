package api

import (
	"encoding/json"
	"fmt"
	"net/http"
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

type errorResponse struct {
	Message string            `json:"message"`
	Field   map[string]string `json:"field,omitempty"`
}

func jsonError(w http.ResponseWriter, code int, message string, field map[string]string) {
	jsonResponse(w, code, &errorResponse{
		Message: message,
		Field:   field,
	})
}
