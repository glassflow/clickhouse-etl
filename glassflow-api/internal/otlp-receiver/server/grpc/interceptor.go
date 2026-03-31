package grpc

import (
	"context"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/metadata"
	"google.golang.org/protobuf/proto"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/pkg/observability"
)

var otlpMethodComponent = map[string]string{
	"/opentelemetry.proto.collector.trace.v1.TraceService/Export":     observability.MetricComponentOTLPTraces.String(),
	"/opentelemetry.proto.collector.logs.v1.LogsService/Export":       observability.MetricComponentOTLPLogs.String(),
	"/opentelemetry.proto.collector.metrics.v1.MetricsService/Export": observability.MetricComponentOTLPMetrics.String(),
}

func otlpMetricsInterceptor(ctx context.Context, req any, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (any, error) {
	component, ok := otlpMethodComponent[info.FullMethod]
	if !ok {
		return handler(ctx, req)
	}

	var pid string
	if md, ok := metadata.FromIncomingContext(ctx); ok {
		if vals := md.Get(internal.OTLPPipelineIDHeader); len(vals) > 0 {
			pid = vals[0]
		}
	}

	if msg, ok := req.(proto.Message); ok {
		observability.RecordBytesProcessedByPipelineID(ctx, component, "in", pid, int64(proto.Size(msg)))
	}
	start := time.Now()

	resp, err := handler(ctx, req)

	status := "ok"
	if err != nil {
		status = "error"
	}
	observability.RecordReceiverRequest(ctx, component, "grpc", status, pid, time.Since(start).Seconds())

	return resp, err
}
