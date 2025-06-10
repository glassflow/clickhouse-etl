package models

import (
	"fmt"
	"slices"
	"strings"
	"time"
)

type SupportedSchemaType string

const JSONSchema SupportedSchemaType = "json"

func (s SupportedSchemaType) String() string {
	return string(s)
}

type KafkaSourceComponent struct {
	Brokers []string

	SASLUser      string
	SASLPassword  string
	SASLMechanism string
	SASLProtocol  string
	SASLTLSEnable bool
	SkipAuth      bool

	TLSRoot string

	Topic kafkaTopic

	inputs  []Component
	outputs []Component
}

type kafkaTopic struct {
	Name                       string
	Schema                     kafkaTopicSchema
	Deduplicate                DeduplicateConfig
	ConsumerGroupID            string
	ConsumerGroupInitialOffset string
}

type kafkaTopicSchema struct {
	Kind   SupportedSchemaType
	Fields []kafkaTopicSchemaField
}

type kafkaTopicSchemaField struct {
	Name     string
	DataType kafkaDataType
}

type kafkaDataType string

func (c kafkaDataType) String() string {
	return string(c)
}

const (
	KafkaInt8    kafkaDataType = "int8"
	KafkaInt16   kafkaDataType = "int16"
	KafkaInt32   kafkaDataType = "int32"
	KafkaInt64   kafkaDataType = "int64"
	KafkaFloat32 kafkaDataType = "float32"
	KafkaFloat64 kafkaDataType = "float64"
	KafkaString  kafkaDataType = "string"
	KafkaBool    kafkaDataType = "bool"
	KafkaBytes   kafkaDataType = "bytes"
)

func newKafkaDataType(s string) (zero kafkaDataType, _ error) {
	switch strings.ToLower(s) {
	case KafkaInt8.String():
		return KafkaInt8, nil
	case KafkaInt16.String():
		return KafkaInt16, nil
	case KafkaInt32.String():
		return KafkaInt32, nil
	case KafkaInt64.String():
		return KafkaInt64, nil
	case KafkaFloat32.String():
		return KafkaFloat32, nil
	case KafkaFloat64.String():
		return KafkaFloat64, nil
	case KafkaString.String():
		return KafkaString, nil
	case KafkaBool.String():
		return KafkaBool, nil
	case KafkaBytes.String():
		return KafkaBytes, nil
	default:
		return zero, fmt.Errorf("unsupported kafka datatype")
	}
}

type DeduplicateConfig struct {
	Enabled  bool
	Key      string
	DataType string
	Window   time.Duration
}

func (k *KafkaSourceComponent) Validate() error {
	return nil
}

func (k *KafkaSourceComponent) SetInputs(comps []Component) {
	k.inputs = comps
}

func (k *KafkaSourceComponent) SetOutputs(comps []Component) {
	k.outputs = comps
}

func (k *KafkaSourceComponent) GetInputs() []Component {
	return k.inputs
}

func (k *KafkaSourceComponent) GetOutputs() []Component {
	return k.outputs
}

func (k *KafkaSourceComponent) ID() string {
	return "kafka-source-" + k.Topic.Name
}

type KafkaSourceArgs struct {
	Servers                    []string
	SkipAuth                   bool
	SASLUser                   string
	SASLPassword               string
	SASLMechanism              string
	Protocol                   string
	RootCert                   string
	TopicName                  string
	ConsumerGroupInitialOffset string
	DedupEnabled               bool
	DedupKey                   string
	DedupType                  string
	DedupWindow                time.Duration
	SchemaKind                 string
	SchemaMap                  map[string]string
}

func NewKafkaSourceComponent(a KafkaSourceArgs) (*KafkaSourceComponent, error) {
	if len(a.Servers) == 0 {
		return nil, PipelineConfigError{msg: "must have at least one kafka server"}
	}

	for _, s := range a.Servers {
		if len(strings.TrimSpace(s)) == 0 {
			return nil, PipelineConfigError{msg: "kafka server cannot be empty"}
		}
	}

	if strings.Trim(a.Protocol, " ") == "" {
		return nil, PipelineConfigError{msg: "SASL protocol cannot be empty"}
	}

	switch a.Protocol {
	case "SASL_PLAINTEXT":
	case "PLAINTEXT":
	case "SASL_SSL":
	case "SSL":
	default:
		return nil, PipelineConfigError{msg: fmt.Sprintf("Unsupported SASL protocol: %s; allowed: SASL_PLAINTEXT, PLAINTEXT, SASL_SSL, SSL", a.Protocol)}
	}

	// TODO: add validation for protocol w/o skipAuth
	if !a.SkipAuth {
		if len(strings.TrimSpace(a.SASLMechanism)) == 0 {
			return nil, PipelineConfigError{msg: "SASL mechanism cannot be empty"}
		}
		if len(strings.TrimSpace(a.SASLUser)) == 0 {
			return nil, PipelineConfigError{msg: "SASL username cannot be empty"}
		}
		if len(a.SASLPassword) == 0 {
			return nil, PipelineConfigError{msg: "SASL password cannot be empty"}
		}

		switch a.SASLMechanism {
		case "SCRAM-SHA-256":
		case "SCRAM-SHA-512":
		case "PLAIN":
		default:
			return nil, PipelineConfigError{msg: fmt.Sprintf("Unsupported SASL mechanism: %s; allowed: SCRAM-SHA-256, SCRAM-SHA-512, PLAIN", a.SASLMechanism)}
		}
	}

	topicSchema, err := newKafkaTopicSchema(a.SchemaKind, a.SchemaMap, a.DedupEnabled, a.DedupKey, a.DedupType)
	if err != nil {
		return nil, err
	}

	topic, err := newKafkaTopic(a.TopicName, a.ConsumerGroupInitialOffset, a.DedupEnabled, a.DedupKey, a.DedupType, a.DedupWindow, topicSchema)
	if err != nil {
		return nil, err
	}

	//nolint: exhaustruct // don't set private fields
	return &KafkaSourceComponent{
		Brokers:       a.Servers,
		SASLUser:      a.SASLUser,
		SASLPassword:  a.SASLPassword,
		SASLMechanism: a.SASLMechanism,
		SASLProtocol:  a.Protocol,
		SASLTLSEnable: a.Protocol == "SASL_SSL" || a.Protocol == "SSL",
		SkipAuth:      a.SkipAuth,
		TLSRoot:       a.RootCert,
		Topic:         topic,
	}, nil
}

func newKafkaTopic(name, groupInitialOffset string, dedupEnabled bool, dedupKey, dedupType string, dedupWindow time.Duration, schema kafkaTopicSchema) (zero kafkaTopic, _ error) {
	switch strings.ToLower(groupInitialOffset) {
	case "earliest":
	case "latest":
	default:
		return zero, PipelineConfigError{msg: "invalid consumer_group_initial_offset; allowed values: `earliest` or `latest`"}
	}

	return kafkaTopic{
		Name:   name,
		Schema: schema,
		Deduplicate: DeduplicateConfig{
			Enabled:  dedupEnabled,
			Key:      dedupKey,
			DataType: dedupType,
			Window:   dedupWindow,
		},
		ConsumerGroupID:            name,
		ConsumerGroupInitialOffset: groupInitialOffset,
	}, nil
}

func newKafkaTopicSchema(
	kind string,
	fmap map[string]string,
	dedupEnabled bool,
	dedupField string,
	dedupType string,
) (zero kafkaTopicSchema, _ error) {
	if kind != string(JSONSchema) {
		return zero, PipelineConfigError{msg: "kafka only supports json schema"}
	}

	fields := []kafkaTopicSchemaField{}
	var dedupFieldSeen bool

	for k, v := range fmap {
		if len(strings.TrimSpace(k)) == 0 {
			return zero, PipelineConfigError{msg: "kafka topic's schema fields cannot be empty"}
		}

		if dedupField == k {
			dedupFieldSeen = true
		}

		dt, err := newKafkaDataType(v)
		if err != nil {
			return zero, PipelineConfigError{msg: "unsuppored kafka data type: " + v}
		}

		f := kafkaTopicSchemaField{
			Name:     k,
			DataType: dt,
		}
		fields = append(fields, f)
	}

	if dedupEnabled {
		if !dedupFieldSeen {
			return zero, PipelineConfigError{msg: "topic schema must contain specified dedup key"}
		}

		if !slices.Contains([]string{"string", "int"}, dedupType) {
			return zero, PipelineConfigError{msg: "unsupported dedup key type"}
		}
	}

	return kafkaTopicSchema{
		Kind:   JSONSchema,
		Fields: fields,
	}, nil
}
