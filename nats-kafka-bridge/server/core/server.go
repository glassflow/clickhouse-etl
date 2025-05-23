/*
 * Copyright 2019 The NATS Authors
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

package core

import (
	"fmt"
	"net"
	"net/http"
	"sync"
	"time"

	nats "github.com/nats-io/nats.go"
	stan "github.com/nats-io/stan.go"

	"github.com/glassflow/nats-kafka-bridge/server/conf"
	"github.com/glassflow/nats-kafka-bridge/server/logging"
)

// NATSKafkaBridge is the core structure for the server.
type NATSKafkaBridge struct {
	sync.Mutex
	running bool

	startTime time.Time

	logger logging.Logger
	config conf.NATSKafkaBridgeConfig

	natsLock sync.Mutex
	nats     *nats.Conn
	stan     stan.Conn
	js       nats.JetStreamContext

	connectors []Connector

	reconnectLock  sync.Mutex
	reconnect      map[string]Connector
	reconnectTimer *reconnectTimer

	statsLock     sync.Mutex
	httpReqStats  map[string]int64
	listener      net.Listener
	http          *http.Server
	httpHandler   *http.ServeMux
	monitoringURL string
}

// NewNATSKafkaBridge creates a new account server with a default logger
func NewNATSKafkaBridge(logColor, logTime bool) *NATSKafkaBridge {
	//nolint: exhaustruct // default config
	return &NATSKafkaBridge{
		logger: logging.NewNATSLogger(logging.Config{
			Colors: logColor,
			Time:   logTime,
			Debug:  true,
			Trace:  true,
		}),
	}
}

// Logger hosts a shared logger
func (server *NATSKafkaBridge) Logger() logging.Logger {
	return server.logger
}

func (server *NATSKafkaBridge) checkRunning() bool {
	server.Lock()
	defer server.Unlock()
	return server.running
}

// InitializeFromConfig initialize the server's configuration to an existing config object, useful for tests
// Does not change the config at all, use DefaultServerConfig() to create a default config
func (server *NATSKafkaBridge) InitializeFromConfig(config conf.NATSKafkaBridgeConfig) error {
	server.config = config
	return nil
}

// Start the server, will lock the server, assumes the config is loaded
func (server *NATSKafkaBridge) Start() error {
	server.Lock()
	defer server.Unlock()

	if server.logger != nil {
		server.logger.Close()
	}

	server.running = true
	server.startTime = time.Now()
	server.logger = logging.NewNATSLogger(server.config.Logging)
	server.connectors = []Connector{}
	server.reconnect = map[string]Connector{}

	server.logger.Noticef("starting NATS-Kafka Bridge")
	server.logger.Debugf("server time is %s", server.startTime.Format(time.UnixDate))

	if err := server.connectToNATS(); err != nil {
		return err
	}

	if err := server.connectToJetStream(); err != nil {
		return err
	}

	if err := server.initializeConnectors(); err != nil {
		return err
	}

	if err := server.startConnectors(); err != nil {
		return err
	}

	if err := server.startMonitoring(); err != nil {
		return err
	}

	return nil
}

// Stop the account server
func (server *NATSKafkaBridge) Stop() {
	server.Lock()
	defer server.Unlock()

	if !server.running {
		return // already stopped
	}

	server.logger.Noticef("stopping bridge")

	server.running = false
	server.stopReconnectTimer()
	server.reconnect = map[string]Connector{} // clear the map

	for _, c := range server.connectors {
		err := c.Shutdown()
		if err != nil {
			server.logger.Noticef("error shutting down connector %s", err.Error())
		}
	}

	// Shutdown STAN connection first, since it needs NATS connection to send
	// the close protocol.
	if server.stan != nil {
		server.stan.Close()
		server.logger.Noticef("disconnected from NATS streaming")
	}

	if server.nats != nil {
		if err := server.nats.Drain(); err != nil {
			server.logger.Noticef("error draining NATS connection %s", err.Error())
		}
		server.logger.Noticef("disconnected from NATS")
	}

	err := server.StopMonitoring()
	if err != nil {
		server.logger.Noticef("error shutting down monitoring server %s", err.Error())
	}
}

// assumes the lock is held by the caller
func (server *NATSKafkaBridge) initializeConnectors() error {
	connectorConfigs := server.config.Connect

	for _, c := range connectorConfigs {
		connector := CreateConnector(c, server)
		server.connectors = append(server.connectors, connector)
	}
	return nil
}

// assumes the lock is held by the caller
func (server *NATSKafkaBridge) startConnectors() error {
	for _, c := range server.connectors {
		if err := c.Start(); err != nil {
			server.logger.Noticef("error starting %s, %s", c.String(), err.Error())
			return fmt.Errorf("start connectors: %w", err)
		}
	}
	return nil
}

// // FatalError stops the server, prints the messages and exits
// func (server *NATSKafkaBridge) FatalError(format string, args ...interface{}) {
// 	server.Stop()
// 	log.Fatalf(format, args...)
// 	os.Exit(-1)
// }

// NATS hosts a shared nats connection for the connectors
func (server *NATSKafkaBridge) NATS() *nats.Conn {
	server.natsLock.Lock()
	defer server.natsLock.Unlock()
	return server.nats
}

// JetStream hosts a shared JetStream connection for the connectors
func (server *NATSKafkaBridge) JetStream() nats.JetStreamContext {
	server.natsLock.Lock()
	defer server.natsLock.Unlock()
	return server.js
}

// CheckNATS returns true if the bridge is connected to nats
func (server *NATSKafkaBridge) CheckNATS() bool {
	server.natsLock.Lock()
	defer server.natsLock.Unlock()

	if server.nats != nil {
		return server.nats.ConnectedUrl() != ""
	}

	return false
}

// CheckJetStream returns true if the bridge is connected to JetStream
func (server *NATSKafkaBridge) CheckJetStream() bool {
	server.natsLock.Lock()
	defer server.natsLock.Unlock()

	if server.nats == nil {
		return false
	}
	if server.nats.ConnectedUrl() == "" {
		return false
	}

	return server.js != nil
}

// ConnectorError is called by a connector if it has a failure that requires a reconnect
func (server *NATSKafkaBridge) ConnectorError(connector Connector, err error) {
	if !server.checkRunning() {
		return
	}

	server.reconnectLock.Lock()
	defer server.reconnectLock.Unlock()

	_, check := server.reconnect[connector.ID()]

	if check {
		return // we already have that connector, no need to stop or pring any messages
	}

	description := connector.String()
	server.logger.Errorf("a connector error has occurred, bridge will try to restart %s, %s", description, err.Error())

	err = connector.Shutdown()
	if err != nil {
		server.logger.Warnf("error shutting down connector %s, bridge will try to restart, %s", description, err.Error())
	}

	server.logger.Noticef("adding connector to reconnect map", connector.ID())
	server.reconnect[connector.ID()] = connector

	server.ensureReconnectTimer()
}

// checkConnections loops over the connections and has them each check their requirements
func (server *NATSKafkaBridge) checkConnections() {
	server.logger.Warnf("checking connector requirements and will restart as needed.")

	if !server.checkRunning() {
		return
	}

	server.reconnectLock.Lock()
	defer server.reconnectLock.Unlock()

	for _, connector := range server.connectors {
		_, check := server.reconnect[connector.ID()]

		if check {
			continue // we already have that connector, no need to stop or pring any messages
		}

		err := connector.CheckConnections()

		if err == nil {
			continue // connector is happy
		}

		description := connector.String()
		server.logger.Errorf("a connector error has occurred, trying to restart %s, %s", description, err.Error())

		err = connector.Shutdown()
		if err != nil {
			server.logger.Warnf("error shutting down connector %s, trying to restart, %s", description, err.Error())
		}

		server.reconnect[connector.ID()] = connector
	}

	server.ensureReconnectTimer()
}

// requires the reconnect lock be held by the caller
// spawns a go routine that will acquire the lock for handling reconnect tasks
func (server *NATSKafkaBridge) ensureReconnectTimer() {
	if server.reconnectTimer != nil {
		server.logger.Debugf("reconnect timer is nil, stop reconnect retry")
		return
	}

	timer := newReconnectTimer()
	server.reconnectTimer = timer

	go func() {
		var doReconnect bool
		interval := server.config.ReconnectInterval

		doReconnect = <-timer.After(time.Duration(interval) * time.Millisecond)
		if !doReconnect {
			return
		}

		server.reconnectLock.Lock()
		defer server.reconnectLock.Unlock()

		// Wait for nats to be reconnected
		if !server.CheckNATS() {
			server.logger.Noticef("nats connection is down, will try reconnecting to NATS and restarting connectors in %d milliseconds", interval)
			server.reconnectTimer = nil
			server.ensureReconnectTimer()
			// Until we get a NATS connection, no point in continuing.
			return
		}

		// Do all the reconnects
		for id, connector := range server.reconnect {
			server.logger.Noticef("trying to restart connector %s", connector.String())
			err := connector.Start()
			if err != nil {
				server.logger.Noticef("error restarting connector %s, will retry in %d milliseconds, %s", connector.String(), interval, err.Error())
				continue
			}

			delete(server.reconnect, id)
		}

		server.reconnectTimer = nil

		if len(server.reconnect) > 0 {
			server.ensureReconnectTimer()
		}
	}()
}

// locks the reconnect lock
func (server *NATSKafkaBridge) stopReconnectTimer() {
	server.reconnectLock.Lock()
	defer server.reconnectLock.Unlock()

	if server.reconnectTimer != nil {
		server.reconnectTimer.Cancel()
	}

	server.reconnectTimer = nil
}

/*
func (server *NATSKafkaBridge) checkReconnecting() bool {
	server.reconnectLock.Lock()
	reconnecting := len(server.reconnect) > 0
	server.reconnectLock.Unlock()
	return reconnecting
}
*/
