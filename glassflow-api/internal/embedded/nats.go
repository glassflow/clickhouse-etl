package embedded

import (
	"fmt"
	"log/slog"

	natsServer "github.com/nats-io/nats-server/v2/server"
	natsTest "github.com/nats-io/nats-server/v2/test"
)

// NATSServer wraps an embedded NATS server
type NATSServer struct {
	server *natsServer.Server
	logger *slog.Logger
}

// NewNATSServer creates and starts an embedded NATS server with JetStream
func NewNATSServer(logger *slog.Logger, port int) (*NATSServer, error) {
	opts := &natsServer.Options{
		Host:      "127.0.0.1",
		Port:      port,
		JetStream: true,
		NoLog:     true,
		NoSigs:    true,
	}

	logger.Info("Starting embedded NATS server...", slog.Int("port", port))

	// Use test helper to run server (handles startup properly)
	ns := natsTest.RunServer(opts)
	if ns == nil {
		return nil, fmt.Errorf("failed to start NATS server")
	}

	logger.Info("Embedded NATS server started successfully",
		slog.Int("port", port),
		slog.String("url", ns.ClientURL()))

	return &NATSServer{
		server: ns,
		logger: logger,
	}, nil
}

// Shutdown gracefully stops the NATS server
func (n *NATSServer) Shutdown() {
	if n.server != nil {
		n.logger.Info("Shutting down embedded NATS server")
		n.server.Shutdown()
		n.server.WaitForShutdown()
	}
}

// URL returns the connection URL for the NATS server
func (n *NATSServer) URL() string {
	return n.server.ClientURL()
}
