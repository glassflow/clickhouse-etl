package repository

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

type kafkaSourceComponent struct {
	Brokers []string `json:"brokers"`

	SASLUser      string `json:"sasl_user"`
	SASLPassword  string `json:"sasl_password"`
	SASLMechanism string `json:"sasl_mechanism"`
	SASLProtocol  string `json:"sasl_protocol"`
	SkipAuth      bool   `json:"skip_auth"`

	TLSRoot string `json:"ca_cert"`

	Topic kafkaTopic `json:"topic"`
}

type kafkaTopic struct {
	Name                       string            `json:"name"`
	Schema                     kafkaTopicSchema  `json:"schema"`
	Deduplicate                deduplicateConfig `json:"dedup_config"`
	ConsumerGroupID            string            `json:"consumer_group_id"`
	ConsumerGroupInitialOffset string            `json:"consumer_group_initial_offset"`
}

type kafkaTopicSchema struct {
	Kind   string                  `json:"kind"`
	Fields []kafkaTopicSchemaField `json:"fields"`
}

type kafkaTopicSchemaField struct {
	Name     string `json:"name"`
	DataType string `json:"data_type"`
}

type deduplicateConfig struct {
	Enabled  bool   `json:"enabled"`
	Key      string `json:"key"`
	DataType string `json:"data_type"`
	Window   string `json:"window"`
}

func newKafkaSourceFromModel(m models.KafkaSourceComponent) (json.RawMessage, error) {
	//nolint: exhaustruct // schema is added later
	topic := kafkaTopic{
		Name: m.Topic.Name,
		Deduplicate: deduplicateConfig{
			Enabled:  m.Topic.Deduplicate.Enabled,
			Key:      m.Topic.Deduplicate.Key,
			DataType: m.Topic.Deduplicate.DataType,
			Window:   m.Topic.Deduplicate.Window.String(),
		},
		ConsumerGroupID:            m.Topic.ConsumerGroupID,
		ConsumerGroupInitialOffset: m.Topic.ConsumerGroupInitialOffset,
	}

	fields := []kafkaTopicSchemaField{}
	for _, f := range m.Topic.Schema.Fields {
		fields = append(fields, kafkaTopicSchemaField{
			Name:     f.Name,
			DataType: f.DataType.String(),
		})
	}

	topic.Schema = kafkaTopicSchema{
		Kind:   m.Topic.Schema.Kind.String(),
		Fields: fields,
	}

	//nolint: wrapcheck // no more context needed
	return json.Marshal(kafkaSourceComponent{
		Brokers:       m.Brokers,
		SASLUser:      m.SASLUser,
		SASLPassword:  m.SASLPassword,
		SASLMechanism: m.SASLMechanism,
		SASLProtocol:  m.SASLProtocol,
		SkipAuth:      m.SkipAuth,
		TLSRoot:       m.TLSRoot,
		Topic:         topic,
	})
}

func (k kafkaSourceComponent) ToComponent() (models.Component, error) {
	tsm := make(map[string]string)
	for _, f := range k.Topic.Schema.Fields {
		tsm[f.Name] = f.DataType
	}

	w, err := time.ParseDuration(k.Topic.Deduplicate.Window)
	if err != nil {
		return nil, fmt.Errorf("parse dedup window: %w", err)
	}

	ks, err := models.NewKafkaSourceComponent(models.KafkaSourceArgs{
		Servers:                    k.Brokers,
		SkipAuth:                   k.SkipAuth,
		SASLUser:                   k.SASLUser,
		SASLPassword:               k.SASLPassword,
		SASLMechanism:              k.SASLMechanism,
		Protocol:                   k.SASLProtocol,
		RootCert:                   k.TLSRoot,
		TopicName:                  k.Topic.Name,
		ConsumerGroupInitialOffset: k.Topic.ConsumerGroupInitialOffset,
		DedupEnabled:               k.Topic.Deduplicate.Enabled,
		DedupKey:                   k.Topic.Deduplicate.Key,
		DedupType:                  k.Topic.Deduplicate.DataType,
		DedupWindow:                w,
		SchemaKind:                 k.Topic.Schema.Kind,
		SchemaMap:                  tsm,
	})
	if err != nil {
		return nil, fmt.Errorf("parse kafka source from db: %w", err)
	}

	return ks, nil
}
