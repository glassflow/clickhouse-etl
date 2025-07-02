package models

import "time"

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

type KafkaConfig struct {
	Brokers []string

	// kafka auth
	SASLUser      string
	SASLPassword  string
	SASLMechanism string
	SASLTLSEnable bool

	TLSRoot string
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
