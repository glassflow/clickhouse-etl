package api

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/filter"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	schemapkg "github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/schema"
	jsonTransformer "github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/transformer/json"
)

//go:generate mockgen -destination ./mocks/pipeline_service_mock.go -package mocks . PipelineService
type PipelineService interface { //nolint:interfacebloat //important interface
	CreatePipeline(ctx context.Context, cfg *models.PipelineConfig) error
	DeletePipeline(ctx context.Context, pid string) error
	TerminatePipeline(ctx context.Context, pid string) error
	ResumePipeline(ctx context.Context, pid string) error
	StopPipeline(ctx context.Context, pid string) error
	EditPipeline(ctx context.Context, pid string, newCfg *models.PipelineConfig) error
	GetPipeline(ctx context.Context, pid string) (models.PipelineConfig, error)
	GetPipelines(ctx context.Context) ([]models.ListPipelineConfig, error)
	UpdatePipelineName(ctx context.Context, id string, name string) error
	UpdatePipelineMetadata(ctx context.Context, id string, metadata models.PipelineMetadata) error
	GetPipelineHealth(ctx context.Context, pid string) (models.PipelineHealth, error)
	GetOrchestratorType() string
	CleanUpPipelines(ctx context.Context) error
	GetPipelineResources(ctx context.Context, pid string) (*models.PipelineResourcesRow, error)
	UpdatePipelineResources(ctx context.Context, pid string, resources models.PipelineResources) error
}

type pipelineSource struct {
	Kind             string                 `json:"type"`
	Provider         string                 `json:"provider,omitempty"`
	ConnectionParams sourceConnectionParams `json:"connection_params"`
	Topics           []kafkaTopic           `json:"topics"`
}

type pipelineJoin struct {
	Kind    string `json:"type,omitempty"`
	Enabled bool   `json:"enabled"`

	Sources []joinSource `json:"sources,omitempty"`
}

type pipelineFilter struct {
	Enabled    bool   `json:"enabled"`
	Expression string `json:"expression,omitempty"`
}

type schemaField struct {
	SourceID   string `json:"source_id"`
	Name       string `json:"name"`
	Type       string `json:"type"`
	ColumnName string `json:"column_name,omitempty"`
	ColumnType string `json:"column_type,omitempty"`
}

type schema struct {
	Fields []schemaField `json:"fields"`
}

type pipelineJSON struct {
	PipelineID              string                         `json:"pipeline_id"`
	Name                    string                         `json:"name"`
	Source                  pipelineSource                 `json:"source"`
	Join                    pipelineJoin                   `json:"join,omitempty"`
	Filter                  pipelineFilter                 `json:"filter,omitempty"`
	StatelessTransformation models.StatelessTransformation `json:"stateless_transformation,omitempty"`
	Sink                    clickhouseSink                 `json:"sink"`
	Schema                  schema                         `json:"schema"`
	Metadata                models.PipelineMetadata        `json:"metadata,omitempty"`

	// Metadata fields (ignored, for backwards compatibility with exported configs)
	Version    string `json:"version,omitempty"`
	ExportedAt string `json:"exported_at,omitempty"`
	ExportedBy string `json:"exported_by,omitempty"`
}

type sourceConnectionParams struct {
	Brokers             []string `json:"brokers"`
	SASLMechanism       string   `json:"mechanism"`
	SkipAuth            bool     `json:"skip_auth,omitempty"`
	SASLProtocol        string   `json:"protocol"`
	SASLUsername        string   `json:"username,omitempty"`
	SASLPassword        string   `json:"password,omitempty"`
	SkipTLSVerification bool     `json:"skip_tls_verification,omitempty"`
	TLSRoot             string   `json:"root_ca,omitempty"`
	TLSCert             string   `json:"client_cert,omitempty"`
	TLSKey              string   `json:"client_key,omitempty"`
	KerberosServiceName string   `json:"kerberos_service_name,omitempty"`
	KerberosRealm       string   `json:"kerberos_realm,omitempty"`
	KerberosKeytab      string   `json:"kerberos_keytab,omitempty"`
	KerberosConfig      string   `json:"kerberos_config,omitempty"`
}

type kafkaTopic struct {
	ID                         string           `json:"id,omitempty"`
	Topic                      string           `json:"name"`
	ConsumerGroupInitialOffset string           `json:"consumer_group_initial_offset,omitempty" default:"earliest"`
	Replicas                   int              `json:"replicas,omitempty" default:"1"`
	Deduplication              topicDedupConfig `json:"deduplication,omitempty"`
	// Old format: schema fields nested in topic for migration
	SchemaV1 *topicSchemaV1 `json:"schema,omitempty"`
}

// Old format: schema fields nested in topic for migration
type topicSchemaV1 struct {
	Type   string               `json:"type,omitempty"`
	Fields []topicSchemaFieldV1 `json:"fields,omitempty"`
}

// Old format: schema fields nested in topic for migration
type topicSchemaFieldV1 struct {
	Name string `json:"name"`
	Type string `json:"type"`
}

type topicDedupConfig struct {
	Enabled bool `json:"enabled"`

	ID     string              `json:"id_field,omitempty"`
	Type   string              `json:"id_field_type,omitempty"`
	Window models.JSONDuration `json:"time_window,omitempty" format:"duration" example:"5m"`
}

type joinSource struct {
	SourceID    string              `json:"source_id"`
	JoinKey     string              `json:"join_key"`
	Window      models.JSONDuration `json:"time_window" format:"duration" example:"5m"`
	Orientation string              `json:"orientation"`
}

type clickhouseSink struct {
	Kind     string `json:"type"`
	Provider string `json:"provider,omitempty"`
	// Add validation for null/empty values
	Host     string `json:"host"`
	Port     string `json:"port"`      // native port used in BE connection
	HttpPort string `json:"http_port"` // http port used by UI for FE connection
	Database string `json:"database"`
	Username string `json:"username"`
	Password string `json:"password"`
	Table    string `json:"table"`
	Secure   bool   `json:"secure"`

	// Add validation for range
	MaxBatchSize                int                 `json:"max_batch_size"`
	MaxDelayTime                models.JSONDuration `json:"max_delay_time" format:"duration" doc:"Maximum delay time for batching (e.g., 60s, 1m, 5m)" example:"1m"`
	SkipCertificateVerification bool                `json:"skip_certificate_verification,omitempty" default:"false"`
	// Old format: table_mapping in sink
	TableMappingV1 []tableMappingEntryV1 `json:"table_mapping,omitempty"`
}

// Old format for migration
type tableMappingEntryV1 struct {
	SourceID   string `json:"source_id"`
	FieldName  string `json:"field_name"`
	ColumnName string `json:"column_name"`
	ColumnType string `json:"column_type"`
}

func newIngestorComponentConfig(p pipelineJSON) (zero models.IngestorComponentConfig, _ error) {
	kafkaConfig := models.KafkaConnectionParamsConfig{
		Brokers:             p.Source.ConnectionParams.Brokers,
		SkipAuth:            p.Source.ConnectionParams.SkipAuth,
		SASLProtocol:        p.Source.ConnectionParams.SASLProtocol,
		SASLMechanism:       p.Source.ConnectionParams.SASLMechanism,
		SASLUsername:        p.Source.ConnectionParams.SASLUsername,
		SASLPassword:        p.Source.ConnectionParams.SASLPassword,
		SkipTLSVerification: p.Source.ConnectionParams.SkipTLSVerification,
		TLSRoot:             p.Source.ConnectionParams.TLSRoot,
		TLSCert:             p.Source.ConnectionParams.TLSCert,
		TLSKey:              p.Source.ConnectionParams.TLSKey,
		KerberosServiceName: p.Source.ConnectionParams.KerberosServiceName,
		KerberosRealm:       p.Source.ConnectionParams.KerberosRealm,
		KerberosKeytab:      p.Source.ConnectionParams.KerberosKeytab,
		KerberosConfig:      p.Source.ConnectionParams.KerberosConfig,
	}

	topics := make([]models.KafkaTopicsConfig, 0, len(p.Source.Topics))
	for _, t := range p.Source.Topics {
		topics = append(topics, models.KafkaTopicsConfig{
			Name:                       t.Topic,
			ConsumerGroupName:          models.GetKafkaConsumerGroupName(p.PipelineID),
			ConsumerGroupInitialOffset: t.ConsumerGroupInitialOffset,
			Replicas:                   t.Replicas,
			Deduplication: models.DeduplicationConfig{
				Enabled: t.Deduplication.Enabled,
				ID:      t.Deduplication.ID,
				Type:    internal.NormalizeToBasicKafkaType(t.Deduplication.Type),
				Window:  t.Deduplication.Window,
			},
			OutputStreamID:      models.GetIngestorStreamName(p.PipelineID, t.Topic),
			OutputStreamSubject: models.GetPipelineNATSSubject(p.PipelineID, t.Topic),
		})
	}

	ingestorComponentConfig, err := models.NewIngestorComponentConfig(p.Source.Provider, kafkaConfig, topics)
	if err != nil {
		return zero, fmt.Errorf("create ingestor config: %w", err)
	}

	return ingestorComponentConfig, nil
}

func newJoinComponentConfig(p pipelineJSON) (zero models.JoinComponentConfig, _ error) {
	if !p.Join.Enabled {
		return zero, nil
	}

	// Create a map of topic names to their deduplication status for quick lookup
	topicDedupMap := make(map[string]bool)
	for _, topic := range p.Source.Topics {
		isDedupEnabled := topic.Deduplication.Enabled
		if p.StatelessTransformation.Enabled {
			isDedupEnabled = true
		}
		topicDedupMap[topic.Topic] = isDedupEnabled
	}

	var sources []models.JoinSourceConfig
	for _, s := range p.Join.Sources {
		// Generate stream ID based on whether deduplication is enabled for this topic
		var streamID string
		if topicDedupMap[s.SourceID] {
			// If deduplication is enabled, join consumes from dedup output stream
			streamID = models.GetDedupOutputStreamName(p.PipelineID, s.SourceID)
		} else {
			// Otherwise, join consumes from ingestor output stream
			streamID = models.GetIngestorStreamName(p.PipelineID, s.SourceID)
		}

		sources = append(sources, models.JoinSourceConfig{
			SourceID:    s.SourceID,
			StreamID:    streamID,
			JoinKey:     s.JoinKey,
			Window:      s.Window,
			Orientation: s.Orientation,
		})
	}

	joinComponentConfig, err := models.NewJoinComponentConfig(p.Join.Kind, sources)
	if err != nil {
		return zero, fmt.Errorf("create join config: %w", err)
	}
	joinComponentConfig.OutputStreamID = models.GetJoinedStreamName(p.PipelineID)
	joinComponentConfig.NATSLeftConsumerName = models.GetNATSJoinLeftConsumerName(p.PipelineID)
	joinComponentConfig.NATSRightConsumerName = models.GetNATSJoinRightConsumerName(p.PipelineID)

	return joinComponentConfig, nil
}

func newSinkComponentConfig(
	p pipelineJSON,
	sinkStreamID string,
) (zero models.SinkComponentConfig, _ error) {
	maxDelayTime := p.Sink.MaxDelayTime
	if maxDelayTime.Duration() == 0 {
		maxDelayTime = *models.NewJSONDuration(60 * time.Second)
	}

	sinkComponentConfig, err := models.NewClickhouseSinkComponent(models.ClickhouseSinkArgs{
		Host:                 p.Sink.Host,
		Port:                 p.Sink.Port,
		HttpPort:             p.Sink.HttpPort,
		DB:                   p.Sink.Database,
		User:                 p.Sink.Username,
		Password:             p.Sink.Password,
		Table:                p.Sink.Table,
		Secure:               p.Sink.Secure,
		StreamID:             sinkStreamID,
		MaxBatchSize:         p.Sink.MaxBatchSize,
		MaxDelayTime:         maxDelayTime,
		SkipCertificateCheck: p.Sink.SkipCertificateVerification,
	})
	if err != nil {
		return zero, fmt.Errorf("create sink config: %w", err)
	}
	sinkComponentConfig.NATSConsumerName = models.GetNATSSinkConsumerName(p.PipelineID)

	return sinkComponentConfig, nil
}

func getSinkStreamID(p pipelineJSON) (string, error) {
	var sinkStreamID string
	if p.Join.Enabled {
		// If join is enabled, sink consumes from the joined stream
		sinkStreamID = models.GetJoinedStreamName(p.PipelineID)
	} else {
		// If join is not enabled, sink consumes from the first topic's stream
		if len(p.Source.Topics) > 0 {
			firstTopic := p.Source.Topics[0]
			// If deduplication is enabled for this topic, use the dedup output stream
			if firstTopic.Deduplication.Enabled || p.StatelessTransformation.Enabled || p.Filter.Enabled {
				sinkStreamID = models.GetDedupOutputStreamName(p.PipelineID, firstTopic.Topic)
			} else {
				sinkStreamID = models.GetIngestorStreamName(p.PipelineID, firstTopic.Topic)
			}
		} else {
			return "", fmt.Errorf("no topics defined for sink when join is disabled")
		}
	}

	return sinkStreamID, nil
}

func validateJoinKeysInSchema(schema schema, joinSources []joinSource) error {
	// Build a map of source_id -> field names for quick lookup
	fieldsBySource := make(map[string]map[string]bool)
	for _, field := range schema.Fields {
		if fieldsBySource[field.SourceID] == nil {
			fieldsBySource[field.SourceID] = make(map[string]bool)
		}
		fieldsBySource[field.SourceID][field.Name] = true
	}

	// Validate each join source's join key exists in schema
	for _, js := range joinSources {
		sourceFields, exists := fieldsBySource[js.SourceID]
		if !exists {
			return fmt.Errorf("join source_id '%s' not found in schema fields", js.SourceID)
		}
		if !sourceFields[js.JoinKey] {
			return fmt.Errorf("join key '%s' not found in schema fields for source_id '%s'", js.JoinKey, js.SourceID)
		}
	}

	return nil
}

func validateDedupKeysInSchema(schema schema, topics []kafkaTopic) error {
	// Build a map of topic name -> field names for quick lookup
	fieldsBySource := make(map[string]map[string]bool)
	for _, field := range schema.Fields {
		if fieldsBySource[field.SourceID] == nil {
			fieldsBySource[field.SourceID] = make(map[string]bool)
		}
		fieldsBySource[field.SourceID][field.Name] = true
	}

	// Validate each topic's dedup key exists in schema
	for _, t := range topics {
		if !t.Deduplication.Enabled {
			continue
		}
		if t.Deduplication.ID == "" {
			continue
		}
		sourceFields, exists := fieldsBySource[t.Topic]
		if !exists {
			return fmt.Errorf("deduplication source_id '%s' not found in schema fields", t.Topic)
		}
		if !sourceFields[t.Deduplication.ID] {
			return fmt.Errorf("deduplication key '%s' not found in schema fields for source_id '%s'", t.Deduplication.ID, t.Topic)
		}
	}

	return nil
}

func newMapperConfig(pipeline pipelineJSON) (zero models.MapperConfig, _ error) {
	// Validate schema has fields
	if len(pipeline.Schema.Fields) == 0 {
		return zero, fmt.Errorf("schema must have at least one field")
	}

	// Validate join keys exist in schema
	if pipeline.Join.Enabled && len(pipeline.Join.Sources) > 0 {
		if err := validateJoinKeysInSchema(pipeline.Schema, pipeline.Join.Sources); err != nil {
			return zero, fmt.Errorf("validate join keys: %w", err)
		}
	}

	// Validate dedup keys exist in schema
	if err := validateDedupKeysInSchema(pipeline.Schema, pipeline.Source.Topics); err != nil {
		return zero, fmt.Errorf("validate deduplication keys: %w", err)
	}

	// Group fields by source_id to build Streams
	streamsCfg := make(map[string]models.StreamSchemaConfig)
	fieldsBySource := make(map[string][]models.StreamDataField)

	for _, field := range pipeline.Schema.Fields {
		fieldsBySource[field.SourceID] = append(fieldsBySource[field.SourceID], models.StreamDataField{
			FieldName: field.Name,
			FieldType: internal.NormalizeToBasicKafkaType(field.Type),
		})
	}

	// Build streams config with join info
	for sourceID, fields := range fieldsBySource {
		streamCfg := models.StreamSchemaConfig{
			Fields: fields,
		}

		// Add join info if this source is part of a join
		for _, js := range pipeline.Join.Sources {
			if js.SourceID == sourceID {
				streamCfg.JoinKeyField = js.JoinKey
				streamCfg.JoinOrientation = js.Orientation
				streamCfg.JoinWindow = js.Window
				break
			}
		}

		streamsCfg[sourceID] = streamCfg
	}

	// Build sink mapping from schema fields
	sinkCfg := make([]models.SinkMappingConfig, 0, len(pipeline.Schema.Fields))
	for _, field := range pipeline.Schema.Fields {
		// Skip fields without column mapping (used only for validation/join keys)
		if field.ColumnName == "" || field.ColumnType == "" {
			continue
		}
		sinkCfg = append(sinkCfg, models.SinkMappingConfig{
			ColumnName: field.ColumnName,
			StreamName: field.SourceID,
			FieldName:  field.Name,
			ColumnType: field.ColumnType,
		})
	}

	// Validate that at least one field has a column mapping
	if len(sinkCfg) == 0 {
		return zero, fmt.Errorf("at least one field must have column_name and column_type defined")
	}

	// Validate all ClickHouse column types are supported (fail at API layer, not at sink runtime)
	for _, field := range pipeline.Schema.Fields {
		if field.ColumnName == "" || field.ColumnType == "" {
			continue
		}
		if err := schemapkg.ValidateClickHouseColumnType(field.ColumnType); err != nil {
			return zero, fmt.Errorf("field %q (column %q): %w", field.Name, field.ColumnName, err)
		}
	}

	mapperConfig := models.MapperConfig{
		Type:        internal.SchemaMapperJSONToCHType,
		Streams:     streamsCfg,
		SinkMapping: sinkCfg,
	}

	return mapperConfig, nil
}

func newFilterConfig(pipeline pipelineJSON) (models.FilterComponentConfig, error) {
	if !pipeline.Filter.Enabled {
		return models.FilterComponentConfig{}, nil
	}

	// only 1 source is supported for filter (ingestor)
	if pipeline.Source.Topics == nil || len(pipeline.Source.Topics) != 1 {
		return models.FilterComponentConfig{}, nil
	}

	// Get fields for the first topic from unified schema
	topicName := pipeline.Source.Topics[0].Topic
	var fields []models.StreamDataField
	for _, field := range pipeline.Schema.Fields {
		if field.SourceID == topicName {
			fields = append(fields, models.StreamDataField{
				FieldName: field.Name,
				FieldType: internal.NormalizeToBasicKafkaType(field.Type),
			})
		}
	}

	err := filter.ValidateFilterExpression(pipeline.Filter.Expression, fields)
	if err != nil {
		return models.FilterComponentConfig{}, fmt.Errorf("filter validation: %w", err)
	}

	filterConfig := models.FilterComponentConfig{
		Enabled:    pipeline.Filter.Enabled,
		Expression: pipeline.Filter.Expression,
	}

	return filterConfig, nil
}

func newStatelessTransformationConfig(pipeline pipelineJSON) (models.StatelessTransformation, error) {
	cfg := pipeline.StatelessTransformation
	if !cfg.Enabled || len(cfg.Config.Transform) == 0 {
		return cfg, nil
	}
	// Compile expressions only. This catches syntax/parse errors and undefined function names.
	_, err := jsonTransformer.NewTransformer(cfg.Config.Transform)
	if err != nil {
		return models.StatelessTransformation{}, fmt.Errorf("stateless transformation: %w", statelessTransformValidationError(err))
	}
	return cfg, nil
}

// statelessTransformValidationError returns a human-readable error for transform validation failures.
func statelessTransformValidationError(err error) error {
	if err == nil {
		return nil
	}
	msg := err.Error()
	if strings.Contains(msg, "compile transformation") {
		return fmt.Errorf("transformation expression has a syntax or parse error (e.g. invalid token, unmatched parentheses). Details: %w", err)
	}
	if strings.Contains(msg, "cannot call nil") {
		return fmt.Errorf("transformation expression uses an undefined or misspelled function — check that the function name is in the supported list (e.g. lower, upper, replace, toInt, toFloat). Details: %w", err)
	}
	if strings.Contains(msg, "run transformation ") {
		return fmt.Errorf("transformation validation failed: %w", err)
	}
	return err
}

const minPipelineIDLength = 5

func (pipeline pipelineJSON) toModel() (zero models.PipelineConfig, _ error) {
	id := strings.TrimSpace(pipeline.PipelineID)
	if len(id) == 0 {
		return zero, fmt.Errorf("pipeline ID cannot be empty")
	}
	if len(id) < minPipelineIDLength {
		return zero, fmt.Errorf("pipeline ID must be at least %d characters", minPipelineIDLength)
	}

	// Validations aligned with Pipeline CRD spec (sources.topics, topic_name, replicas, type)
	if strings.ToLower(strings.TrimSpace(pipeline.Source.Kind)) != internal.KafkaIngestorType {
		return zero, fmt.Errorf("source type must be %q", internal.KafkaIngestorType)
	}
	if len(pipeline.Source.Topics) < 1 {
		return zero, fmt.Errorf("source must have at least one topic")
	}
	if len(pipeline.Source.Topics) > internal.MaxStreamsSupportedWithJoin {
		return zero, fmt.Errorf("source must have at most %d topics", internal.MaxStreamsSupportedWithJoin)
	}
	for i, t := range pipeline.Source.Topics {
		if len(strings.TrimSpace(t.Topic)) == 0 {
			return zero, fmt.Errorf("topic name at index %d cannot be empty", i)
		}
	}

	ingestorComponentConfig, err := newIngestorComponentConfig(pipeline)
	if err != nil {
		return zero, fmt.Errorf("create ingestor component config: %w", err)
	}

	joinComponentConfig, err := newJoinComponentConfig(pipeline)
	if err != nil {
		return zero, fmt.Errorf("create join component config: %w", err)
	}

	sinkStreamID, err := getSinkStreamID(pipeline)
	if err != nil {
		return zero, fmt.Errorf("get sink stream id: %w", err)
	}

	sinkComponentConfig, err := newSinkComponentConfig(pipeline, sinkStreamID)
	if err != nil {
		return zero, fmt.Errorf("create sink component config: %w", err)
	}

	mapperConfig, err := newMapperConfig(pipeline)
	if err != nil {
		return zero, fmt.Errorf("create mapper config: %w", err)
	}

	filterConfig, err := newFilterConfig(pipeline)
	if err != nil {
		return zero, fmt.Errorf("create filter config: %w", err)
	}

	statelessTransformationConfig, err := newStatelessTransformationConfig(pipeline)
	if err != nil {
		return zero, fmt.Errorf("create stateless transformation config: %w", err)
	}

	return models.NewPipelineConfig(
		pipeline.PipelineID,
		pipeline.Name,
		mapperConfig,
		ingestorComponentConfig,
		joinComponentConfig,
		sinkComponentConfig,
		filterConfig,
		statelessTransformationConfig,
		pipeline.Metadata,
	), nil
}

func toPipelineJSON(p models.PipelineConfig) pipelineJSON {
	topics := make([]kafkaTopic, 0, len(p.Ingestor.KafkaTopics))
	for _, t := range p.Ingestor.KafkaTopics {
		kt := kafkaTopic{
			Topic:                      t.Name,
			ConsumerGroupInitialOffset: t.ConsumerGroupInitialOffset,
			Replicas:                   t.Replicas,
			Deduplication: topicDedupConfig{
				Enabled: t.Deduplication.Enabled,
				ID:      t.Deduplication.ID,
				Type:    t.Deduplication.Type,
				Window:  t.Deduplication.Window,
			},
		}
		topics = append(topics, kt)
	}

	// Build unified schema from MapperConfig
	schemaFields := make([]schemaField, 0)

	// Create a map to track which fields we've added (to avoid duplicates)
	fieldMap := make(map[string]bool)

	// First, add all fields from streams with their types
	for streamName, streamConfig := range p.Mapper.Streams {
		for _, field := range streamConfig.Fields {
			key := streamName + ":" + field.FieldName
			if !fieldMap[key] {
				// Find corresponding sink mapping for column info
				var columnName, columnType string
				for _, mapping := range p.Mapper.SinkMapping {
					if mapping.StreamName == streamName && mapping.FieldName == field.FieldName {
						columnName = mapping.ColumnName
						columnType = mapping.ColumnType
						break
					}
				}

				schemaFields = append(schemaFields, schemaField{
					SourceID:   streamName,
					Name:       field.FieldName,
					Type:       internal.NormalizeToBasicKafkaType(field.FieldType),
					ColumnName: columnName,
					ColumnType: columnType,
				})
				fieldMap[key] = true
			}
		}
	}

	var joinSources []joinSource
	if p.Join.Enabled {
		for _, s := range p.Join.Sources {
			joinSources = append(joinSources, joinSource{
				SourceID:    s.SourceID,
				JoinKey:     s.JoinKey,
				Window:      s.Window,
				Orientation: s.Orientation,
			})
		}
	}

	return pipelineJSON{
		PipelineID: p.ID,
		Name:       p.Name,
		Source: pipelineSource{
			Kind:     p.Ingestor.Type,
			Provider: p.Ingestor.Provider,
			ConnectionParams: sourceConnectionParams{
				Brokers:             p.Ingestor.KafkaConnectionParams.Brokers,
				SkipAuth:            p.Ingestor.KafkaConnectionParams.SkipAuth,
				SASLProtocol:        p.Ingestor.KafkaConnectionParams.SASLProtocol,
				SASLMechanism:       p.Ingestor.KafkaConnectionParams.SASLMechanism,
				SASLUsername:        p.Ingestor.KafkaConnectionParams.SASLUsername,
				SASLPassword:        p.Ingestor.KafkaConnectionParams.SASLPassword,
				TLSRoot:             p.Ingestor.KafkaConnectionParams.TLSRoot,
				SkipTLSVerification: p.Ingestor.KafkaConnectionParams.SkipTLSVerification,
			},
			Topics: topics,
		},
		Join: pipelineJoin{
			Kind:    internal.TemporalJoinType,
			Enabled: p.Join.Enabled,
			Sources: joinSources,
		},
		Sink: clickhouseSink{
			Kind:                        internal.ClickHouseSinkType,
			Host:                        p.Sink.ClickHouseConnectionParams.Host,
			Port:                        p.Sink.ClickHouseConnectionParams.Port,
			HttpPort:                    p.Sink.ClickHouseConnectionParams.HttpPort,
			Database:                    p.Sink.ClickHouseConnectionParams.Database,
			Username:                    p.Sink.ClickHouseConnectionParams.Username,
			Password:                    p.Sink.ClickHouseConnectionParams.Password,
			Table:                       p.Sink.ClickHouseConnectionParams.Table,
			Secure:                      p.Sink.ClickHouseConnectionParams.Secure,
			MaxBatchSize:                p.Sink.Batch.MaxBatchSize,
			MaxDelayTime:                p.Sink.Batch.MaxDelayTime,
			SkipCertificateVerification: p.Sink.ClickHouseConnectionParams.SkipCertificateCheck,
		},
		Filter: pipelineFilter{
			Enabled:    p.Filter.Enabled,
			Expression: p.Filter.Expression,
		},
		StatelessTransformation: p.StatelessTransformation,
		Schema: schema{
			Fields: schemaFields,
		},
		Metadata: p.Metadata,
		Version:  "v2",
	}
}

// MigratePipelineFromJSON converts pipeline JSON from NATS KV to PipelineConfig
func MigratePipelineFromJSON(jsonData []byte, pipelineID string) (models.PipelineConfig, error) {
	var p models.PipelineConfig
	if err := json.Unmarshal(jsonData, &p); err != nil {
		return models.PipelineConfig{}, fmt.Errorf("unmarshal pipeline JSON: %w", err)
	}

	// Update the pipeline ID (using the same ID from NATS KV)
	p.ID = pipelineID

	return p, nil
}
