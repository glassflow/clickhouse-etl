package http

import (
	"context"
	"log/slog"
	nethttp "net/http"
	"sync/atomic"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humamux"
	"github.com/gorilla/mux"
	collogspb "go.opentelemetry.io/proto/otlp/collector/logs/v1"
	colmetricspb "go.opentelemetry.io/proto/otlp/collector/metrics/v1"
	coltracepb "go.opentelemetry.io/proto/otlp/collector/trace/v1"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/server"
)

type OTLPDataProcessor interface {
	ProcessLogs(ctx context.Context, pipelineID string, exportLogsRequest *collogspb.ExportLogsServiceRequest) error
	ProcessTraces(ctx context.Context, pipelineID string, exportTracesRequest *coltracepb.ExportTraceServiceRequest) error
	ProcessMetrics(ctx context.Context, pipelineID string, exportMetricsRequest *colmetricspb.ExportMetricsServiceRequest) error
}

type handler struct {
	ready             *atomic.Bool
	log               *slog.Logger
	otlpDataProcessor OTLPDataProcessor
}

type healthResponse struct {
	Status int
	Body   healthStatus
}

type healthStatus struct {
	Status string `json:"status"`
}

func NewHTTPServer(
	addr string,
	ready *atomic.Bool,
	log *slog.Logger,
	otlpDataProcessor OTLPDataProcessor,
) *server.Server {
	r := mux.NewRouter()

	config := huma.DefaultConfig("GlassFlow OLTP Receiver", "1.0.0")
	config.Info.Description = "GlassFlow OLTP Receiver HTTP API"
	config.CreateHooks = nil
	config.OpenAPIPath = ""
	config.DocsPath = ""

	humaAPI := humamux.New(r, config)

	h := handler{
		ready:             ready,
		log:               log,
		otlpDataProcessor: otlpDataProcessor,
	}
	registerHumaHandler("/healthz", h.healthz, healthzOperation(), humaAPI)
	registerHumaHandler("/readyz", h.readyz, readyzOperation(), humaAPI)

	r.Handle("/v1/traces", nethttp.HandlerFunc(h.exportTraces)).Methods(nethttp.MethodPost)
	r.Handle("/v1/metrics", nethttp.HandlerFunc(h.exportMetrics)).Methods(nethttp.MethodPost)
	r.Handle("/v1/logs", nethttp.HandlerFunc(h.exportLogs)).Methods(nethttp.MethodPost)

	return server.NewHTTPServer(
		addr,
		15*time.Second,
		15*time.Second,
		5*time.Minute,
		log,
		r,
	)
}

func registerHumaHandler[I, O any](
	path string,
	handler func(context.Context, *I) (*O, error),
	op huma.Operation,
	api huma.API,
) {
	op.Path = path
	huma.Register(api, op, handler)
}

func healthzOperation() huma.Operation {
	return huma.Operation{
		OperationID: "get-oltp-receiver-healthz",
		Method:      nethttp.MethodGet,
		Summary:     "Health check endpoint",
		Description: "Returns 200 OK if the OLTP receiver service is healthy",
	}
}

func readyzOperation() huma.Operation {
	return huma.Operation{
		OperationID: "get-oltp-receiver-readyz",
		Method:      nethttp.MethodGet,
		Summary:     "Readiness check endpoint",
		Description: "Returns 200 OK if the OLTP receiver service is ready to accept traffic",
	}
}

func (h handler) healthz(_ context.Context, _ *struct{}) (*healthResponse, error) {
	return &healthResponse{
		Status: nethttp.StatusOK,
		Body: healthStatus{
			Status: "ok",
		},
	}, nil
}

func (h handler) readyz(_ context.Context, _ *struct{}) (*healthResponse, error) {
	if h.ready.Load() {
		return &healthResponse{
			Status: nethttp.StatusOK,
			Body: healthStatus{
				Status: "ready",
			},
		}, nil
	}

	return &healthResponse{
		Status: nethttp.StatusServiceUnavailable,
		Body: healthStatus{
			Status: "not ready",
		},
	}, nil
}
