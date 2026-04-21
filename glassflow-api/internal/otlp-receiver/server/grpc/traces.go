package grpc

import (
	"context"

	coltracepb "go.opentelemetry.io/proto/otlp/collector/trace/v1"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
)

type traceServiceServer struct {
	coltracepb.UnimplementedTraceServiceServer
	processor OTLPDataProcessor
}

func (s *traceServiceServer) Export(
	ctx context.Context,
	req *coltracepb.ExportTraceServiceRequest,
) (*coltracepb.ExportTraceServiceResponse, error) {
	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		return nil, status.Error(codes.InvalidArgument, "missing metadata")
	}
	vals := md.Get(internal.OTLPPipelineIDHeader)
	if len(vals) == 0 {
		return nil, status.Error(codes.InvalidArgument, "missing x-glassflow-pipeline-id header")
	}
	if err := s.processor.ProcessTraces(ctx, vals[0], req); err != nil {
		return nil, status.Errorf(codes.Internal, "processing traces: %v", err)
	}
	return &coltracepb.ExportTraceServiceResponse{}, nil
}
