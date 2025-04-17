package core

import (
	"fmt"
	"os"
	"strings"
	"time"

	nats "github.com/nats-io/nats.go"
)

func (server *NATSKafkaBridge) natsError(_ *nats.Conn, _ *nats.Subscription, err error) {
	server.logger.Warnf("nats error %s", err.Error())
}

func (server *NATSKafkaBridge) natsDisconnected(_ *nats.Conn) {
	if !server.checkRunning() {
		return
	}
	server.logger.Warnf("nats disconnected")
	server.checkConnections()
}

func (server *NATSKafkaBridge) natsReconnected(_ *nats.Conn) {
	server.logger.Warnf("nats reconnected")
}

func (server *NATSKafkaBridge) natsClosed(_ *nats.Conn) {
	if server.checkRunning() {
		server.logger.Errorf("nats connection closed, shutting down bridge")
		go func() {
			// When NATS connection is really marked as closed, the bridge cannot
			// do anything else, so stop the bridge and exit the process with an
			// error so that system/docker can restart (if applicable).
			server.Stop()
			os.Exit(2)
		}()
	}
}

func (server *NATSKafkaBridge) natsDiscoveredServers(nc *nats.Conn) {
	server.logger.Debugf("discovered servers: %v\n", nc.DiscoveredServers())
	server.logger.Debugf("known servers: %v\n", nc.Servers())
}

// assumes the lock is held by the caller
func (server *NATSKafkaBridge) connectToNATS() error {
	server.natsLock.Lock()
	defer server.natsLock.Unlock()

	if !server.running {
		return nil // already stopped
	}

	server.logger.Debugf("connecting to NATS core")

	config := server.config.NATS
	options := []nats.Option{
		nats.MaxReconnects(config.MaxReconnects),
		nats.ReconnectWait(time.Duration(config.ReconnectWait) * time.Millisecond),
		nats.Timeout(time.Duration(config.ConnectTimeout) * time.Millisecond),
		nats.ErrorHandler(server.natsError),
		nats.DiscoveredServersHandler(server.natsDiscoveredServers),
		nats.DisconnectHandler(server.natsDisconnected),
		nats.ReconnectHandler(server.natsReconnected),
		nats.ClosedHandler(server.natsClosed),
		nats.NoCallbacksAfterClientClose(),
	}

	if config.TLS.Root != "" {
		options = append(options, nats.RootCAs(config.TLS.Root))
	}

	if config.TLS.Cert != "" {
		options = append(options, nats.ClientCert(config.TLS.Cert, config.TLS.Key))
	}

	if config.UserCredentials != "" {
		options = append(options, nats.UserCredentials(config.UserCredentials))
	}

	nc, err := nats.Connect(strings.Join(config.Servers, ","),
		options...,
	)
	if err != nil {
		return fmt.Errorf("connect to nats: %w", err)
	}

	server.nats = nc
	return nil
}

func (server *NATSKafkaBridge) connectToJetStream() error {
	server.natsLock.Lock()
	defer server.natsLock.Unlock()

	if server.js != nil {
		return nil // already connected
	}

	server.logger.Debugf("connecting to JetStream")

	var opts []nats.JSOpt
	c := server.config.JetStream
	if c.MaxWait > 0 {
		opts = append(opts, nats.MaxWait(time.Duration(c.MaxWait)*time.Millisecond))
	}
	if c.PublishAsyncMaxPending > 0 {
		opts = append(opts, nats.PublishAsyncMaxPending(c.PublishAsyncMaxPending))
	}

	js, err := server.nats.JetStream(opts...)
	if err != nil {
		return fmt.Errorf("unable to get jetstream context: %w", err)
	}
	server.js = js

	return nil
}
