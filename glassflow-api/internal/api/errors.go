package api

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
