package grpc

import (
	"context"
	"log/slog"
	"net"

	collogspb "go.opentelemetry.io/proto/otlp/collector/logs/v1"
	colmetricspb "go.opentelemetry.io/proto/otlp/collector/metrics/v1"
	coltracepb "go.opentelemetry.io/proto/otlp/collector/trace/v1"
	"google.golang.org/grpc"
	"google.golang.org/grpc/health"
	healthpb "google.golang.org/grpc/health/grpc_health_v1"
)

type OTLPDataProcessor interface {
	ProcessLogs(ctx context.Context, pipelineID string, exportLogsRequest *collogspb.ExportLogsServiceRequest) error
	ProcessTraces(ctx context.Context, pipelineID string, exportTracesRequest *coltracepb.ExportTraceServiceRequest) error
	ProcessMetrics(ctx context.Context, pipelineID string, exportMetricsRequest *colmetricspb.ExportMetricsServiceRequest) error
}

func NewGRPCServer(
	addr string,
	_ *slog.Logger,
	processor OTLPDataProcessor,
) (*grpc.Server, *health.Server, net.Listener, error) {
	grpcServer := grpc.NewServer(grpc.UnaryInterceptor(otlpMetricsInterceptor))

	grpcHealth := health.NewServer()
	grpcHealth.SetServingStatus("", healthpb.HealthCheckResponse_NOT_SERVING)
	healthpb.RegisterHealthServer(grpcServer, grpcHealth)
	coltracepb.RegisterTraceServiceServer(grpcServer, &traceServiceServer{processor: processor})
	collogspb.RegisterLogsServiceServer(grpcServer, &logServiceServer{processor: processor})
	colmetricspb.RegisterMetricsServiceServer(grpcServer, &metricServiceServer{processor: processor})

	lis, err := net.Listen("tcp", addr)
	if err != nil {
		return nil, nil, nil, err
	}

	return grpcServer, grpcHealth, lis, nil
}
