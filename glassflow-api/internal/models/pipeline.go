package models

import (
	"crypto/sha256"
	"fmt"
	"slices"
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
			SkipAuth      bool     `json:"skip_auth"`
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
			ConsumerGroupInitialOffset string `json:"consumer_group_initial_offset" default:"earliest"`

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
			SourceID    string       `json:"source_id"`
			JoinKey     string       `json:"join_key"`
			Window      JSONDuration `json:"time_window"`
			Orientation string       `json:"orientation"`
		} `json:"sources"`
	} `json:"join"`
	Sink struct {
		// Add validation for null/empty values
		Host                        string `json:"host"`
		Port                        string `json:"port"`
		Database                    string `json:"database"`
		Username                    string `json:"username"`
		Password                    string `json:"password"`
		Table                       string `json:"table"`
		Secure                      bool   `json:"secure"`
		SkipCertificateVerification bool   `json:"skip_certificate_verification"`

		Mapping []struct {
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
	Host                 string
	Port                 string
	Database             string
	Username             string
	Password             string
	Secure               bool
	SkipCertificateCheck bool
	Table                string
	Mapping              []KafkaToClickhouseMap

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
	if req.PipelineID == "" {
		return nil, PipelineConfigError{msg: "Pipeline ID cannot be empty"}
	}

	if err := validateBrokers(req.Source.ConnectionParams.Brokers); err != nil {
		return nil, err
	}

	if !req.Source.ConnectionParams.SkipAuth {
		if err := validateKafkaConnectionParams(req.Source.ConnectionParams.SASLMechanism, req.Source.ConnectionParams.SASLUsername, req.Source.ConnectionParams.SASLPassword, req.Source.ConnectionParams.SASLProtocol); err != nil {
			return nil, err
		}
	}

	if !req.Join.Enabled && len(req.Source.Topics) != MinStreamsSupportedWithoutJoin {
		return nil, PipelineConfigError{msg: "Kafka to clickhouse sink supports only one topic"}
	}

	if req.Sink.MaxBatchSize == 0 {
		return nil, PipelineConfigError{msg: "Max batch size for clickhouse sink must be greater than 0"}
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
	if slices.Contains([]string{"SASL_SSL", "SSL"}, conParams.SASLProtocol) {
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

		// Generate full stream name first, then hash it using SHA256
		fullName := fmt.Sprintf("%s-%s", t.Topic, uuid.New())

		// Hash the full name using SHA256 and take first 8 bytes (16 hex characters)
		hash := sha256.Sum256([]byte(fullName))
		name := fmt.Sprintf("gf-stream-%x", hash[:8])

		streamSourceToNameMap[t.Topic] = name
		initialOffset, err := newConsumerGroupInitialOffset(t.ConsumerGroupInitialOffset)
		if err != nil {
			return nil, err
		}

		//nolint: exhaustruct // schemaconfig is added later
		stream := StreamConfig{
			Name:    name,
			Subject: fmt.Sprintf("%s.%s", name, "input"),
			Source: KafkaTopic{
				Name:                       t.Topic,
				ConsumerGroupInitialOffset: initialOffset.String(),
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
		Host:                 req.Sink.Host,
		Port:                 req.Sink.Port,
		Database:             req.Sink.Database,
		Username:             req.Sink.Username,
		Password:             req.Sink.Password,
		Table:                req.Sink.Table,
		Secure:               req.Sink.Secure,
		SkipCertificateCheck: req.Sink.SkipCertificateVerification,

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

func parseJoinSources(req *PipelineRequest) (zero joinSources, _ error) {
	if len(req.Source.Topics) != MaxStreamsSupportedWithJoin {
		return zero, PipelineConfigError{msg: "invalid join config: kafka to clickhouse sink supports exactly 2 topics"}
	}

	if len(req.Source.Topics) != len(req.Join.Sources) {
		return zero, PipelineConfigError{msg: "number of kafka topics and join sources must be exactly 2"}
	}

	js := make(joinSources)

	for _, s := range req.Join.Sources {
		if len(strings.TrimSpace(s.JoinKey)) == 0 {
			return nil, PipelineConfigError{msg: "join key cannot be empty"}
		}

		orientation, err := newJoinOrientation(s.Orientation)
		if err != nil {
			return nil, err
		}

		js[s.SourceID] = JoinConfig{
			Enabled:     req.Join.Enabled,
			ID:          s.JoinKey,
			Window:      s.Window.Duration(),
			Orientation: orientation.String(),
		}
	}

	// both orientations cannot be the same
	if req.Join.Sources[0].Orientation == req.Join.Sources[1].Orientation {
		return zero, PipelineConfigError{
			msg: fmt.Sprintf("join sources cannot have same orientations - one must be %q and other must be %q", OrientationLeft, OrientationRight),
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
		if len(strings.TrimSpace(b)) == 0 {
			return PipelineConfigError{msg: "kafka broker values cannot be empty"}
		}
	}

	return nil
}

func validateKafkaConnectionParams(mechanism, username, password, protocol string) error {
	if strings.Trim(mechanism, " ") == "" {
		return PipelineConfigError{msg: "SASL mechanism cannot be empty"}
	}
	if strings.Trim(username, " ") == "" {
		return PipelineConfigError{msg: "SASL username cannot be empty"}
	}
	if password == "" {
		return PipelineConfigError{msg: "SASL password cannot be empty"}
	}
	if strings.Trim(protocol, " ") == "" {
		return PipelineConfigError{msg: "SASL protocol cannot be empty"}
	}

	switch protocol {
	case "SASL_SSL":
	case "SASL_PLAINTEXT":
	case "SSL":
	case "PLAINTEXT":
	default:
		return PipelineConfigError{msg: fmt.Sprintf("Unsupported SASL protocol: %s; allowed: SASL_PLAINTEXT, PLAINTEXT, SASL_SSL, SSL", protocol)}
	}

	switch mechanism {
	case "SCRAM-SHA-256", "SCRAM-SHA-512":
		if !slices.Contains([]string{"SASL_SSL", "SASL_PLAINTEXT"}, protocol) {
			return PipelineConfigError{msg: fmt.Sprintf("Unsupported protocol %q for SASL mechanism; allowed protocols: SASL_PLAINTEXT, SASL_SSL", protocol)}
		}
	case "PLAIN":
	default:
		return PipelineConfigError{msg: fmt.Sprintf("Unsupported SASL mechanism: %s; allowed: SCRAM-SHA-256, SCRAM-SHA-512, PLAIN", mechanism)}
	}

	return nil
}

type ConsumerGroupInitialOffset string

const (
	InitialOffsetEarliest ConsumerGroupInitialOffset = "earliest"
	InitialOffsetLatest   ConsumerGroupInitialOffset = "latest"
)

func (c ConsumerGroupInitialOffset) String() string {
	return string(c)
}

func newConsumerGroupInitialOffset(o string) (zero ConsumerGroupInitialOffset, _ error) {
	switch strings.ToLower(o) {
	case "earliest":
		return InitialOffsetEarliest, nil
	case "latest":
		return InitialOffsetLatest, nil
	default:
		return zero, PipelineConfigError{msg: "invalid consumer_group_initial_offset; allowed values: `earliest` or `latest`"}
	}
}

type JoinOrientation string

const (
	OrientationLeft  JoinOrientation = "left"
	OrientationRight JoinOrientation = "right"
)

func (c JoinOrientation) String() string {
	return string(c)
}

func newJoinOrientation(o string) (zero JoinOrientation, _ error) {
	switch strings.ToLower(o) {
	case "left":
		return OrientationLeft, nil
	case "right":
		return OrientationRight, nil
	default:
		return zero, PipelineConfigError{msg: "invalid orientation for join; allowed values: `left` or `right`"}
	}
}
