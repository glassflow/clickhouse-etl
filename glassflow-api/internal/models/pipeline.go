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
			ConsumerGroupInitialOffset string `json:"consumer_group_initial_offset"`

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
	ErrUnsupportedNumberOfTopics     = errors.New("number of topics must be 1 for kafka to clickhouse sink")
	ErrAmbiguousTopicsProvided       = errors.New("invalid topics configuration; ambiguous sources for join operator")
	ErrSameJoinOrientations          = errors.New("join sources must be exactly two, one with left and other with right order")
	ErrInvalidJoinTopicConfiguration = errors.New("number of topics and join sources must be exactly 2")
	ErrJoinOrientationCannotBeEmpty  = errors.New("join order cannot be empty")
	ErrInvalidJoinOrientation        = errors.New("join order is invalid; allowed values: `left` or `right`")
	ErrEmptyKafkaBrokers             = errors.New("kafka brokers must not be empty")
)

type UnsupportedNumberOfTopicsForJoinError struct {
	allowedTopics  int
	providedTopics int
}

func (e UnsupportedNumberOfTopicsForJoinError) Error() string {
	return fmt.Sprintf("unsupported number of topics for joins - supported: %d, provided: %d", e.allowedTopics, e.providedTopics)
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

	if !req.Join.Enabled && len(req.Source.Topics) > MinStreamsSupportedWithoutJoin {
		//nolint: wrapcheck // custom internal errors
		return nil, ErrUnsupportedNumberOfTopics
	}

	if len(req.Source.ConnectionParams.Brokers) == 0 {
		//nolint: wrapcheck // custom internal errors
		return nil, ErrEmptyKafkaBrokers
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

	for i, t := range req.Source.Topics {
		name := fmt.Sprintf("gf-stream-%s-%s", t.Topic, uuid.New())

		streamSourceToNameMap[t.Topic] = name

		//nolint: exhaustruct // schemaconfig is added later
		stream := StreamConfig{
			Name:    name,
			Subject: fmt.Sprintf("%s.%s", name, "input"),
			Source: KafkaTopic{
				Name:                       t.Topic,
				ConsumerGroupInitialOffset: t.ConsumerGroupInitialOffset,
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
				return nil, fmt.Errorf("join config missing source: %s", t.Topic)
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

func parseJoinSources(req *PipelineRequest) (zero joinSources, _ error) {
	if len(req.Source.Topics) != MaxStreamsSupportedWithJoin {
		return zero, UnsupportedNumberOfTopicsForJoinError{
			allowedTopics:  MaxStreamsSupportedWithJoin,
			providedTopics: len(req.Source.Topics),
		}
	}

	if len(req.Source.Topics) != len(req.Join.Sources) {
		//nolint: wrapcheck // custom internal errors
		return zero, ErrInvalidJoinTopicConfiguration
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
		//nolint: wrapcheck // custom internal errors
		return zero, ErrSameJoinOrientations
	}

	// incase same source name is provided twice
	if len(js) < MaxStreamsSupportedWithJoin {
		//nolint: wrapcheck // custom internal errors
		return zero, ErrAmbiguousTopicsProvided
	}

	return js, nil
}
