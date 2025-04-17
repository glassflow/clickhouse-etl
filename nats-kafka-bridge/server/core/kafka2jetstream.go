/*
 * Copyright 2019-2021 The NATS Authors
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
 */

package core

import (
	"fmt"
	"time"

	"github.com/glassflow/nats-kafka-bridge/server/conf"
	"github.com/glassflow/nats-kafka-bridge/server/kafka"
)

// Kafka2JetStreamConnector connects Kafka topic to JetStream
type Kafka2JetStreamConnector struct {
	BridgeConnector

	reader     kafka.Consumer
	shutdownCB ShutdownCallback
}

// NewKafka2JetStreamConnector create a new Kafka to JetStream connector
func NewKafka2JetStreamConnector(bridge *NATSKafkaBridge, config conf.ConnectorConfig) Connector {
	//nolint: exhaustruct // building config
	connector := &Kafka2JetStreamConnector{}
	connector.init(bridge, config, config.Subject, fmt.Sprintf("Kafka:%s to JetStream:%s", config.Topic, config.Subject))
	return connector
}

// Start the connector
func (conn *Kafka2JetStreamConnector) Start() error {
	conn.Lock()
	defer conn.Unlock()

	if !conn.bridge.CheckJetStream() {
		return fmt.Errorf("%s connector requires JetStream to be available", conn.String())
	}

	conn.bridge.Logger().Tracef("starting connection %s", conn.String())

	var err error
	dialTimeout := time.Duration(conn.bridge.config.ConnectTimeout) * time.Millisecond
	conn.reader, err = kafka.NewConsumer(conn.config, dialTimeout)
	if err != nil {
		return fmt.Errorf("failed to create consumer: %w", err)
	}
	if s, ok := conn.reader.(interface{ NetInfo() string }); ok {
		conn.bridge.Logger().Debugf(s.NetInfo())
	}

	cb := conn.setUpListener(conn.reader, conn.jetStreamMessageHandler)
	conn.shutdownCB = cb

	conn.stats.AddConnect()
	conn.bridge.Logger().Tracef("opened and reading %s", conn.config.Topic)
	conn.bridge.Logger().Noticef("started connection %s", conn.String())

	return nil
}

// Shutdown the connector
func (conn *Kafka2JetStreamConnector) Shutdown() error {
	conn.Lock()
	defer conn.Unlock()
	conn.stats.AddDisconnect()

	conn.bridge.Logger().Noticef("shutting down connection %s", conn.String())

	if conn.shutdownCB != nil {
		if err := conn.shutdownCB(); err != nil {
			conn.bridge.Logger().Noticef("error stopping listen routine for %s, %s", conn.String(), err.Error())
		}
		conn.shutdownCB = nil
	}

	reader := conn.reader
	conn.reader = nil

	if reader != nil {
		if err := reader.Close(); err != nil {
			conn.bridge.Logger().Noticef("error closing reader for %s, %s", conn.String(), err.Error())
		}
	}

	return nil // ignore the disconnect error
}

// CheckConnections ensures the nats/stan connection and report an error if it is down
func (conn *Kafka2JetStreamConnector) CheckConnections() error {
	if !conn.bridge.CheckJetStream() {
		return fmt.Errorf("%s connector requires nats jetstream to be available", conn.String())
	}
	return nil
}
