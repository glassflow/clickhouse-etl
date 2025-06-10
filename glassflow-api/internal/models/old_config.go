package models

import (
	"encoding/json"
	"fmt"
	"time"
)

// NOTE: old way of config setup that still has references in some components.
// Will go away with the new implementation of bridge
type KafkaConfig struct {
	Brokers []string

	// kafka auth
	IAMEnable     bool
	IAMRegion     string
	SASLUser      string
	SASLPassword  string
	SASLMechanism string
	SASLTLSEnable bool

	TLSKey  string
	TLSRoot string
	TLSCert string
}

type StreamConfig struct {
	Name          string
	Subject       string
	Source        Topic
	Deduplication DedupConfig
	Join          JoinConfig
	Schema        []SchemaField
}

type Topic struct {
	Name                       string
	ConsumerGroupInitialOffset string
}

type DedupConfig struct {
	Enabled bool

	ID     string
	Type   string
	Window time.Duration
}

type JoinConfig struct {
	Enabled bool

	ID          string
	Window      time.Duration
	Orientation string
}

type SchemaField struct {
	Name     string
	DataType string
}

type ClickhouseConfig struct {
	Host     string
	Port     string
	Database string
	Username string
	Password string
	Secure   bool
	Table    string
	Mapping  []KafkaToClickhouseMap

	MaxBatchSize int
	MaxDelayTime time.Duration
}

type KafkaToClickhouseMap struct {
	StreamName string
	FieldName  string

	ColumnName string
	ColumnType string
}

type BridgeSpec struct {
	Topic        string
	DedupEnabled bool
	DedupWindow  time.Duration
	DedupKey     string
	DedupKeyType string

	ConsumerGroupID            string
	ConsumerGroupInitialOffset string

	Stream  string
	Subject string
}

type TopicConfig struct {
	Name                       string
	DedupWindow                time.Duration
	DedupEnabled               bool
	DedupKey                   string
	DedupKeyType               string
	ConsumerGroupID            string
	ConsumerGroupInitialOffset string
}

type NatsConfig struct {
	Server  string
	Subject string
	Stream  string
}

type JSONDuration struct {
	t time.Duration
}

func (d *JSONDuration) UnmarshalJSON(b []byte) error {
	var rawValue any

	err := json.Unmarshal(b, &rawValue)
	if err != nil {
		return fmt.Errorf("unable to unmarshal duration: %w", err)
	}

	switch val := rawValue.(type) {
	case string:
		var err error
		d.t, err = time.ParseDuration(val)
		if err != nil {
			return fmt.Errorf("unable to parse as duration: %w", err)
		}
	default:
		return fmt.Errorf("invalid duration: %#v", rawValue)
	}

	return nil
}

func (d *JSONDuration) String() string {
	return d.t.String()
}

func (d *JSONDuration) Duration() time.Duration {
	return d.t
}

type SchemaMapper struct {
	Streams     map[string]StreamSchema
	SinkMapping []SchemaMapperMapping
}

type SchemaMapperMapping struct {
	ColumnName string
	ColumnType string

	StreamName string
	FieldName  string
}

type StreamSchema struct {
	Fields []struct {
		FieldName string
		FieldType string
	}
	JoinKey string
}

type Clickhouse struct {
	Address  string
	Database string
	Username string
	Password string
	Table    string
}
