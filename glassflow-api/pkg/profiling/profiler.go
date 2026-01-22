package profiling

import (
	"bytes"
	"context"
	"encoding/base64"
	"fmt"
	"log/slog"
	"os"
	"runtime/pprof"
	"time"
)

// Profiler handles CPU and memory profiling
type Profiler struct {
	enabled           bool
	cpuProfileDuration time.Duration
	profileInterval   time.Duration
	log               *slog.Logger
	stopCh            chan struct{}
}

// NewProfiler creates a new profiler instance
// Profiling is enabled when GLASSFLOW_OTEL_METRICS_ENABLED is true (same as metrics)
func NewProfiler(log *slog.Logger) *Profiler {
	// Check if metrics are enabled (profiling uses same flag)
	metricsEnabled := os.Getenv("GLASSFLOW_OTEL_METRICS_ENABLED") == "true" ||
		os.Getenv("OTEL_METRICS_ENABLED") == "true"

	return &Profiler{
		enabled:           metricsEnabled,
		cpuProfileDuration: 30 * time.Second,
		profileInterval:   60 * time.Second, // Profile every 60 seconds
		log:               log,
		stopCh:            make(chan struct{}),
	}
}

// Start begins periodic profiling
func (p *Profiler) Start() {
	if !p.enabled {
		p.log.Debug("Profiling disabled, skipping start")
		return
	}

	p.log.Info("Starting profiler", "cpu_duration_seconds", p.cpuProfileDuration.Seconds(), "interval_seconds", p.profileInterval.Seconds())

	go p.profileLoop()
}

// Stop stops the profiler
func (p *Profiler) Stop() {
	if !p.enabled {
		return
	}

	close(p.stopCh)
	p.log.Info("Profiler stopped")
}

func (p *Profiler) profileLoop() {
	ticker := time.NewTicker(p.profileInterval)
	defer ticker.Stop()

	// Do an initial profile
	p.captureCPUProfile()
	p.captureMemoryProfile()

	for {
		select {
		case <-p.stopCh:
			return
		case <-ticker.C:
			p.captureCPUProfile()
			p.captureMemoryProfile()
		}
	}
}

func (p *Profiler) captureCPUProfile() {
	ctx, cancel := context.WithTimeout(context.Background(), p.cpuProfileDuration)
	defer cancel()

	var buf bytes.Buffer

	err := pprof.StartCPUProfile(&buf)
	if err != nil {
		p.log.Error("Failed to start CPU profile", "error", err)
		return
	}

	// Wait for duration or context cancellation
	select {
	case <-ctx.Done():
	case <-time.After(p.cpuProfileDuration):
	}

	pprof.StopCPUProfile()

	// Encode to base64
	profileData := base64.StdEncoding.EncodeToString(buf.Bytes())

	// Log the profile
	p.logProfile("cpu", int(p.cpuProfileDuration.Seconds()), profileData)
}

func (p *Profiler) captureMemoryProfile() {
	var buf bytes.Buffer

	err := pprof.WriteHeapProfile(&buf)
	if err != nil {
		p.log.Error("Failed to capture memory profile", "error", err)
		return
	}

	// Encode to base64
	profileData := base64.StdEncoding.EncodeToString(buf.Bytes())

	// Log the profile
	p.logProfile("memory", 0, profileData)
}

func (p *Profiler) logProfile(profileType string, durationSeconds int, profileData string) {
	attrs := []interface{}{
		"profile_type", profileType,
		"profile_data_base64", profileData,
		"timestamp", time.Now().Format(time.RFC3339),
	}

	if durationSeconds > 0 {
		attrs = append(attrs, "duration_seconds", durationSeconds)
	}

	p.log.Info(fmt.Sprintf("%s profile captured", profileType), attrs...)
}
