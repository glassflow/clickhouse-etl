package metrics

import (
	"runtime"
	"sync"

	"github.com/prometheus/client_golang/prometheus"
)

var (
	buildInfoOnce  sync.Once
	buildInfoGauge *prometheus.GaugeVec
)

// RegisterBuildInfo registers a gauge metric with build information.
// This should be called once during application startup.
func RegisterBuildInfo(version, commit, date string) {
	buildInfoOnce.Do(func() {
		buildInfoGauge = prometheus.NewGaugeVec(prometheus.GaugeOpts{
			Namespace: "glassflow",
			Subsystem: "api",
			Name:      "build_info",
			Help:      "Build information (value is always 1)",
		}, []string{"version", "commit", "date", "go_version"})
		Registry.MustRegister(buildInfoGauge)
		buildInfoGauge.WithLabelValues(version, commit, date, runtime.Version()).Set(1)
	})
}
