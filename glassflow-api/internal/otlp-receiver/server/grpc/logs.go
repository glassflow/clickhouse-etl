package grpc

import (
	"context"

	collogspb "go.opentelemetry.io/proto/otlp/collector/logs/v1"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
)

type logServiceServer struct {
	collogspb.UnimplementedLogsServiceServer
	processor OTLPDataProcessor
}

func (s *logServiceServer) Export(
	ctx context.Context,
	req *collogspb.ExportLogsServiceRequest,
) (*collogspb.ExportLogsServiceResponse, error) {
	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		return nil, status.Error(codes.InvalidArgument, "missing metadata")
	}
	vals := md.Get(internal.OTLPPipelineIDHeader)
	if len(vals) == 0 {
		return nil, status.Error(codes.InvalidArgument, "missing x-glassflow-pipeline-id header")
	}
	if err := s.processor.ProcessLogs(ctx, vals[0], req); err != nil {
		return nil, status.Errorf(codes.Internal, "processing logs: %v", err)
	}
	return &collogspb.ExportLogsServiceResponse{}, nil
}
