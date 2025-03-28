package models

import (
	"encoding/json"
	"fmt"
	"time"
)

type KafkaConfig struct {
	Brokers []string

	// kafka auth
	IAMEnable     bool
	IAMRegion     string
	SASLUser      string
	SASLPassword  string
	SASLMechanism string
	SASLTLSEnable bool
}

type TopicConfig struct {
	Name                       string
	DedupWindow                Duration
	DedupKey                   string
	DedupKeyType               string
	ConsumerGroupID            string
	ConsumerGroupInitialOffset string
}

type Duration struct {
	t time.Duration
}

func (d *Duration) UnmarshalJSON(b []byte) error {
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

func (d *Duration) String() string {
	return d.t.String()
}
