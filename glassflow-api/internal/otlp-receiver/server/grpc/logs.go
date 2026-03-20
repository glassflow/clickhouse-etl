package grpc

import (
	"context"

	collogspb "go.opentelemetry.io/proto/otlp/collector/logs/v1"
)

type logServiceServer struct {
	collogspb.UnimplementedLogsServiceServer
}

func (s *logServiceServer) Export(
	_ context.Context,
	_ *collogspb.ExportLogsServiceRequest,
) (*collogspb.ExportLogsServiceResponse, error) {
	return &collogspb.ExportLogsServiceResponse{}, nil
}
