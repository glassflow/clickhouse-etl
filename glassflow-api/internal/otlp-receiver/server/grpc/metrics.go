package grpc

import (
	"context"

	colmetricspb "go.opentelemetry.io/proto/otlp/collector/metrics/v1"
)

type metricServiceServer struct {
	colmetricspb.UnimplementedMetricsServiceServer
}

func (s *metricServiceServer) Export(
	_ context.Context,
	_ *colmetricspb.ExportMetricsServiceRequest,
) (*colmetricspb.ExportMetricsServiceResponse, error) {
	return &colmetricspb.ExportMetricsServiceResponse{}, nil
}
