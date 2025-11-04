package embedded

import (
	"embed"
	"io/fs"
	"net/http"
	"strings"
)

//go:embed all:ui/.next
var uiFiles embed.FS

// UIHandler returns an http.Handler that serves the embedded UI static files
func UIHandler() (http.Handler, error) {
	// Create filesystem view for HTML files from server/app directory
	htmlFS, err := fs.Sub(uiFiles, "ui/.next/server/app")
	if err != nil {
		return nil, err
	}

	// Create filesystem view for static assets (CSS, JS, images)
	staticFS, err := fs.Sub(uiFiles, "ui/.next")
	if err != nil {
		return nil, err
	}

	htmlFileServer := http.FileServer(http.FS(htmlFS))
	staticFileServer := http.FileServer(http.FS(staticFS))

	// Wrap with custom handler to handle SPA routing and redirects
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Handle root redirect to /home
		if r.URL.Path == "/" {
			http.Redirect(w, r, "/home", http.StatusMovedPermanently)
			return
		}

		// Serve static assets (CSS, JS, images) from /_next/static/
		if strings.HasPrefix(r.URL.Path, "/_next/") {
			// Strip /_next prefix to match embedded filesystem structure
			// e.g., /_next/static/css/foo.css -> /static/css/foo.css
			r.URL.Path = strings.TrimPrefix(r.URL.Path, "/_next")
			staticFileServer.ServeHTTP(w, r)
			return
		}

		// Try to serve the file
		path := strings.TrimPrefix(r.URL.Path, "/")

		// Strip trailing slashes to prevent directory listings
		// e.g., /home/ -> /home, but keep root / as is
		if r.URL.Path != "/" && strings.HasSuffix(r.URL.Path, "/") {
			r.URL.Path = strings.TrimSuffix(r.URL.Path, "/")
			path = strings.TrimPrefix(r.URL.Path, "/")
		}

		// For paths without extensions, prioritize .html files over directories
		// This handles Next.js static export routing
		if !strings.HasPrefix(r.URL.Path, "/ui-api/") && !strings.Contains(path, ".") {
			htmlPath := path + ".html"
			if _, err := fs.Stat(htmlFS, htmlPath); err == nil {
				r.URL.Path = "/" + htmlPath
			}
		}

		htmlFileServer.ServeHTTP(w, r)
	}), nil
}
