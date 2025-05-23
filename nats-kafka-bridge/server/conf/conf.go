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

package conf

import (
	"bytes"
	"crypto/tls"
	"crypto/x509"
	"encoding"
	"encoding/base64"
	"fmt"
	"os"
	"time"

	"github.com/glassflow/nats-kafka-bridge/server/logging"
)

const (
	// Hash can be used in the connector config to set the hash balancing method
	Hash = "hash"
	// LeastBytes can be used in the connector config to set the least bytes received balancing method
	LeastBytes = "leastbytes"
)

const (
	// FixedKey in the keytype causes the key to always be the value in keyvalue
	FixedKey = "fixed"
	// SubjectKey in the keytype causes the key to be the incoming subject or channel
	SubjectKey = "subject"
	// ReplyToKey in the keytype causes the key to be the incoming reply-to subject or durable name
	ReplyToKey = "reply"
	// SubjectRegex in the keytype causes the key to use the keyvalue as a regex
	// on the incoming subject or channel and take the first match group as the key
	// for example foo\.(.*) for the subject/channel foo.bar would use "bar" as the key
	SubjectRegex = "subjectre"
	// ReplyRegex in the keytype causes the key to use the keyvalue as a regex
	// on the incoming reply-to and take the first match group as the key
	// for example foo\.(.*) for the subject/durable foo.bar would use "bar" as the key
	ReplyRegex = "replyre"
)

const (
	// KafkaToNATS specifies a connector from Kafka to NATS
	KafkaToNATS = "KafkaToNATS"
	// KafkaToStan specifies a connector from Kafka to NATS streaming
	KafkaToStan = "KafkaToStan"
	// KafkaToJetStream specifies a connector from Kafka to JetStream
	KafkaToJetStream = "KafkaToJetStream"

	// NATSToKafka specifies a connector from NATS to Kafka
	NATSToKafka = "NATSToKafka"
	// STANToKafka specifies a connector from NATS streaming to Kafka
	STANToKafka = "STANToKafka"
	// JetStreamToKafka specifies a connector from JetStream to Kafka
	JetStreamToKafka = "JetStreamToKafka"
)

// NATSKafkaBridgeConfig is the root structure for a bridge configuration file.
type NATSKafkaBridgeConfig struct {
	ReconnectInterval int // milliseconds
	ConnectTimeout    int // milliseconds, connect timeout for Kafka connections

	Logging    logging.Config
	NATS       NATSConfig
	JetStream  JetStreamConfig
	Monitoring HTTPConfig
	Connect    []ConnectorConfig
}

// TLSConf holds the configuration for a TLS connection/server
type TLSConf struct {
	Key  string
	Cert string
	Root string
}

// SASL holds the configuration for SASL authentication with Kafka.
type SASL struct {
	User               string
	Password           string
	InsecureSkipVerify bool
	Mechanism          string
	TLS                bool
}

type SASLMechanism string

func (s SASLMechanism) String() string {
	return string(s)
}

const (
	MechanismSHA256 SASLMechanism = "SCRAM-SHA-256"
	MechanismSHA512 SASLMechanism = "SCRAM-SHA-512"
)

type IAM struct {
	Enable bool
	Region string
}

// MakeTLSConfig creates a tls.Config from a TLSConf, setting up the key pairs and certs
func (tlsConf *TLSConf) MakeTLSConfig() (*tls.Config, error) {
	if tlsConf.Cert == "" && tlsConf.Key == "" && tlsConf.Root == "" {
		//nolint: nilnil // don't need sentinel error
		return nil, nil
	}

	//nolint: exhaustruct // optional config
	config := tls.Config{
		MinVersion:               tls.VersionTLS12,
		ClientAuth:               tls.NoClientCert,
		PreferServerCipherSuites: true,
	}

	if tlsConf.Root != "" {
		// Load CA cert
		caCert, err := os.ReadFile(tlsConf.Root)
		if err != nil {
			return nil, fmt.Errorf("read tls root: %w", err)
		}
		caCertPool := x509.NewCertPool()
		caCertPool.AppendCertsFromPEM(caCert)
		config.RootCAs = caCertPool
	}

	if tlsConf.Cert != "" || tlsConf.Key != "" {
		cert, err := tls.LoadX509KeyPair(tlsConf.Cert, tlsConf.Key)
		if err != nil {
			return nil, fmt.Errorf("error loading X509 certificate/key pair: %w", err)
		}

		cert.Leaf, err = x509.ParseCertificate(cert.Certificate[0])
		if err != nil {
			return nil, fmt.Errorf("error parsing certificate: %w", err)
		}

		config.Certificates = []tls.Certificate{cert}
	}

	return &config, nil
}

// MakeTLSConfig creates a tls.Config from a TLSConf, setting up the key pairs
// and certs from env vars
func (tlsConf *TLSConf) MakeTLSConfigFromStrings() (*tls.Config, error) {
	if tlsConf.Cert == "" && tlsConf.Key == "" && tlsConf.Root == "" {
		//nolint: nilnil // don't need sentinel error
		return nil, nil
	}

	//nolint: exhaustruct // optional config
	config := tls.Config{
		MinVersion:               tls.VersionTLS12,
		ClientAuth:               tls.NoClientCert,
		PreferServerCipherSuites: true,
	}

	if tlsConf.Root != "" {
		// Load CA cert
		caCert, err := base64.StdEncoding.DecodeString(tlsConf.Root)
		if err != nil {
			return nil, fmt.Errorf("base64 decode tls root: %w", err)
		}
		caCertPool := x509.NewCertPool()
		caCertPool.AppendCertsFromPEM(caCert)
		config.RootCAs = caCertPool
	}

	if tlsConf.Cert != "" || tlsConf.Key != "" {
		cert, err := base64.StdEncoding.DecodeString(tlsConf.Cert)
		if err != nil {
			return nil, fmt.Errorf("base64 decode tls cert: %w", err)
		}

		key, err := base64.StdEncoding.DecodeString(tlsConf.Key)
		if err != nil {
			return nil, fmt.Errorf("base64 decode tls cert: %w", err)
		}

		tlsCert, err := tls.X509KeyPair(cert, key)
		if err != nil {
			return nil, fmt.Errorf("error loading X509 certificate/key pair: %w", err)
		}

		tlsCert.Leaf, err = x509.ParseCertificate(tlsCert.Certificate[0])
		if err != nil {
			return nil, fmt.Errorf("error parsing certificate: %w", err)
		}

		config.Certificates = []tls.Certificate{tlsCert}
	}

	return &config, nil
}

// HTTPConfig is used to specify the host/port/tls for an HTTP server
type HTTPConfig struct {
	HTTPHost  string
	HTTPPort  int
	HTTPSPort int
	TLS       TLSConf

	ReadTimeout  int // milliseconds
	WriteTimeout int // milliseconds
}

// NATSConfig configuration for a NATS connection
type NATSConfig struct {
	Servers []string

	ConnectTimeout int // milliseconds
	ReconnectWait  int // milliseconds
	MaxReconnects  int

	TLS             TLSConf
	UserCredentials string
}

// JetStreamConfig configuration for a JetStream connection
type JetStreamConfig struct {
	PublishAsyncMaxPending int
	MaxWait                int // milliseconds
	EnableFlowControl      bool
	EnableAckSync          bool
	HeartbeatInterval      int // milliseconds
}

// DefaultBridgeConfig generates a default configuration with
// logging set to colors, time, debug and trace
func DefaultBridgeConfig(logColors, logTime bool) NATSKafkaBridgeConfig {
	//nolint: exhaustruct // default config
	return NATSKafkaBridgeConfig{
		ReconnectInterval: 5000,
		ConnectTimeout:    10000,
		Logging: logging.Config{
			Colors: logColors,
			Time:   logTime,
			Debug:  true,
			Trace:  true,
		},
		Monitoring: HTTPConfig{
			ReadTimeout:  5000,
			WriteTimeout: 5000,
		},
		NATS: NATSConfig{
			ConnectTimeout: 5000,
			ReconnectWait:  1000,
			MaxReconnects:  0,
		},
	}
}

// ConnectorConfig configuration for a bridge connection (of any type)
type ConnectorConfig struct {
	ID   string // user specified id for a connector, will be defaulted if none is provided
	Type string // Can be any of the type constants (STANToKafka, ...)

	Channel         string // Used for stan connections
	DurableName     string // Optional, used for stan and jetstream connections
	StartAtSequence int64  // Start position for stan and jetstream connection, -1 means StartWithLastReceived, 0 means DeliverAllAvailable (default)
	StartAtTime     int64  // Start time, as Unix, time takes precedence over sequence
	DedupEnabled    bool
	DedupWindow     time.Duration
	DedupKey        string
	DedupKeyType    string

	Subject   string // Used for nats and jetstream connections
	QueueName string // Optional, used for nats connections
	Stream    string // Uses BindStream option for JetStream to consume from sourced streams

	Brokers []string // list of brokers to use for creating a reader/writer
	Topic   string   // kafka topic
	TLS     TLSConf  // tls config for connecting to the kafka brokers
	SASL    SASL     // SASL config for connecting to the kafka brokers, specifically EventHub
	IAM     IAM      // IAM config for connecting to kafka brokers

	MinBytes      int32           // used by the Kafka reader (for kafka->nats connectors)
	MaxBytes      int32           // used by the Kafka reader (for kafka->nats connectors)
	Partition     int32           // optional partition for the reader
	GroupID       string          // optional group id for reader, exclusive with partition
	InitialOffset CGInitialOffset // optional initial offset for group mode, defaults to newest (-1)

	Balancer string // can be hash or leastbytes

	KeyType  string // what to do with the key, can be FixedKey, ...
	KeyValue string // extra data for handling the key based on the keytype, may be ignored

	SchemaRegistryURL string // Schema registry url for message schema validation
	SubjectName       string // Name of the subject in the schema registry for the value
	SchemaVersion     int    // Version of the value schema to use. Default is latest.
	SchemaType        string // Can be avro, json, protobuf. Default is avro.
}

type CGInitialOffset string

const (
	Latest   CGInitialOffset = "latest"
	Earliest CGInitialOffset = "earliest"
)

var _ encoding.TextUnmarshaler = (*CGInitialOffset)(nil)

// UnmarshalText implements encoding.TextUnmarshaler.
func (o *CGInitialOffset) UnmarshalText(text []byte) error {
	switch string(bytes.ToLower(text)) {
	case "latest", "":
		*o = Latest
	case "earliest":
		*o = Earliest
	default:
		return fmt.Errorf("unsupported initial offset for consumer group: %q", text)
	}
	return nil
}
