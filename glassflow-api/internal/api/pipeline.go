package api

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/filter"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/mapper"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
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
	GetPipeline(ctx context.Context, pid string, sourceSchemaVersions map[string]string) (models.PipelineConfig, error)
	GetPipelines(ctx context.Context) ([]models.ListPipelineConfig, error)
	UpdatePipelineName(ctx context.Context, id string, name string) error
	UpdatePipelineMetadata(ctx context.Context, id string, metadata models.PipelineMetadata) error
	GetPipelineHealth(ctx context.Context, pid string) (models.PipelineHealth, error)
	GetOrchestratorType() string
	CleanUpPipelines(ctx context.Context) error
	GetPipelineResources(ctx context.Context, pid string) (models.PipelineResourcesWithPolicy, error)
	UpdatePipelineResources(ctx context.Context, pid string, resources models.PipelineResources) (models.PipelineResourcesWithPolicy, error)
	GetPipelineResourcesValidation(ctx context.Context, pid string) ([]string, error)
	GetOTLPConfig(ctx context.Context, pid string) (models.OTLPConfig, error)
}

type pipelineSource struct {
	Type             string                  `json:"type"`
	Provider         string                  `json:"provider,omitempty"`
	ConnectionParams *sourceConnectionParams `json:"connection_params,omitempty"`
	Topics           []kafkaTopic            `json:"topics,omitempty"`
	ID               string                  `json:"id,omitempty"`
	Deduplication    *dedupConfig            `json:"deduplication,omitempty"`
}

type pipelineJoin struct {
	ID      string `json:"id,omitempty"`
	Kind    string `json:"type,omitempty"`
	Enabled bool   `json:"enabled"`

	Sources []joinSource      `json:"sources,omitempty"`
	Fields  []models.JoinRule `json:"fields,omitempty"`
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
	Schema                  schema                         `json:"schema,omitempty"`
	Metadata                models.PipelineMetadata        `json:"metadata,omitempty"`
	PipelineResources       models.PipelineResources       `json:"pipeline_resources,omitempty"`

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
	ID                         string                      `json:"id,omitempty"`
	Topic                      string                      `json:"name"`
	ConsumerGroupInitialOffset string                      `json:"consumer_group_initial_offset,omitempty" default:"earliest"`
	Replicas                   int                         `json:"replicas,omitempty" default:"1"`
	Deduplication              dedupConfig                 `json:"deduplication,omitempty"`
	SchemaRegistry             models.SchemaRegistryConfig `json:"schema_registry,omitempty"`
	SchemaVersion              string                      `json:"schema_version,omitempty" default:"1"`
	SchemaFields               []models.Field              `json:"schema_fields,omitempty"`

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

type dedupConfig struct {
	Enabled bool `json:"enabled"`

	Key    string              `json:"key,omitempty"`
	Window models.JSONDuration `json:"time_window,omitempty" format:"duration" example:"5m"`
}

type joinSource struct {
	SourceID    string              `json:"source_id"`
	Key         string              `json:"key"`
	Window      models.JSONDuration `json:"time_window" format:"duration" example:"5m"`
	Orientation string              `json:"orientation"`
}

type sinkConnectionParams struct {
	Host                        string `json:"host"`
	Port                        string `json:"port"`      // native port used in BE connection
	HttpPort                    string `json:"http_port"` // http port used by UI for FE connection
	Database                    string `json:"database"`
	Username                    string `json:"username"`
	Password                    string `json:"password"`
	Secure                      bool   `json:"secure"`
	SkipCertificateVerification bool   `json:"skip_certificate_verification,omitempty" default:"false"`
}

type clickhouseSink struct {
	Kind             string               `json:"type"`
	Provider         string               `json:"provider,omitempty"`
	ConnectionParams sinkConnectionParams `json:"connection_params"`
	Table            string               `json:"table"`

	// Add validation for range
	MaxBatchSize int                 `json:"max_batch_size"`
	MaxDelayTime models.JSONDuration `json:"max_delay_time" format:"duration" doc:"Maximum delay time for batching (e.g., 60s, 1m, 5m)" example:"1m"`

	// schema evolution related sections
	SourceID     string              `json:"source_id,omitempty"`
	TableMapping []tableMappingEntry `json:"mapping,omitempty"`

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

// New format of table mapping
type tableMappingEntry struct {
	Name       string `json:"name"`
	ColumnName string `json:"column_name"`
	ColumnType string `json:"column_type"`
}

func newIngestorComponentConfig(p pipelineJSON, schemaVersions map[string]models.SchemaVersion) (zero models.IngestorComponentConfig, _ error) {
	if !models.SourceType(strings.ToLower(strings.TrimSpace(p.Source.Type))).IsKafka() {
		return zero, nil
	}

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
				ID:      t.Deduplication.Key,
				Window:  t.Deduplication.Window,
			},
			SchemaRegistryConfig: t.SchemaRegistry,
		})

		if len(t.SchemaFields) > 0 {
			schemaVersions[t.Topic] = models.SchemaVersion{
				SourceID:  t.Topic,
				VersionID: t.SchemaVersion,
				Fields:    t.SchemaFields,
			}
		}
	}

	ingestorComponentConfig, err := models.NewIngestorComponentConfig(p.Source.Provider, kafkaConfig, topics)
	if err != nil {
		return zero, fmt.Errorf("create ingestor config: %w", err)
	}

	return ingestorComponentConfig, nil
}

func newOTLPSourceConfig(p pipelineJSON, schemaVersions map[string]models.SchemaVersion) (zero models.OTLPSourceConfig, _ error) {
	st := models.SourceType(strings.ToLower(strings.TrimSpace(p.Source.Type)))
	if !st.IsOTLP() {
		return zero, nil
	}
	if p.Source.ID == "" {
		return zero, fmt.Errorf("OTLP source must have a non-empty ID")
	}

	fields := st.SchemaFields()
	if len(fields) > 0 {
		schemaVersions[p.Source.ID] = models.SchemaVersion{
			SourceID:  p.Source.ID,
			VersionID: "1",
			Fields:    fields,
		}
	}

	cfg := models.OTLPSourceConfig{
		ID: p.Source.ID,
	}
	if p.Source.Deduplication != nil {
		cfg.Deduplication = models.DeduplicationConfig{
			Enabled: p.Source.Deduplication.Enabled,
			ID:      p.Source.Deduplication.Key,
			Window:  p.Source.Deduplication.Window,
		}
	}
	return cfg, nil

}

func newJoinComponentConfig(p pipelineJSON, schemaVersions map[string]models.SchemaVersion) (zero models.JoinComponentConfig, _ error) {
	if !p.Join.Enabled {
		return zero, nil
	}

	var sources []models.JoinSourceConfig
	for _, s := range p.Join.Sources {
		sources = append(sources, models.JoinSourceConfig{
			SourceID:    s.SourceID,
			JoinKey:     s.Key,
			Window:      s.Window,
			Orientation: s.Orientation,
		})
	}

	joinComponentConfig, err := models.NewJoinComponentConfig(p.Join.Kind, p.Join.ID, sources, p.Join.Fields)
	if err != nil {
		return zero, fmt.Errorf("create join config: %w", err)
	}

	joinSchemaFields := make([]models.Field, 0)
	for _, field := range p.Join.Fields {
		schemaVersion, found := schemaVersions[field.SourceID]
		if !found {
			return zero, fmt.Errorf("schema version for join source_id '%s' not found", field.SourceID)
		}

		sourceField, found := schemaVersion.GetField(field.SourceName)
		if !found {
			return zero, fmt.Errorf("join rule field '%s' not found in schema for source '%s'", field.SourceName, field.SourceID)
		}

		// OutputName defaults to SourceName (Name) if not provided
		outputName := field.OutputName
		if outputName == "" {
			outputName = field.SourceName
		}

		joinSchemaFields = append(joinSchemaFields, models.Field{
			Name: outputName,
			Type: sourceField.Type,
		})
	}

	if len(joinSchemaFields) > 0 {
		schemaVersions[p.Join.ID] = models.SchemaVersion{
			SourceID: p.Join.ID,
			Fields:   joinSchemaFields,
		}
	}

	return joinComponentConfig, nil
}

func newSinkComponentConfig(p pipelineJSON, schemaVersions map[string]models.SchemaVersion) (zero models.SinkComponentConfig, _ error) {
	mappings := make([]models.Mapping, 0)
	maxDelayTime := p.Sink.MaxDelayTime
	if maxDelayTime.Duration() == 0 {
		maxDelayTime = *models.NewJSONDuration(60 * time.Second)
	}

	if len(p.Sink.TableMapping) > 0 {
		sourceSchemaVersion, found := schemaVersions[p.Sink.SourceID]
		if !found {
			return zero, fmt.Errorf("schema version for sink source_id '%s' not found", p.Sink.SourceID)
		}

		for _, tm := range p.Sink.TableMapping {
			// Validate that the field exists in the source schema
			sourceField, found := sourceSchemaVersion.GetField(tm.Name)
			if !found {
				return zero, fmt.Errorf("mapping field '%s' not found in schema for source_id '%s'", tm.Name, p.Sink.SourceID)
			}

			mappings = append(mappings, models.Mapping{
				SourceField:      sourceField.Name,
				SourceType:       sourceField.Type,
				DestinationField: tm.ColumnName,
				DestinationType:  tm.ColumnType,
			})
		}
	}

	sinkComponentConfig, err := models.NewClickhouseSinkComponent(models.ClickhouseSinkArgs{
		Host:                 p.Sink.ConnectionParams.Host,
		Port:                 p.Sink.ConnectionParams.Port,
		HttpPort:             p.Sink.ConnectionParams.HttpPort,
		DB:                   p.Sink.ConnectionParams.Database,
		User:                 p.Sink.ConnectionParams.Username,
		Password:             p.Sink.ConnectionParams.Password,
		Secure:               p.Sink.ConnectionParams.Secure,
		SkipCertificateCheck: p.Sink.ConnectionParams.SkipCertificateVerification,
		Table:                p.Sink.Table,
		MaxBatchSize:         p.Sink.MaxBatchSize,
		MaxDelayTime:         maxDelayTime,
		Mappings:             mappings,
	})
	if err != nil {
		return zero, fmt.Errorf("create sink config: %w", err)
	}
	sinkComponentConfig.NATSConsumerName = models.GetNATSSinkConsumerName(p.PipelineID)
	sinkComponentConfig.SourceID = p.Sink.SourceID
	sinkComponentConfig.Config = mappings

	return sinkComponentConfig, nil
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
		if !sourceFields[js.Key] {
			return fmt.Errorf("join key '%s' not found in schema fields for source_id '%s'", js.Key, js.SourceID)
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
		if t.Deduplication.Key == "" {
			continue
		}
		sourceFields, exists := fieldsBySource[t.Topic]
		if !exists {
			return fmt.Errorf("deduplication source_id '%s' not found in schema fields", t.Topic)
		}
		if !sourceFields[t.Deduplication.Key] {
			return fmt.Errorf("deduplication key '%s' not found in schema fields for source_id '%s'", t.Deduplication.Key, t.Topic)
		}
	}

	return nil
}

func validateJoinCompatibility(pipeline pipelineJSON) error {
	if !pipeline.Join.Enabled {
		return nil
	}

	if pipeline.StatelessTransformation.Enabled {
		return fmt.Errorf("join cannot be enabled when stateless transformation is enabled")
	}

	if pipeline.Filter.Enabled {
		return fmt.Errorf("join cannot be enabled when filter is enabled")
	}

	return nil
}

func newMapperConfig(pipeline pipelineJSON) (zero models.MapperConfig, _ error) {
	// Validate schema has fields
	if len(pipeline.Schema.Fields) == 0 {
		return zero, nil
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
				streamCfg.JoinKeyField = js.Key
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
		if err := mapper.ValidateClickHouseColumnType(field.ColumnType); err != nil {
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

func newFilterConfig(pipeline pipelineJSON, schemaVersions map[string]models.SchemaVersion) (models.FilterComponentConfig, error) {
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

	if len(fields) > 0 {
		err := filter.ValidateFilterExpression(pipeline.Filter.Expression, fields)
		if err != nil {
			return models.FilterComponentConfig{}, fmt.Errorf("filter validation: %w", err)
		}
	}

	if len(schemaVersions) != 0 {
		// Validate that schema version for the source topic exists
		topicSchema, found := schemaVersions[topicName]
		if !found {
			return models.FilterComponentConfig{}, fmt.Errorf("schema version for filter source_id '%s' not found", topicName)
		}

		err := filter.ValidateFilterExpressionV2(pipeline.Filter.Expression, topicSchema.Fields)
		if err != nil {
			return models.FilterComponentConfig{}, fmt.Errorf("filter validation against schema: %w", err)
		}
	}

	filterConfig := models.FilterComponentConfig{
		Enabled:    pipeline.Filter.Enabled,
		Expression: pipeline.Filter.Expression,
	}

	return filterConfig, nil
}

func newStatelessTransformationConfig(pipeline pipelineJSON, schemaVersions map[string]models.SchemaVersion) (models.StatelessTransformation, error) {
	cfg := pipeline.StatelessTransformation
	if !cfg.Enabled || len(cfg.Config.Transform) == 0 {
		return cfg, nil
	}
	// Compile expressions only. This catches syntax/parse errors and undefined function names.
	_, err := jsonTransformer.NewTransformer(cfg.Config.Transform)
	if err != nil {
		return models.StatelessTransformation{}, fmt.Errorf("stateless transformation: %w", statelessTransformValidationError(err))
	}

	// Validate transformation config
	sourceSchemaVersion, found := schemaVersions[pipeline.StatelessTransformation.SourceID]
	if !found {
		return models.StatelessTransformation{}, fmt.Errorf("schema version for stateless transformation source_id '%s' not found", pipeline.StatelessTransformation.SourceID)
	}

	err = jsonTransformer.ValidateTransformationAgainstSchema(pipeline.StatelessTransformation.Config.Transform, sourceSchemaVersion.Fields)
	if err != nil {
		return models.StatelessTransformation{}, fmt.Errorf("validate stateless transformation: %w", statelessTransformValidationError(err))
	}

	schemaFields := make([]models.Field, 0, len(pipeline.StatelessTransformation.Config.Transform))
	for _, t := range pipeline.StatelessTransformation.Config.Transform {
		schemaFields = append(schemaFields, models.Field{
			Name: t.OutputName,
			Type: t.OutputType,
		})
	}

	if len(schemaFields) > 0 {
		schemaVersions[pipeline.StatelessTransformation.ID] = models.SchemaVersion{
			SourceID: pipeline.StatelessTransformation.ID,
			Fields:   schemaFields,
		}
	}

	return pipeline.StatelessTransformation, nil
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

func validateSourceType(pipeline pipelineJSON) (models.SourceType, error) {
	st := models.SourceType(strings.ToLower(strings.TrimSpace(pipeline.Source.Type)))
	if !st.Valid() {
		return "", fmt.Errorf("unsupported source kind: %s", pipeline.Source.Type)
	}

	if st.IsKafka() {
		if len(pipeline.Source.Topics) < 1 {
			return "", fmt.Errorf("source must have at least one topic")
		}
		if len(pipeline.Source.Topics) > internal.MaxStreamsSupportedWithJoin {
			return "", fmt.Errorf("source must have at most %d topics", internal.MaxStreamsSupportedWithJoin)
		}
		for i, t := range pipeline.Source.Topics {
			if len(strings.TrimSpace(t.Topic)) == 0 {
				return "", fmt.Errorf("topic name at index %d cannot be empty", i)
			}
		}
		if err := validateJoinCompatibility(pipeline); err != nil {
			return "", err
		}
	} else if st.IsOTLP() {
		if pipeline.Join.Enabled {
			return "", fmt.Errorf("join is not supported for the OTLP pipelines")
		}
	}

	return st, nil
}

const minPipelineIDLength = 5

func (pipeline pipelineJSON) toModel() (zero models.PipelineConfig, _ error) {
	schemaVersions := make(map[string]models.SchemaVersion)

	id := strings.TrimSpace(pipeline.PipelineID)
	if len(id) == 0 {
		return zero, fmt.Errorf("pipeline ID cannot be empty")
	}

	if len(id) < minPipelineIDLength {
		return zero, fmt.Errorf("pipeline ID must be at least %d characters", minPipelineIDLength)
	}

	// Validations aligned with Pipeline CRD spec (sources.topics, topic_name, replicas, type)
	sourceType, err := validateSourceType(pipeline)
	if err != nil {
		return zero, fmt.Errorf("validate source type: %w", err)
	}

	ingestorComponentConfig, err := newIngestorComponentConfig(pipeline, schemaVersions)
	if err != nil {
		return zero, fmt.Errorf("create ingestor component config: %w", err)
	}

	otlpSourceConfig, err := newOTLPSourceConfig(pipeline, schemaVersions)
	if err != nil {
		return zero, fmt.Errorf("create OTLP source config: %w", err)
	}

	joinComponentConfig, err := newJoinComponentConfig(pipeline, schemaVersions)
	if err != nil {
		return zero, fmt.Errorf("create join component config: %w", err)
	}

	statelessTransformationConfig, err := newStatelessTransformationConfig(pipeline, schemaVersions)
	if err != nil {
		return zero, fmt.Errorf("create stateless transformation config: %w", err)
	}

	sinkComponentConfig, err := newSinkComponentConfig(pipeline, schemaVersions)
	if err != nil {
		return zero, fmt.Errorf("create sink component config: %w", err)
	}

	mapperConfig, err := newMapperConfig(pipeline)
	if err != nil {
		return zero, fmt.Errorf("create mapper config: %w", err)
	}

	filterConfig, err := newFilterConfig(pipeline, schemaVersions)
	if err != nil {
		return zero, fmt.Errorf("create filter config: %w", err)
	}

	return models.NewPipelineConfig(
		pipeline.PipelineID,
		pipeline.Name,
		mapperConfig,
		sourceType,
		otlpSourceConfig,
		ingestorComponentConfig,
		joinComponentConfig,
		sinkComponentConfig,
		filterConfig,
		statelessTransformationConfig,
		pipeline.Metadata,
		pipeline.PipelineResources,
		schemaVersions,
	), nil
}

func toPipelineJSON(p models.PipelineConfig) pipelineJSON {
	topics := make([]kafkaTopic, 0, len(p.Ingestor.KafkaTopics))
	for _, t := range p.Ingestor.KafkaTopics {
		var version string
		var schemaFields []models.Field
		schema, found := p.SchemaVersions[t.Name]
		if found {
			version = schema.VersionID
			schemaFields = schema.Fields
		}
		kt := kafkaTopic{
			Topic:                      t.Name,
			ConsumerGroupInitialOffset: t.ConsumerGroupInitialOffset,
			Replicas:                   t.Replicas,
			Deduplication: dedupConfig{
				Enabled: t.Deduplication.Enabled,
				Key:     t.Deduplication.ID,
				Window:  t.Deduplication.Window,
			},
			SchemaRegistry: models.SchemaRegistryConfig{
				URL:       t.SchemaRegistryConfig.URL,
				APIKey:    t.SchemaRegistryConfig.APIKey,
				APISecret: t.SchemaRegistryConfig.APISecret,
			},
			SchemaVersion: version,
			SchemaFields:  schemaFields,
		}
		if found {
			kt.SchemaFields = schema.Fields
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
	var joinFields []models.JoinRule
	if p.Join.Enabled {
		if p.Join.Config != nil {
			joinFields = p.Join.Config
		}
		for _, s := range p.Join.Sources {
			joinSources = append(joinSources, joinSource{
				SourceID:    s.SourceID,
				Key:         s.JoinKey,
				Window:      s.Window,
				Orientation: s.Orientation,
			})
		}
	}

	var sinkMappings []tableMappingEntry
	for _, m := range p.Sink.Config {
		sinkMappings = append(sinkMappings, tableMappingEntry{
			Name:       m.SourceField,
			ColumnName: m.DestinationField,
			ColumnType: m.DestinationType,
		})
	}

	source := pipelineSource{
		Type: string(p.SourceType),
	}
	if p.SourceType.IsKafka() {
		source.Provider = p.Ingestor.Provider
		source.ConnectionParams = &sourceConnectionParams{
			Brokers:             p.Ingestor.KafkaConnectionParams.Brokers,
			SkipAuth:            p.Ingestor.KafkaConnectionParams.SkipAuth,
			SASLProtocol:        p.Ingestor.KafkaConnectionParams.SASLProtocol,
			SASLMechanism:       p.Ingestor.KafkaConnectionParams.SASLMechanism,
			SASLUsername:        p.Ingestor.KafkaConnectionParams.SASLUsername,
			SASLPassword:        p.Ingestor.KafkaConnectionParams.SASLPassword,
			TLSRoot:             p.Ingestor.KafkaConnectionParams.TLSRoot,
			SkipTLSVerification: p.Ingestor.KafkaConnectionParams.SkipTLSVerification,
		}
		source.Topics = topics
	} else if p.SourceType.IsOTLP() {
		source.ID = p.OTLPSource.ID
		source.Deduplication = &dedupConfig{
			Enabled: p.OTLPSource.Deduplication.Enabled,
			Key:     p.OTLPSource.Deduplication.ID,
			Window:  p.OTLPSource.Deduplication.Window,
		}
	}

	return pipelineJSON{
		PipelineID: p.ID,
		Name:       p.Name,
		Source:     source,
		Join: pipelineJoin{
			ID:      p.Join.ID,
			Kind:    internal.TemporalJoinType,
			Enabled: p.Join.Enabled,
			Sources: joinSources,
			Fields:  joinFields,
		},
		Sink: clickhouseSink{
			Kind: internal.ClickHouseSinkType,
			ConnectionParams: sinkConnectionParams{
				Host:                        p.Sink.ClickHouseConnectionParams.Host,
				Port:                        p.Sink.ClickHouseConnectionParams.Port,
				HttpPort:                    p.Sink.ClickHouseConnectionParams.HttpPort,
				Database:                    p.Sink.ClickHouseConnectionParams.Database,
				Username:                    p.Sink.ClickHouseConnectionParams.Username,
				Password:                    p.Sink.ClickHouseConnectionParams.Password,
				Secure:                      p.Sink.ClickHouseConnectionParams.Secure,
				SkipCertificateVerification: p.Sink.ClickHouseConnectionParams.SkipCertificateCheck,
			},
			Table:        p.Sink.ClickHouseConnectionParams.Table,
			MaxBatchSize: p.Sink.Batch.MaxBatchSize,
			MaxDelayTime: p.Sink.Batch.MaxDelayTime,
			SourceID:     p.Sink.SourceID,
			TableMapping: sinkMappings,
		},
		Filter: pipelineFilter{
			Enabled:    p.Filter.Enabled,
			Expression: p.Filter.Expression,
		},
		StatelessTransformation: p.StatelessTransformation,
		Schema: schema{
			Fields: schemaFields,
		},
		Metadata:          p.Metadata,
		PipelineResources: p.PipelineResources,
		Version:           "v3",
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
