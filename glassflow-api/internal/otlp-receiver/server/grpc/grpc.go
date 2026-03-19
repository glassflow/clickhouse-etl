package grpc

import (
	"net"

	"google.golang.org/grpc"
	"google.golang.org/grpc/health"
	healthpb "google.golang.org/grpc/health/grpc_health_v1"
)

func NewGRPCServer(addr string) (*grpc.Server, *health.Server, net.Listener, error) {
	grpcServer := grpc.NewServer()

	grpcHealth := health.NewServer()
	grpcHealth.SetServingStatus("", healthpb.HealthCheckResponse_NOT_SERVING)
	healthpb.RegisterHealthServer(grpcServer, grpcHealth)

	lis, err := net.Listen("tcp", addr)
	if err != nil {
		return nil, nil, nil, err
	}

	return grpcServer, grpcHealth, lis, nil
}
