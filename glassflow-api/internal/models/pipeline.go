package models

type PipelineRequest struct {
	PipelineID string           `json:"pipeline_id"`
	Source     KafkaSpec        `json:"source"`
	Join       JoinConfig       `json:"join"`
	Sink       ClickhouseConfig `json:"sink"`

	SinkMaxBatchSize int64  `json:"sink_max_batch_size"`
	JoinKey          string `json:"join_key"`
}

type KafkaSpec struct {
	Provider string   `json:"provider"`
	Brokers  []string `json:"brokers"`
	Security struct {
		SASLProtocol  string `json:"protocol"`
		SASLMechanism string `json:"mechanism"`
		SASLUsername  string `json:"username"`
		SASLPassword  string `json:"password"`
		IAMEnable     bool   `json:"iam_enable"`
		IAMRegion     string `json:"iam_region"`
	} `json:"security"`
	Topics []TopicSpec `json:"topics"`
}

type TopicSpec struct {
	Topic                      string       `json:"name"`
	ID                         string       `json:"id"`
	Schema                     SchemaConfig `json:"schema"`
	ConsumerGroupInitialOffset string       `json:"consumer_group_initial_offset"`

	Deduplication DedupSpec `json:"deduplication"`
}

type SchemaConfig struct {
	Type   string `json:"type"`
	Fields []struct {
		Name     string `json:"name"`
		DataType string `json:"type"`
	} `json:"fields"`
}

type DedupSpec struct {
	Enabled bool `json:"enabled"`

	ID     string       `json:"id_field"`
	Type   string       `json:"data_type"`
	Window JSONDuration `json:"time_window"`
}

type ClickhouseConfig struct {
	Host     string                 `json:"host"`
	Port     int32                  `json:"port"`
	Database string                 `json:"database"`
	Username string                 `json:"username"`
	Password string                 `json:"password"`
	Table    string                 `json:"table"`
	Mapping  []KafkaToClickhouseMap `json:"table_mapping"`

	MaxBatchSize int32 `json:"max_batch_size"`
}

type KafkaToClickhouseMap struct {
	SourceName string `json:"source_name"`
	FieldName  string `json:"field_name"`

	ColumnName string `json:"column_name"`
	ColumnType string `json:"column_type"`
}

type JoinConfig struct {
	Enabled bool `json:"enabled"`

	Type     string             `json:"type"`
	ID       string             `json:"id"`
	DataType string             `json:"data_type"`
	Sources  []JoinSourceConfig `json:"sources"`
}

type JoinSourceConfig struct {
	SourceID string       `json:"source_id"`
	JoinKey  string       `json:"join_key"`
	Window   JSONDuration `json:"time_window"`
}
