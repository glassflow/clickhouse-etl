package api

import (
	"encoding/json"
	"net/http"
)

func parseRequest[T any](w http.ResponseWriter, r *http.Request) (*T, error) {
	maxBytes := 1_048_576 // 1 MB
	r.Body = http.MaxBytesReader(w, r.Body, int64(maxBytes))

	dec := json.NewDecoder(r.Body)
	// dec.DisallowUnknownFields()

	var v T
	err := dec.Decode(&v)
	if err != nil {
		return nil, invalidJSONError{detail: err}
	}

	return &v, nil
}
