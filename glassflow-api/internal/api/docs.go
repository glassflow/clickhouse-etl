package api

import (
	_ "embed"
	"net/http"
)

//go:embed docs/api.yaml
var docsYAML []byte

//go:embed docs/swagger-ui.html
var swaggerHTML []byte

func (h *handler) docsYAML(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/x-yaml")
	w.Write(docsYAML)
}

func (h *handler) swaggerUI(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "text/html")
	w.Write(swaggerHTML)
}
