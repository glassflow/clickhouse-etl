package server

import (
	"context"
	"log/slog"
	"net"
	"sync"
	"sync/atomic"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/health"
	healthpb "google.golang.org/grpc/health/grpc_health_v1"

	grpcQ "github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/otlp-receiver/server/grpc"
	httpQ "github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/otlp-receiver/server/http"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/server"
)

const (
	httpAddr = ":4318"
	grpcAddr = ":4317"
)

type Receiver struct {
	ready      atomic.Bool
	httpServer *server.Server
	grpcServer *grpc.Server
	grpcHealth *health.Server
	grpcLis    net.Listener
	log        *slog.Logger
}

func New(log *slog.Logger) (*Receiver, error) {
	grpcServer, grpcHealth, grpcLis, err := grpcQ.NewGRPCServer(grpcAddr)
	if err != nil {
		return nil, err
	}

	r := &Receiver{
		log:        log,
		grpcServer: grpcServer,
		grpcHealth: grpcHealth,
		grpcLis:    grpcLis,
	}

	r.httpServer = httpQ.NewHTTPServer(httpAddr, &r.ready, log)

	return r, nil
}

func (r *Receiver) Start(ctx context.Context) error {
	grpcErrCh := make(chan error, 1)
	go func() {
		r.log.Info("gRPC server listening", slog.String("addr", r.grpcLis.Addr().String()))
		grpcErrCh <- r.grpcServer.Serve(r.grpcLis)
	}()

	httpErrCh := make(chan error, 1)
	go func() {
		httpErrCh <- r.httpServer.Start()
	}()

	r.ready.Store(true)
	r.grpcHealth.SetServingStatus("", healthpb.HealthCheckResponse_SERVING)

	select {
	case err := <-grpcErrCh:
		return err
	case err := <-httpErrCh:
		return err
	case <-ctx.Done():
		return nil
	}
}

func (r *Receiver) Shutdown(ctx context.Context) {
	r.ready.Store(false)
	r.grpcHealth.Shutdown()

	var wg sync.WaitGroup
	wg.Add(2)

	go func() {
		defer wg.Done()
		_ = r.httpServer.Shutdown(ctx, 5*time.Second)
	}()

	go func() {
		defer wg.Done()
		grpcStopped := make(chan struct{})
		go func() {
			r.grpcServer.GracefulStop()
			close(grpcStopped)
		}()
		select {
		case <-grpcStopped:
		case <-ctx.Done():
			r.grpcServer.Stop()
		}
	}()

	wg.Wait()
}
