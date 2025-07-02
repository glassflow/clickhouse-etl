package models

const (
	KafkaIngestorType        = "kafka"
	TemporalJoinType         = "temporal"
	SchemaMapperJSONToCHType = "jsonToClickhouse"
	ClickHouseSinkType       = "clickhouse"
)

type StreamDataField struct {
	FieldName string `json:"field_name"`
	FieldType string `json:"field_type"`
}

type StreamSchemaConfig struct {
	Fields       []StreamDataField `json:"fields"`
	JoinKeyField string            `json:"join_key_field"`
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
	TLSKey        string   `json:"key"`
	TLSCert       string   `json:"cert"`
	TLSRoot       string   `json:"root_ca"`
	IAMEnable     bool     `json:"iam_enable"`
	IAMRegion     string   `json:"iam_region"`
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

type ClickHouseConnectionParamsConfig struct {
	Host                 string `json:"host"`
	Port                 string `json:"port"`
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

type PipelineConfig struct {
	Mapper   MapperConfig           `json:"mapper"`
	Ingestor IngestorOperatorConfig `json:"kafka_topics"`
	Join     JoinOperatorConfig     `json:"join"`
	Sink     SinkOperatorConfig     `json:"sink"`
}
