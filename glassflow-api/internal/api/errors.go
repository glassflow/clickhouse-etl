package api

import "fmt"

type invalidJSONError struct {
	detail error
}

func (e invalidJSONError) Error() string {
	return fmt.Sprintf("invalid json: %s", e.detail)
}
