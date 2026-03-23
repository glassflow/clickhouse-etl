package grpc

import (
	"context"

	coltracepb "go.opentelemetry.io/proto/otlp/collector/trace/v1"
)

type traceServiceServer struct {
	coltracepb.UnimplementedTraceServiceServer
}

func (s *traceServiceServer) Export(
	_ context.Context,
	_ *coltracepb.ExportTraceServiceRequest,
) (*coltracepb.ExportTraceServiceResponse, error) {
	return &coltracepb.ExportTraceServiceResponse{
		PartialSuccess: &coltracepb.ExportTracePartialSuccess{
			ErrorMessage: "hello world traces!",
		},
	}, nil
}
