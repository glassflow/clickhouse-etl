package models

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
)

type PipelineRequest struct {
	PipelineID string `json:"pipeline_id"`
	Source     struct {
		Provider         string `json:"provider"`
		ConnectionParams struct {
			Brokers       []string `json:"brokers"`
			SASLProtocol  string   `json:"protocol"`
			SASLMechanism string   `json:"mechanism"`
			SASLUsername  string   `json:"username"`
			SASLPassword  string   `json:"password"`
			TLSKey        string   `json:"key"`
			TLSCert       string   `json:"cert"`
			TLSRoot       string   `json:"root_ca"`
			IAMEnable     bool     `json:"iam_enable"`
			IAMRegion     string   `json:"iam_region"`
		} `json:"connection_params"`
		Topics []struct {
			Topic  string `json:"name"`
			ID     string `json:"id"`
			Schema struct {
				Type   string `json:"type"`
				Fields []struct {
					Name     string `json:"name"`
					DataType string `json:"type"`
				} `json:"fields"`
			} `json:"schema"`
			ConsumerGroupInitialOffset consumerGroupOffset `json:"consumer_group_initial_offset" default:"earliest"`

			Deduplication struct {
				Enabled bool `json:"enabled"`

				ID     string       `json:"id_field"`
				Type   string       `json:"id_field_type"`
				Window JSONDuration `json:"time_window"`
			} `json:"deduplication"`
		} `json:"topics"`
	} `json:"source"`
	Join struct {
		Type    string `json:"type"`
		Enabled bool   `json:"enabled"`

		Sources []struct {
			SourceID    string          `json:"source_id"`
			JoinKey     string          `json:"join_key"`
			Window      JSONDuration    `json:"time_window"`
			Orientation joinOrientation `json:"orientation"`
		} `json:"sources"`
	} `json:"join"`
	Sink struct {
		// Add validation for null/empty values
		Host     string `json:"host"`
		Port     string `json:"port"`
		Database string `json:"database"`
		Username string `json:"username"`
		Password string `json:"password"`
		Table    string `json:"table"`
		Secure   bool   `json:"secure"`
		Mapping  []struct {
			SourceID  string `json:"source_id"`
			FieldName string `json:"field_name"`

			ColumnName string `json:"column_name"`
			ColumnType string `json:"column_type"`
		} `json:"table_mapping"`

		// Add validation for range
		MaxBatchSize int          `json:"max_batch_size"`
		MaxDelayTime JSONDuration `json:"max_delay_time" default:"60s"`
	} `json:"sink"`
}

var (
	ErrJoinOrientationCannotBeEmpty      = errors.New("join order cannot be empty")
	ErrInvalidJoinOrientation            = errors.New("join order is invalid; allowed values: `left` or `right`")
	ErrInvalidConsumerGroupInitialOffset = errors.New("offset value is invalid; allowed values: `earliest` or `latest`")
)

type PipelineConfigError struct {
	msg string
}

func (e PipelineConfigError) Error() string {
	return "invalid pipeline config: " + e.msg
}

const (
	MaxStreamsSupportedWithJoin    = 2
	MinStreamsSupportedWithoutJoin = 1
)

type Pipeline struct {
	ID               string
	KafkaConfig      KafkaConfig
	Streams          []StreamConfig
	ClickhouseConfig ClickhouseConfig
}

type StreamConfig struct {
	Name          string
	Subject       string
	Source        KafkaTopic
	Deduplication DedupConfig
	Join          JoinConfig
	Schema        []SchemaField
}

type KafkaTopic struct {
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

func NewPipeline(req *PipelineRequest) (*Pipeline, error) {
	if err := validateBrokers(req.Source.ConnectionParams.Brokers); err != nil {
		return nil, err
	}

	if err := validateConnectionParams(req.Source.ConnectionParams.SASLMechanism, req.Source.ConnectionParams.SASLProtocol, req.Source.ConnectionParams.SASLUsername, req.Source.ConnectionParams.SASLPassword); err != nil {
		return nil, err
	}

	if !req.Join.Enabled && len(req.Source.Topics) != MinStreamsSupportedWithoutJoin {
		return nil, PipelineConfigError{msg: "Kafka to clickhouse sink supports only one topic"}
	}

	var (
		joinSources joinSources
		err         error
	)

	if req.Join.Enabled {
		joinSources, err = parseJoinSources(req)
		if err != nil {
			return nil, err
		}
	}

	conParams := req.Source.ConnectionParams

	//nolint: exhaustruct // ssl is added conditionally
	kCfg := KafkaConfig{
		Brokers:       conParams.Brokers,
		SASLUser:      conParams.SASLUsername,
		SASLPassword:  conParams.SASLPassword,
		SASLMechanism: conParams.SASLMechanism,

		IAMEnable: conParams.IAMEnable,
		IAMRegion: conParams.IAMRegion,

		TLSCert: conParams.TLSCert,
		TLSKey:  conParams.TLSKey,
		TLSRoot: conParams.TLSRoot,
	}
	if conParams.SASLProtocol == "SASL_SSL" {
		kCfg.SASLTLSEnable = true
	}

	streams := make([]StreamConfig, len(req.Source.Topics))
	streamSourceToNameMap := make(map[string]string)

	if len(req.Source.Topics) == 0 {
		return nil, PipelineConfigError{msg: "atleast one topic must be provided"}
	}
	for i, t := range req.Source.Topics {
		if t.Topic == "" {
			return nil, PipelineConfigError{msg: "topic value cannot be empty"}
		}

		if len(t.Schema.Fields) == 0 {
			return nil, PipelineConfigError{msg: "topic schema must have at least one value"}
		}

		if t.Deduplication.Enabled {
			switch t.Deduplication.Type {
			case "string":
			case "int":
			default:
				return nil, PipelineConfigError{msg: fmt.Sprintf("unsupported type for deduplication id field: %s; supported values %q, %q", t.Deduplication.Type, "string", "int")}
			}
		}

		name := fmt.Sprintf("gf-stream-%s-%s", t.Topic, uuid.New())

		streamSourceToNameMap[t.Topic] = name

		//nolint: exhaustruct // schemaconfig is added later
		stream := StreamConfig{
			Name:    name,
			Subject: fmt.Sprintf("%s.%s", name, "input"),
			Source: KafkaTopic{
				Name:                       t.Topic,
				ConsumerGroupInitialOffset: t.ConsumerGroupInitialOffset.String(),
			},
			Deduplication: DedupConfig{
				Enabled: t.Deduplication.Enabled,
				ID:      t.Deduplication.ID,
				Type:    t.Deduplication.Type,
				Window:  t.Deduplication.Window.Duration(),
			},
		}

		if req.Join.Enabled {
			joinCfg, ok := joinSources[t.Topic]
			if !ok {
				return nil, PipelineConfigError{msg: "join config missing source: " + t.Topic}
			}

			stream.Join = joinCfg
		}

		var fields []SchemaField
		for _, s := range t.Schema.Fields {
			f := SchemaField{
				Name:     s.Name,
				DataType: s.DataType,
			}
			fields = append(fields, f)
		}

		stream.Schema = fields

		streams[i] = stream
	}

	//nolint: exhaustruct // mappings are added later
	chCfg := ClickhouseConfig{
		Host:     req.Sink.Host,
		Port:     req.Sink.Port,
		Database: req.Sink.Database,
		Username: req.Sink.Username,
		Password: req.Sink.Password,
		Table:    req.Sink.Table,
		Secure:   req.Sink.Secure,

		MaxBatchSize: req.Sink.MaxBatchSize,
		MaxDelayTime: req.Sink.MaxDelayTime.Duration(),
	}

	mappings := make([]KafkaToClickhouseMap, len(req.Sink.Mapping))
	for i, m := range req.Sink.Mapping {
		mapping := KafkaToClickhouseMap{
			StreamName: streamSourceToNameMap[m.SourceID],
			FieldName:  m.FieldName,

			ColumnName: m.ColumnName,
			ColumnType: m.ColumnType,
		}
		mappings[i] = mapping
	}

	chCfg.Mapping = mappings

	return &Pipeline{
		ID:               req.PipelineID,
		KafkaConfig:      kCfg,
		Streams:          streams,
		ClickhouseConfig: chCfg,
	}, nil
}

type joinSources map[string]JoinConfig

type joinOrientation string

func (o *joinOrientation) UnmarshalJSON(b []byte) error {
	var rawValue string

	err := json.Unmarshal(b, &rawValue)
	if err != nil {
		return fmt.Errorf("unable to unmarshal join orientation: %w", err)
	}

	if rawValue == "" {
		//nolint: wrapcheck // custom internal errors
		return ErrJoinOrientationCannotBeEmpty
	}

	switch strings.ToLower(rawValue) {
	case "left":
		*o = LeftJoin
	case "right":
		*o = RightJoin
	default:
		//nolint: wrapcheck // custom internal errors
		return ErrInvalidJoinOrientation
	}

	return nil
}

func (o joinOrientation) String() string {
	return string(o)
}

const (
	LeftJoin  joinOrientation = "left"
	RightJoin joinOrientation = "right"
)

type consumerGroupOffset string

func (c *consumerGroupOffset) UnmarshalJSON(v []byte) error {
	var rawValue string

	err := json.Unmarshal(v, &rawValue)
	if err != nil {
		return fmt.Errorf("unable to unmarshal consumer group initial offset: %w", err)
	}

	switch strings.ToLower(rawValue) {
	case "earliest":
		*c = "earliest"
	case "latest":
		*c = "latest"
	default:
		//nolint: wrapcheck // custom internal errors
		return ErrInvalidConsumerGroupInitialOffset
	}

	return nil

}

func (c consumerGroupOffset) String() string {
	return string(c)
}

func parseJoinSources(req *PipelineRequest) (zero joinSources, _ error) {
	if len(req.Source.Topics) != MaxStreamsSupportedWithJoin {
		return zero, PipelineConfigError{msg: "invalid join config: kafka to clickhouse sink supports exactly 2 topics"}
	}

	if len(req.Source.Topics) != len(req.Join.Sources) {
		return zero, PipelineConfigError{msg: "number of kafka topics and join sources must be exactly 2"}
	}

	js := make(joinSources)

	for _, s := range req.Join.Sources {
		js[s.SourceID] = JoinConfig{
			Enabled:     req.Join.Enabled,
			ID:          s.JoinKey,
			Window:      s.Window.Duration(),
			Orientation: s.Orientation.String(),
		}
	}

	// both orientations cannot be the same
	if req.Join.Sources[0].Orientation == req.Join.Sources[1].Orientation {
		return zero, PipelineConfigError{
			msg: fmt.Sprintf("the join sources cannot have same orientations - one must be %q and other must be %q", LeftJoin, RightJoin),
		}
	}

	// incase same source name is provided twice
	if len(js) < MaxStreamsSupportedWithJoin {
		return zero, PipelineConfigError{
			msg: "the join sources must match the topics provided as kafka source",
		}
	}

	return js, nil
}

func validateBrokers(bl []string) error {
	if len(bl) == 0 {
		return PipelineConfigError{msg: "kafka source must have at least one broker"}
	}

	for _, b := range bl {
		if len(b) == 0 {
			return PipelineConfigError{msg: "kafka broker values cannot be empty"}
		}
	}

	return nil
}

func validateConnectionParams(mechanism, protocol, username, password string) error {
	if strings.Trim(mechanism, " ") == "" {
		return PipelineConfigError{msg: "SASL mechanism cannot be empty"}
	}
	if strings.Trim(protocol, " ") == "" {
		return PipelineConfigError{msg: "SASL protocol cannot be empty"}
	}
	if strings.Trim(username, " ") == "" {
		return PipelineConfigError{msg: "SASL username cannot be empty"}
	}
	if password == "" {
		return PipelineConfigError{msg: "SASL password cannot be empty"}
	}

	switch mechanism {
	case "SCRAM-SHA-256":
	case "SCRAM-SHA-512":
	case "PLAIN":
	default:
		return PipelineConfigError{msg: fmt.Sprintf("Unsupported SASL mechanism: %s; allowed: SCRAM-SHA-256, SCRAM-SHA-512, PLAIN", mechanism)}
	}

	switch protocol {
	case "SASL_SSL":
	case "SASL_PLAINTEXT":
	default:
		return PipelineConfigError{msg: fmt.Sprintf("Unsupported SASL protocol: %s; allowed: SASL_PLAINTEXT, SASL_SSL", protocol)}
	}

	return nil
}
