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
 */

package core

import (
	"bytes"
	"encoding/json"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"text/template"

	"github.com/IBM/sarama"
	"github.com/nats-io/nats.go"
	"github.com/nats-io/nuid"

	"github.com/glassflow/nats-kafka-bridge/server/conf"
	"github.com/glassflow/nats-kafka-bridge/server/kafka"
)

// Connector is the abstraction for all of the bridge connector types
type Connector interface {
	Start() error
	Shutdown() error

	CheckConnections() error

	String() string
	ID() string

	Stats() ConnectorStats
}

const dedupHeader = "Nats-Msg-Id"

func CreateConnector(config conf.ConnectorConfig, bridge *NATSKafkaBridge) Connector {
	return NewKafka2JetStreamConnector(bridge, config)
}

// BridgeConnector is the base type used for connectors so that they can share code
// The config, bridge and stats are all fixed at creation, so no lock is required on the
// connector at this level. The stats do keep a lock to protect their data.
// The connector has a lock for use by composing types to protect themselves during start/shutdown.
type BridgeConnector struct {
	sync.Mutex

	config       conf.ConnectorConfig
	bridge       *NATSKafkaBridge
	stats        *ConnectorStatsHolder
	destTemplate *template.Template
}

// Start is a no-op, designed for overriding
func (conn *BridgeConnector) Start() error {
	return nil
}

// Shutdown is a no-op, designed for overriding
func (conn *BridgeConnector) Shutdown() error {
	return nil
}

// CheckConnections is a no-op, designed for overriding
// This is called when nats or stan goes down
// the connector should return an error if it has to be shut down
func (conn *BridgeConnector) CheckConnections() error {
	return nil
}

// String returns the name passed into init
func (conn *BridgeConnector) String() string {
	return conn.stats.Name()
}

// ID returns the id from the stats
func (conn *BridgeConnector) ID() string {
	return conn.stats.ID()
}

// Stats returns a copy of the current stats for this connector
func (conn *BridgeConnector) Stats() ConnectorStats {
	return conn.stats.Stats()
}

// Init sets up common fields for all connectors
func (conn *BridgeConnector) init(bridge *NATSKafkaBridge, config conf.ConnectorConfig, destTpl string, name string) {
	conn.config = config
	conn.bridge = bridge

	id := conn.config.ID
	if id == "" {
		id = nuid.Next()
	}
	conn.stats = NewConnectorStatsHolder(name, id)

	conn.initDestTemplate(destTpl)
}

// NATSCallback used by conn-nats connectors in an conn library callback
// The lock will be held by the caller!
type NATSCallback func(msg kafka.Message) error

// ShutdownCallback is returned when setting up a callback or polling so the connector can shut it down
type ShutdownCallback func() error

func (conn *BridgeConnector) jetStreamMessageHandler(msg kafka.Message) error {
	nMsg := nats.NewMsg(conn.dest(msg))
	nMsg.Header = conn.convertFromKafkaToNatsHeaders(msg.Headers)

	if conn.config.DedupEnabled {
		err := setupDedupHeader(nMsg.Header, msg.Value, conn.config.DedupKey, conn.config.DedupKeyType)
		if err != nil {
			return fmt.Errorf("setup dedup headers: %w", err)
		}
	}

	if conn.config.Filter.Enabled {
		shouldFilter, err := checkFilter(msg.Value, conn.config.Filter)
		if err != nil {
			return fmt.Errorf("filter check: %w", err)
		}
		if shouldFilter {
			return nil
		}
	}

	nMsg.Data = msg.Value
	_, err := conn.bridge.JetStream().PublishMsg(nMsg)
	if err != nil {
		return fmt.Errorf("publish to jetstream: %w", err)
	}
	return nil
}

func (conn *BridgeConnector) calculateKey(subject string, replyto string) []byte {
	keyType := conn.config.KeyType
	keyValue := conn.config.KeyValue

	if keyType == conf.FixedKey {
		return []byte(keyValue)
	}

	if keyType == conf.SubjectKey {
		return []byte(subject)
	}

	if keyType == conf.ReplyToKey {
		return []byte(replyto)
	}

	if keyType == conf.SubjectRegex {
		r, err := regexp.Compile(keyValue)
		if err != nil {
			conn.bridge.logger.Noticef("invalid regex for %s key value", conn.String())
			return []byte{}
		}

		result := r.FindStringSubmatch(subject)

		if len(result) > 1 {
			return []byte(result[1])
		}

		return []byte{}
	}

	if keyType == conf.ReplyRegex {
		r, err := regexp.Compile(keyValue)
		if err != nil {
			conn.bridge.logger.Noticef("invalid regex for %s key value", conn.String())
			return []byte{}
		}

		result := r.FindStringSubmatch(replyto)

		if len(result) > 1 {
			return []byte(result[1])
		}

		return []byte{}
	}

	return []byte{} // empty key by default
}

func (conn *BridgeConnector) convertFromKafkaToNatsHeaders(hdrs []sarama.RecordHeader) nats.Header {
	// Iterate over all keys
	if len(hdrs) > 0 {
		nHdrs := make(nats.Header)
		for _, kHdr := range hdrs {
			if kHdr.Value != nil {
				nHdrs.Add(string(kHdr.Key), string(kHdr.Value))
			}
		}
		return nHdrs
	}
	return nats.Header{} // empty header by default
}

func (conn *BridgeConnector) initDestTemplate(destTpl string) {
	funcMap := template.FuncMap{
		"replace": func(o, n, src string) string {
			return strings.ReplaceAll(src, o, n)
		},
		"substring": func(start, end int, s string) string {
			if start < 0 {
				return s[:end]
			}
			if end < 0 || end > len(s) {
				return s[start:]
			}
			return s[start:end]
		},
	}
	var err error
	conn.destTemplate, err = template.New("dest").Funcs(funcMap).Parse(destTpl)
	if err != nil {
		conn.bridge.logger.Fatalf("parsing destination (subject, channel, topic) went wrong: %s", err)
	}
}

func (conn *BridgeConnector) dest(msg interface{}) string {
	var buf bytes.Buffer
	if err := conn.destTemplate.Execute(&buf, msg); err != nil {
		return ""
	}
	return buf.String()
}

// getNestedValue extracts a value from a nested JSON object using dot notation
// Example: getNestedValue(data, "user.address.city") would extract data["user"]["address"]["city"]
func getNestedValue(data map[string]interface{}, path string) (interface{}, bool) {
	if data == nil || path == "" {
		return nil, false
	}

	parts := strings.Split(path, ".")
	current := interface{}(data)

	for _, part := range parts {
		if current == nil {
			return nil, false
		}

		// Check if current is a map
		if mapValue, ok := current.(map[string]interface{}); ok {
			if val, exists := mapValue[part]; exists {
				current = val
			} else {
				return nil, false
			}
		} else {
			// Current is not a map, can't traverse further
			return nil, false
		}
	}

	return current, true
}

func setupDedupHeader(oHdr nats.Header, msg []byte, dedupKey, dedupKeyType string) error {
	data := make(map[string]interface{})
	err := json.Unmarshal(msg, &data)
	if err != nil {
		return fmt.Errorf("unmarshal kafka message: %w", err)
	}

	// Use getNestedValue to support nested JSON fields with dot notation
	value, exists := getNestedValue(data, dedupKey)
	if !exists {
		return fmt.Errorf("deduplication id field '%s' not found in kafka message", dedupKey)
	}

	switch dedupKeyType {
	case "string":
		if msgID, ok := value.(string); ok {
			oHdr[dedupHeader] = []string{msgID}
		} else {
			return fmt.Errorf("string deduplication id missing in kafka message")
		}
	case "int":
		// json always marshalls numbers as float64
		if msgID, ok := value.(float64); ok {
			oHdr[dedupHeader] = []string{strconv.Itoa(int(msgID))}
		} else {
			return fmt.Errorf("integer deduplication id missing in kafka message")
		}
	default:
		return fmt.Errorf("unsupported format for deduplication ID")
	}

	return nil
}

// checkFilter evaluates filter conditions against a Kafka message
func checkFilter(msg []byte, filter conf.FilterConfig) (bool, error) {
	if !filter.Enabled {
		return false, nil
	}

	data := make(map[string]interface{})
	err := json.Unmarshal(msg, &data)
	if err != nil {
		return false, fmt.Errorf("unmarshal kafka message: %w", err)
	}

	value, exists := getNestedValue(data, filter.Field)
	if !exists {
		return false, nil
	}

	valueStr := fmt.Sprintf("%v", value)
	switch filter.Operator {
	case conf.FilterOperatorEquals:
		return valueStr == filter.Value, nil
	case conf.FilterOperatorNotEquals:
		return valueStr != filter.Value, nil
	default:
		return false, fmt.Errorf("unsupported filter operator: %s", filter.Operator)
	}
}
