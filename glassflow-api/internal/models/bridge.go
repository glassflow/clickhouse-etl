package models

import (
	"encoding/json"
	"fmt"
	"time"
)

type BridgeSpec struct {
	Topic        string
	DedupWindow  time.Duration
	DedupKey     string
	DedupKeyType string

	ConsumerGroupID            string
	ConsumerGroupInitialOffset string

	Stream  string
	Subject string
}

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

type TopicConfig struct {
	Name                       string
	DedupWindow                time.Duration
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
