package grpc

import (
	"context"
	"errors"

	colmetricspb "go.opentelemetry.io/proto/otlp/collector/metrics/v1"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/otlp-receiver/server/processor"
)

type metricServiceServer struct {
	colmetricspb.UnimplementedMetricsServiceServer
	processor OTLPDataProcessor
}

func (s *metricServiceServer) Export(
	ctx context.Context,
	req *colmetricspb.ExportMetricsServiceRequest,
) (*colmetricspb.ExportMetricsServiceResponse, error) {
	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		return nil, status.Error(codes.InvalidArgument, "missing metadata")
	}
	vals := md.Get(internal.OTLPPipelineIDHeader)
	if len(vals) == 0 {
		return nil, status.Error(codes.InvalidArgument, "missing x-glassflow-pipeline-id header")
	}
	if err := s.processor.ProcessMetrics(ctx, vals[0], req); err != nil {
		if errors.Is(err, processor.ErrReceiverOverloaded) {
			return nil, status.Error(codes.ResourceExhausted, err.Error())
		}
		return nil, status.Errorf(codes.Internal, "processing metrics: %v", err)
	}
	return &colmetricspb.ExportMetricsServiceResponse{}, nil
}
