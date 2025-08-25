package models

import (
	"encoding/json"
	"fmt"
	"slices"
	"strings"
	"time"
)

const (
	GFJoinStream  = "gf-stream-joined"
	GFJoinSubject = "merged"

	DefaultSubjectName = ".input"

	KafkaIngestorType        = "kafka"
	TemporalJoinType         = "temporal"
	SchemaMapperJSONToCHType = "jsonToClickhouse"
	ClickHouseSinkType       = "clickhouse"
)

// PipelineStatus represents the overall status of a pipeline
type PipelineStatus string

const (
	PipelineStatusCreated     PipelineStatus = "Created"
	PipelineStatusRunning     PipelineStatus = "Running"
	PipelineStatusTerminating PipelineStatus = "Terminating"
	PipelineStatusTerminated  PipelineStatus = "Terminated"
	PipelineStatusFailed      PipelineStatus = "Failed"
)

// PipelineHealth represents the health status of a pipeline and its components
type PipelineHealth struct {
	PipelineID    string         `json:"pipeline_id"`
	PipelineName  string         `json:"pipeline_name"`
	OverallStatus PipelineStatus `json:"overall_status"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
}

type StreamDataField struct {
	FieldName string `json:"field_name"`
	FieldType string `json:"field_type"`
}

type StreamSchemaConfig struct {
	Fields          []StreamDataField `json:"fields"`
	JoinKeyField    string            `json:"join_key_field"`
	JoinOrientation string            `json:"join_orientation"`
	JoinWindow      JSONDuration      `json:"join_window"`
}

type SinkMappingConfig struct {
	ColumnName string `json:"column_name"`
	StreamName string `json:"stream_name"`
	FieldName  string `json:"field_name"`
	ColumnType string `json:"column_type"`
}

type MapperConfig struct {
	Type        string                        `json:"type" default:"jsonToClickhouse"`
	Streams     map[string]StreamSchemaConfig `json:"streams"`
	SinkMapping []SinkMappingConfig           `json:"sink_mapping"`
}

type KafkaConnectionParamsConfig struct {
	Brokers       []string `json:"brokers"`
	SkipAuth      bool     `json:"skip_auth"`
	SASLTLSEnable bool     `json:"sasl_tls_enable"`
	SASLProtocol  string   `json:"protocol"`
	SASLMechanism string   `json:"mechanism"`
	SASLUsername  string   `json:"username"`
	SASLPassword  string   `json:"password"`
	TLSRoot       string   `json:"root_ca"`
	TLSCert       string   `json:"tls_cert"`
	TLSKey        string   `json:"tls_key"`
	IAMEnable     bool     `json:"iam_enable"`
	IAMRegion     string   `json:"iam_region"`
}

type ConsumerGroupOffset string

const (
	InitialOffsetEarliest ConsumerGroupOffset = "earliest"
	InitialOffsetLatest   ConsumerGroupOffset = "latest"
)

func (o ConsumerGroupOffset) String() string {
	return string(o)
}

type DeduplicationConfig struct {
	Enabled bool   `json:"enabled"`
	ID      string `json:"id_field"`
	Type    string `json:"id_field_type"`

	Window JSONDuration `json:"time_window"`
}

type KafkaTopicsConfig struct {
	Name                       string `json:"name"`
	ID                         string `json:"id"`
	ConsumerGroupInitialOffset string `json:"consumer_group_initial_offset" default:"earliest"`

	Deduplication DeduplicationConfig `json:"deduplication"`
}

type IngestorOperatorConfig struct {
	Type                  string                      `json:"type"`
	Provider              string                      `json:"provider"`
	KafkaConnectionParams KafkaConnectionParamsConfig `json:"kafka_connection_params"`
	KafkaTopics           []KafkaTopicsConfig         `json:"kafka_topics"`
}

func NewIngestorOperatorConfig(provider string, conn KafkaConnectionParamsConfig, topics []KafkaTopicsConfig) (zero IngestorOperatorConfig, _ error) {
	if len(conn.Brokers) == 0 {
		return zero, PipelineConfigError{Msg: "must have at least one kafka server"}
	}

	for _, s := range conn.Brokers {
		if len(strings.TrimSpace(s)) == 0 {
			return zero, PipelineConfigError{Msg: "kafka server cannot be empty"}
		}
	}

	if strings.Trim(conn.SASLProtocol, " ") == "" {
		return zero, PipelineConfigError{Msg: "SASL protocol cannot be empty"}
	}

	switch conn.SASLProtocol {
	case "SASL_PLAINTEXT":
	case "PLAINTEXT":
	case "SASL_SSL":
	case "SSL":
	default:
		return zero, PipelineConfigError{Msg: fmt.Sprintf("Unsupported SASL protocol: %s; allowed: SASL_PLAINTEXT, PLAINTEXT, SASL_SSL, SSL", conn.SASLProtocol)}
	}

	// TODO: add validation for protocol w/o skipAuth
	if !conn.SkipAuth {
		if len(strings.TrimSpace(conn.SASLMechanism)) == 0 {
			return zero, PipelineConfigError{Msg: "SASL mechanism cannot be empty"}
		}
		if len(strings.TrimSpace(conn.SASLUsername)) == 0 {
			return zero, PipelineConfigError{Msg: "SASL username cannot be empty"}
		}
		if len(conn.SASLPassword) == 0 {
			return zero, PipelineConfigError{Msg: "SASL password cannot be empty"}
		}

		switch conn.SASLMechanism {
		case "SCRAM-SHA-256":
		case "SCRAM-SHA-512":
		case "PLAIN":
		default:
			return zero, PipelineConfigError{Msg: fmt.Sprintf("Unsupported SASL mechanism: %s; allowed: SCRAM-SHA-256, SCRAM-SHA-512, PLAIN", conn.SASLMechanism)}
		}
	}
	for i, kt := range topics {
		switch strings.ToLower(kt.ConsumerGroupInitialOffset) {
		case InitialOffsetEarliest.String():
		case InitialOffsetLatest.String():
		case "":
			topics[i].ConsumerGroupInitialOffset = InitialOffsetEarliest.String()
		default:
			return zero, PipelineConfigError{Msg: "invalid consumer_group_initial_offset; allowed values: `earliest` or `latest`"}
		}
	}

	return IngestorOperatorConfig{
		Type:     KafkaIngestorType,
		Provider: provider,
		KafkaConnectionParams: KafkaConnectionParamsConfig{
			Brokers:       conn.Brokers,
			SkipAuth:      conn.SkipAuth,
			SASLProtocol:  conn.SASLProtocol,
			SASLMechanism: conn.SASLMechanism,
			SASLUsername:  conn.SASLUsername,
			SASLPassword:  conn.SASLPassword,
			TLSRoot:       conn.TLSRoot,
		},
		KafkaTopics: topics,
	}, nil
}

type JoinSourceConfig struct {
	SourceID    string       `json:"source_id"`
	JoinKey     string       `json:"join_key"`
	Window      JSONDuration `json:"time_window"`
	Orientation string       `json:"orientation"`
}

type JoinOperatorConfig struct {
	Type    string             `json:"type"`
	Enabled bool               `json:"enabled"`
	Sources []JoinSourceConfig `json:"sources"`
}

type JoinOrder string

const (
	JoinLeft  JoinOrder = "left"
	JoinRight JoinOrder = "right"
)

func (jo JoinOrder) String() string {
	return string(jo)
}

func NewJoinOrder(s string) (zero JoinOrder, _ error) {
	switch s {
	case JoinLeft.String():
		return JoinLeft, nil
	case JoinRight.String():
		return JoinRight, nil
	default:
		return zero, fmt.Errorf("unsupported join order")
	}
}

const MaxStreamsSupportedWithJoin = 2

func NewJoinOperatorConfig(kind string, sources []JoinSourceConfig) (zero JoinOperatorConfig, _ error) {
	if kind != strings.ToLower(strings.TrimSpace(TemporalJoinType)) {
		return zero, PipelineConfigError{Msg: "invalid join type; only temporal joins are supported"}
	}

	if len(sources) != MaxStreamsSupportedWithJoin {
		return zero, PipelineConfigError{Msg: "join component must have two distinct sources"}
	}

	var seenJoinOrder []JoinOrder

	for _, so := range sources {
		if len(strings.TrimSpace(so.SourceID)) == 0 {
			return zero, PipelineConfigError{Msg: "join source cannot be empty"}
		}

		jo, err := NewJoinOrder(so.Orientation)
		if err != nil {
			return zero, PipelineConfigError{Msg: fmt.Sprintf("unsupported value %s for join orientation", so.Orientation)}
		}
		if !slices.Contains(seenJoinOrder, jo) {
			seenJoinOrder = append(seenJoinOrder, jo)
		} else {
			return zero, PipelineConfigError{Msg: "join sources cannot have same orientations"}
		}

		if len(strings.TrimSpace(so.JoinKey)) == 0 {
			return zero, PipelineConfigError{Msg: "join key cannot be empty"}
		}
	}

	return JoinOperatorConfig{
		Sources: sources,
		Type:    TemporalJoinType,
		Enabled: true,
	}, nil
}

type ClickHouseConnectionParamsConfig struct {
	Host                 string `json:"host"`
	Port                 string `json:"port"`      // native port used in BE connection
	HttpPort             string `json:"http_port"` // http port used by UI for FE connection
	Database             string `json:"database"`
	Username             string `json:"username"`
	Password             string `json:"password"`
	Table                string `json:"table"`
	Secure               bool   `json:"secure"`
	SkipCertificateCheck bool   `json:"skip_certificate_check"`
}

type BatchConfig struct {
	MaxBatchSize int          `json:"max_batch_size"`
	MaxDelayTime JSONDuration `json:"max_delay_time" default:"60s"`
}

type SinkOperatorConfig struct {
	Type  string      `json:"type"`
	Batch BatchConfig `json:"batch"`

	ClickHouseConnectionParams ClickHouseConnectionParamsConfig `json:"clickhouse_connection_params"`
}

type ClickhouseSinkArgs struct {
	Host                 string
	Port                 string
	HttpPort             string
	DB                   string
	User                 string
	Password             string
	Table                string
	Secure               bool
	MaxBatchSize         int
	MaxDelayTime         JSONDuration
	SkipCertificateCheck bool
}

func NewClickhouseSinkOperator(args ClickhouseSinkArgs) (zero SinkOperatorConfig, _ error) {
	if len(strings.TrimSpace(args.Host)) == 0 {
		return zero, PipelineConfigError{Msg: "clickhouse host cannot be empty"}
	}

	if len(strings.TrimSpace(args.Port)) == 0 {
		return zero, PipelineConfigError{Msg: "clickhouse port cannot be empty"}
	}

	if len(strings.TrimSpace(args.DB)) == 0 {
		return zero, PipelineConfigError{Msg: "clickhouse database cannot be empty"}
	}

	if len(strings.TrimSpace(args.User)) == 0 {
		return zero, PipelineConfigError{Msg: "clickhouse user cannot be empty"}
	}

	if len(args.Password) == 0 {
		return zero, PipelineConfigError{Msg: "clickhouse password cannot be empty"}
	}

	if len(strings.TrimSpace(args.Table)) == 0 {
		return zero, PipelineConfigError{Msg: "clickhouse table cannot be empty"}
	}

	if args.MaxBatchSize == 0 {
		return zero, PipelineConfigError{Msg: "clickhouse max_batch_size must be greater than 0"}
	}

	return SinkOperatorConfig{
		Type: ClickHouseSinkType,
		Batch: BatchConfig{
			MaxBatchSize: args.MaxBatchSize,
			MaxDelayTime: args.MaxDelayTime,
		},
		ClickHouseConnectionParams: ClickHouseConnectionParamsConfig{
			Host:                 args.Host,
			Port:                 args.Port,
			HttpPort:             args.HttpPort,
			Database:             args.DB,
			Username:             args.User,
			Password:             args.Password,
			Table:                args.Table,
			Secure:               args.Secure,
			SkipCertificateCheck: args.SkipCertificateCheck,
		},
	}, nil
}

type PipelineConfig struct {
	ID        string                 `json:"pipeline_id"`
	Name      string                 `json:"name"`
	Mapper    MapperConfig           `json:"mapper"`
	Ingestor  IngestorOperatorConfig `json:"ingestor"`
	Join      JoinOperatorConfig     `json:"join"`
	Sink      SinkOperatorConfig     `json:"sink"`
	CreatedAt time.Time              `json:"created_at"`
	Status    PipelineHealth         `json:"status,omitempty"`
}

func (pc PipelineConfig) ToListPipeline() ListPipelineConfig {
	transformation := IngestTransformation

	if pc.Join.Enabled {
		transformation = JoinTransformation
	}

	for _, t := range pc.Ingestor.KafkaTopics {
		if t.Deduplication.Enabled {
			if pc.Join.Enabled {
				transformation = DedupJoinTransformation
			} else {
				transformation = DedupTransformation
			}
		}
	}

	status := PipelineStatusCreated
	if pc.Status.OverallStatus != "" {
		status = pc.Status.OverallStatus
	}

	return ListPipelineConfig{
		ID:             pc.ID,
		Name:           pc.Name,
		Transformation: transformation,
		CreatedAt:      pc.CreatedAt,
		State:          "",
		Status:         status,
	}
}

type ListPipelineConfig struct {
	ID             string             `json:"pipeline_id"`
	Name           string             `json:"name"`
	Transformation TransformationType `json:"transformation_type"`
	CreatedAt      time.Time          `json:"created_at"`
	State          string             `json:"state"`
	Status         PipelineStatus     `json:"status"`
}

type TransformationType string

const (
	JoinTransformation      TransformationType = "Join"
	DedupJoinTransformation TransformationType = "Join & Deduplication"
	DedupTransformation     TransformationType = "Deduplication"
	IngestTransformation    TransformationType = "Ingest Only"
)

type PipelineConfigError struct {
	Msg string
}

func (e PipelineConfigError) Error() string {
	return "invalid pipeline config: " + e.Msg
}

func NewPipelineConfig(id, name string, mc MapperConfig, ic IngestorOperatorConfig, jc JoinOperatorConfig, sc SinkOperatorConfig) PipelineConfig {
	return PipelineConfig{
		ID:        id,
		Name:      name,
		Mapper:    mc,
		Ingestor:  ic,
		Join:      jc,
		Sink:      sc,
		CreatedAt: time.Now().UTC(),
		Status:    NewPipelineHealth(id, name),
	}
}

type JSONDuration struct {
	t time.Duration
}

func NewJSONDuration(d time.Duration) *JSONDuration {
	return &JSONDuration{t: d}
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

func (d JSONDuration) MarshalJSON() ([]byte, error) {
	//nolint: wrapcheck // no more error context needed
	return json.Marshal(d.String())
}

func (d JSONDuration) String() string {
	return d.t.String()
}

func (d JSONDuration) Duration() time.Duration {
	return d.t
}

func GetJoinedStreamName(pipelineID string) string {
	return fmt.Sprintf("%s-%s", GFJoinStream, pipelineID)
}

// NewPipelineHealth creates a new pipeline health status
func NewPipelineHealth(pipelineID, pipelineName string) PipelineHealth {
	now := time.Now().UTC()
	return PipelineHealth{
		PipelineID:    pipelineID,
		PipelineName:  pipelineName,
		OverallStatus: PipelineStatusCreated,
		CreatedAt:     now,
		UpdatedAt:     now,
	}
}

func GetNATSSubjectName(streamName string) string {
	return fmt.Sprintf("%s.%s", streamName, DefaultSubjectName)
}
