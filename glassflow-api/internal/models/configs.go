package models

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/danielgtaylor/huma/v2"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
)

// PipelineStatus represents the overall status of a pipeline
type PipelineStatus string

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
	SASLMechanism string   `json:"mechanism,omitempty"`
	SASLUsername  string   `json:"username,omitempty"`
	SASLPassword  string   `json:"password,omitempty"`
	TLSRoot       string   `json:"root_ca,omitempty"`
	TLSCert       string   `json:"tls_cert,omitempty"`
	TLSKey        string   `json:"tls_key,omitempty"`

	KerberosServiceName string `json:"kerberos_service_name,omitempty"`
	KerberosRealm       string `json:"kerberos_realm,omitempty"`
	KerberosKeytab      string `json:"kerberos_keytab,omitempty"`
	KerberosConfig      string `json:"kerberos_config,omitempty"`
}

type ConsumerGroupOffset string

func (o ConsumerGroupOffset) String() string {
	return string(o)
}

type DeduplicationConfig struct {
	Enabled bool   `json:"enabled"`
	ID      string `json:"id_field,omitempty"`
	Type    string `json:"id_field_type,omitempty"`

	Window JSONDuration `json:"time_window,omitempty"`
}

type KafkaTopicsConfig struct {
	Name                       string `json:"name"`
	ID                         string `json:"id"`
	ConsumerGroupInitialOffset string `json:"consumer_group_initial_offset" default:"earliest"`
	ConsumerGroupName          string `json:"consumer_group_name"`
	Replicas                   int    `json:"replicas" default:"1"`

	Deduplication       DeduplicationConfig `json:"deduplication,omitempty"`
	OutputStreamID      string              `json:"output_stream_id"`
	OutputStreamSubject string              `json:"output_stream_subject"`
}

type IngestorComponentConfig struct {
	Type                  string                      `json:"type"`
	Provider              string                      `json:"provider"`
	KafkaConnectionParams KafkaConnectionParamsConfig `json:"kafka_connection_params"`
	KafkaTopics           []KafkaTopicsConfig         `json:"kafka_topics"`
}

func NewIngestorComponentConfig(provider string, conn KafkaConnectionParamsConfig, topics []KafkaTopicsConfig) (zero IngestorComponentConfig, _ error) {
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
		if len(conn.SASLPassword) == 0 && conn.SASLMechanism != internal.MechanismKerberos {
			return zero, PipelineConfigError{Msg: "SASL password cannot be empty"}
		}

		switch conn.SASLMechanism {
		case internal.MechanismSHA256:
		case internal.MechanismSHA512:
		case internal.MechanismKerberos:
			if len(strings.TrimSpace(conn.KerberosServiceName)) == 0 ||
				len(strings.TrimSpace(conn.KerberosRealm)) == 0 ||
				len(strings.TrimSpace(conn.KerberosKeytab)) == 0 ||
				len(strings.TrimSpace(conn.KerberosConfig)) == 0 {
				return zero, PipelineConfigError{Msg: "Kerberos configuration fields cannot be empty"}
			}
		case internal.MechanismPlain:
		default:
			return zero, PipelineConfigError{Msg: fmt.Sprintf("Unsupported SASL mechanism: %s; allowed: SCRAM-SHA-256, SCRAM-SHA-512, PLAIN", conn.SASLMechanism)}
		}
	}

	if conn.SASLTLSEnable {
		if len(strings.TrimSpace(conn.TLSCert)) == 0 && len(strings.TrimSpace(conn.TLSKey)) == 0 && len(strings.TrimSpace(conn.TLSRoot)) == 0 {
			return zero, PipelineConfigError{Msg: "TLS certificate cannot be empty when SASL TLS is enabled"}
		}
	}

	for i, kt := range topics {
		switch strings.ToLower(kt.ConsumerGroupInitialOffset) {
		case internal.InitialOffsetEarliest:
		case internal.InitialOffsetLatest:
		case "":
			topics[i].ConsumerGroupInitialOffset = internal.InitialOffsetEarliest
		default:
			return zero, PipelineConfigError{Msg: "invalid consumer_group_initial_offset; allowed values: `earliest` or `latest`"}
		}

		// Validate and set default for replicas
		if kt.Replicas <= 0 {
			topics[i].Replicas = 1 // Default to 1 replica
		}
	}

	return IngestorComponentConfig{
		Type:     internal.KafkaIngestorType,
		Provider: provider,
		KafkaConnectionParams: KafkaConnectionParamsConfig{
			Brokers:             conn.Brokers,
			SkipAuth:            conn.SkipAuth,
			SASLProtocol:        conn.SASLProtocol,
			SASLMechanism:       conn.SASLMechanism,
			SASLUsername:        conn.SASLUsername,
			SASLPassword:        conn.SASLPassword,
			SASLTLSEnable:       conn.SASLTLSEnable,
			TLSRoot:             conn.TLSRoot,
			TLSCert:             conn.TLSCert,
			TLSKey:              conn.TLSKey,
			KerberosServiceName: conn.KerberosServiceName,
			KerberosRealm:       conn.KerberosRealm,
			KerberosKeytab:      conn.KerberosKeytab,
			KerberosConfig:      conn.KerberosConfig,
		},
		KafkaTopics: topics,
	}, nil
}

type JoinSourceConfig struct {
	SourceID    string       `json:"source_id"`
	StreamID    string       `json:"stream_id"`
	JoinKey     string       `json:"join_key"`
	Window      JSONDuration `json:"time_window"`
	Orientation string       `json:"orientation"`
}

type JoinComponentConfig struct {
	Type           string             `json:"type"`
	Enabled        bool               `json:"enabled"`
	Sources        []JoinSourceConfig `json:"sources"`
	OutputStreamID string             `json:"output_stream_id"`

	NATSLeftConsumerName  string       `json:"nats_left_consumer_name"`
	NATSRightConsumerName string       `json:"nats_right_consumer_name"`
	LeftBufferTTL         JSONDuration `json:"left_buffer_ttl"`
	RightBufferTTL        JSONDuration `json:"right_buffer_ttl"`
}

type JoinOrder string

func (jo JoinOrder) String() string {
	return string(jo)
}

func NewJoinOrder(s string) (zero JoinOrder, _ error) {
	switch s {
	case internal.JoinLeft:
		return JoinOrder(internal.JoinLeft), nil
	case internal.JoinRight:
		return JoinOrder(internal.JoinRight), nil
	default:
		return zero, fmt.Errorf("unsupported join order")
	}
}

func NewJoinComponentConfig(kind string, sources []JoinSourceConfig) (zero JoinComponentConfig, _ error) {
	if kind != strings.ToLower(strings.TrimSpace(internal.TemporalJoinType)) {
		return zero, PipelineConfigError{Msg: "invalid join type; only temporal joins are supported"}
	}

	if len(sources) != internal.MaxStreamsSupportedWithJoin {
		return zero, PipelineConfigError{Msg: "join component must have two distinct sources"}
	}

	var seenJoinOrder []JoinOrder

	for _, so := range sources {
		if len(strings.TrimSpace(so.SourceID)) == 0 {
			return zero, PipelineConfigError{Msg: "join source cannot be empty"}
		}

		if len(strings.TrimSpace(so.StreamID)) == 0 {
			return zero, PipelineConfigError{Msg: "join stream_id cannot be empty"}
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

	// Compute TTL values from sources' time_window
	var leftBufferTTL, rightBufferTTL JSONDuration
	for _, source := range sources {
		if source.Orientation == internal.JoinLeft {
			leftBufferTTL = source.Window
		} else if source.Orientation == internal.JoinRight {
			rightBufferTTL = source.Window
		}
	}

	return JoinComponentConfig{
		Sources:        sources,
		Type:           internal.TemporalJoinType,
		Enabled:        true,
		LeftBufferTTL:  leftBufferTTL,
		RightBufferTTL: rightBufferTTL,
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

type ClickhouseQueryConfig struct {
	WaitForAsyncInsert bool `json:"wait_for_async_insert`
}

type BatchConfig struct {
	MaxBatchSize int          `json:"max_batch_size"`
	MaxDelayTime JSONDuration `json:"max_delay_time"`
}

type SinkComponentConfig struct {
	Type     string      `json:"type"`
	StreamID string      `json:"stream_id"`
	Batch    BatchConfig `json:"batch"`

	NATSConsumerName string `json:"nats_consumer_name"`

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
	StreamID             string
	MaxBatchSize         int
	MaxDelayTime         JSONDuration
	SkipCertificateCheck bool
}

func NewClickhouseSinkComponent(args ClickhouseSinkArgs) (zero SinkComponentConfig, _ error) {
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

	if len(strings.TrimSpace(args.StreamID)) == 0 {
		return zero, PipelineConfigError{Msg: "stream_id cannot be empty"}
	}

	maxDelayTime := args.MaxDelayTime
	if maxDelayTime.Duration() == 0 {
		maxDelayTime = JSONDuration{t: 60 * time.Second}
	}

	return SinkComponentConfig{
		Type:     internal.ClickHouseSinkType,
		StreamID: args.StreamID,
		Batch: BatchConfig{
			MaxBatchSize: args.MaxBatchSize,
			MaxDelayTime: maxDelayTime,
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

type FilterComponentConfig struct {
	Enabled    bool   `json:"enabled"`
	Expression string `json:"expression"`
}

type PipelineConfig struct {
	ID        string                  `json:"pipeline_id"`
	Name      string                  `json:"name"`
	Mapper    MapperConfig            `json:"mapper"`
	Ingestor  IngestorComponentConfig `json:"ingestor"`
	Join      JoinComponentConfig     `json:"join"`
	Sink      SinkComponentConfig     `json:"sink"`
	Filter    FilterComponentConfig   `json:"filter"`
	CreatedAt time.Time               `json:"created_at"`
	Status    PipelineHealth          `json:"status,omitempty"`
}

func (pc PipelineConfig) ToListPipeline() ListPipelineConfig {
	transformation := internal.IngestTransformation

	if pc.Join.Enabled {
		transformation = internal.JoinTransformation
	}

	for _, t := range pc.Ingestor.KafkaTopics {
		if t.Deduplication.Enabled {
			if pc.Join.Enabled {
				transformation = internal.DedupJoinTransformation
			} else {
				transformation = internal.DedupTransformation
			}
		}
	}

	status := PipelineStatus(internal.PipelineStatusCreated)
	if pc.Status.OverallStatus != "" {
		status = pc.Status.OverallStatus
	}

	return ListPipelineConfig{
		ID:             pc.ID,
		Name:           pc.Name,
		Transformation: TransformationType(transformation),
		CreatedAt:      pc.CreatedAt,
		UpdatedAt:      pc.Status.UpdatedAt,
		Status:         status,
	}
}

type ListPipelineConfig struct {
	ID             string             `json:"pipeline_id"`
	Name           string             `json:"name"`
	Transformation TransformationType `json:"transformation_type"`
	CreatedAt      time.Time          `json:"created_at"`
	UpdatedAt      time.Time          `json:"updated_at"`
	Status         PipelineStatus     `json:"status"`
}

type TransformationType string

type PipelineConfigError struct {
	Msg string
}

func (e PipelineConfigError) Error() string {
	return "invalid pipeline config: " + e.Msg
}

func NewPipelineConfig(
	id, name string,
	mc MapperConfig,
	ic IngestorComponentConfig,
	jc JoinComponentConfig,
	sc SinkComponentConfig,
	filterConfig FilterComponentConfig,
) PipelineConfig {
	return PipelineConfig{
		ID:        id,
		Name:      name,
		Mapper:    mc,
		Ingestor:  ic,
		Join:      jc,
		Sink:      sc,
		Filter:    filterConfig,
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

// convertDaysToHours converts day units to hours in duration strings
// since Go's time.ParseDuration doesn't support 'd' unit
func convertDaysToHours(duration string) string {
	// Use regex to find day patterns and convert them to hours
	// This handles patterns like "1d", "2d", "1d12h", "1d30m", etc.
	dayPattern := `(\d+)d`
	re := regexp.MustCompile(dayPattern)

	return re.ReplaceAllStringFunc(duration, func(match string) string {
		// Extract the number of days
		dayStr := strings.TrimSuffix(match, "d")
		days, err := strconv.Atoi(dayStr)
		if err != nil {
			return match // Return original if parsing fails
		}
		// Convert days to hours (1 day = 24 hours)
		hours := days * 24
		return fmt.Sprintf("%dh", hours)
	})
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
		// Convert day units to hours since Go's time.ParseDuration doesn't support 'd'
		convertedVal := convertDaysToHours(val)
		d.t, err = time.ParseDuration(convertedVal)
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

// Schema implements huma.SchemaProvider to tell Huma that this type should be represented as a string
func (d JSONDuration) Schema(r huma.Registry) *huma.Schema {
	return &huma.Schema{
		Type:        "string",
		Format:      "duration",
		Description: "Duration in Go format (e.g., '5m', '1h30m', '24h'). Supports 'd' for days.",
	}
}

func (d JSONDuration) String() string {
	return d.t.String()
}

func (d JSONDuration) Duration() time.Duration {
	return d.t
}

func GetJoinedStreamName(pipelineID string) string {
	hash := GenerateStreamHash(pipelineID)
	return fmt.Sprintf("%s-%s-%s", internal.PipelineStreamPrefix, hash, "joined")
}

// NewPipelineHealth creates a new pipeline health status
func NewPipelineHealth(pipelineID, pipelineName string) PipelineHealth {
	now := time.Now().UTC()
	return PipelineHealth{
		PipelineID:    pipelineID,
		PipelineName:  pipelineName,
		OverallStatus: PipelineStatus(internal.PipelineStatusCreated),
		CreatedAt:     now,
		UpdatedAt:     now,
	}
}

func GetNATSSubjectName(streamName, subjectName string) string {
	return fmt.Sprintf("%s.%s", streamName, subjectName)
}

func GetNATSSubjectNameDefault(streamName string) string {
	return GetNATSSubjectName(streamName, internal.DefaultSubjectName)
}

func GetWildcardNATSSubjectName(streamName string) string {
	return GetNATSSubjectName(streamName, "*")
}

func SanitizeNATSSubject(topicName string) string {
	return strings.ReplaceAll(topicName, ".", "_")
}

func GenerateStreamHash(pipelineID string) string {
	hash := sha256.Sum256([]byte(pipelineID))
	// Use first 8 characters of hash for shorter stream names
	return hex.EncodeToString(hash[:])[:8]
}

func GetIngestorStreamName(pipelineID, topicName string) string {
	hash := GenerateStreamHash(pipelineID)
	sanitizedTopic := SanitizeNATSSubject(topicName)

	// Create stream name: gf-{hash}-{sanitized_topic}
	streamName := fmt.Sprintf("%s-%s-%s", internal.PipelineStreamPrefix, hash, sanitizedTopic)

	// Truncate if too long to respect NATS limits
	if len(streamName) > internal.MaxStreamNameLength {
		// Keep prefix and hash, truncate topic name
		prefix := fmt.Sprintf("%s-%s-", internal.PipelineStreamPrefix, hash)
		maxTopicLength := internal.MaxStreamNameLength - len(prefix)
		if maxTopicLength > 0 {
			streamName = prefix + sanitizedTopic[:maxTopicLength]
		} else {
			// Fallback to just prefix if even that's too long
			streamName = prefix[:internal.MaxStreamNameLength]
		}
	}

	return streamName
}

func GetPipelineNATSSubject(pipelineID, topicName string) string {
	streamName := GetIngestorStreamName(pipelineID, topicName)
	return GetWildcardNATSSubjectName(streamName)
}

func GetKafkaConsumerGroupName(pipelineID string) string {
	return fmt.Sprintf("%s-%s", internal.ConsumerGroupNamePrefix, GenerateStreamHash(pipelineID))
}

func GetNATSConsumerName(pipelineID string, componentType string, streamType string) string {
	componentAbbr := map[string]string{
		"sink": "s",
		"join": "j",
	}
	streamAbbr := map[string]string{
		"input": "i",
		"left":  "l",
		"right": "r",
	}
	return fmt.Sprintf("%s-%s%s-%s",
		internal.NATSConsumerNamePrefix,
		componentAbbr[componentType],
		streamAbbr[streamType],
		GenerateStreamHash(pipelineID))
}

func GetNATSSinkConsumerName(pipelineID string) string {
	return GetNATSConsumerName(pipelineID, "sink", "input")
}

func GetNATSJoinLeftConsumerName(pipelineID string) string {
	return GetNATSConsumerName(pipelineID, "join", "left")
}

func GetNATSJoinRightConsumerName(pipelineID string) string {
	return GetNATSConsumerName(pipelineID, "join", "right")
}
