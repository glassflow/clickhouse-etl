package api

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
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

// MigratePipelineFromJSON converts pipeline JSON from NATS KV to PipelineConfig.
// Uses the v2 format for backwards compatibility with existing stored configs.
func MigratePipelineFromJSON(jsonData []byte, pipelineID string) (models.PipelineConfig, error) {
	var p models.PipelineConfig
	if err := json.Unmarshal(jsonData, &p); err != nil {
		return models.PipelineConfig{}, fmt.Errorf("unmarshal pipeline JSON: %w", err)
	}
	p.ID = pipelineID
	return p, nil
}

// --- v2 types (kept for migration) ---

// Ensure v2 types are not removed by the linter — needed for v2→v3 migration.
var _ = (*pipelineJSONv2)(nil)

type pipelineJSONv2 struct {
	PipelineID              string                         `json:"pipeline_id"`
	Name                    string                         `json:"name"`
	Source                  pipelineSourceV2               `json:"source"`
	Join                    pipelineJoinV2                 `json:"join,omitempty"`
	Filter                  pipelineFilterV2               `json:"filter,omitempty"`
	StatelessTransformation models.StatelessTransformation `json:"stateless_transformation,omitempty"`
	Sink                    clickhouseSinkV2               `json:"sink"`
	Schema                  schemaV2                       `json:"schema,omitempty"`
	Metadata                models.PipelineMetadata        `json:"metadata,omitempty"`
	PipelineResources       models.PipelineResources       `json:"pipeline_resources,omitempty"`

	Version    string `json:"version,omitempty"`
	ExportedAt string `json:"exported_at,omitempty"`
	ExportedBy string `json:"exported_by,omitempty"`
}

type pipelineSourceV2 struct {
	Type             string                    `json:"type"`
	Provider         string                    `json:"provider,omitempty"`
	ConnectionParams *sourceConnectionParamsV2 `json:"connection_params,omitempty"`
	Topics           []kafkaTopicV2            `json:"topics,omitempty"`
	ID               string                    `json:"id,omitempty"`
	Deduplication    *dedupConfigV2            `json:"deduplication,omitempty"`
}

type pipelineJoinV2 struct {
	ID      string `json:"id,omitempty"`
	Kind    string `json:"type,omitempty"`
	Enabled bool   `json:"enabled"`

	Sources []joinSourceV2    `json:"sources,omitempty"`
	Fields  []models.JoinRule `json:"fields,omitempty"`
}

type pipelineFilterV2 struct {
	Enabled    bool   `json:"enabled"`
	Expression string `json:"expression,omitempty"`
}

type schemaFieldV2 struct {
	SourceID   string `json:"source_id"`
	Name       string `json:"name"`
	Type       string `json:"type"`
	ColumnName string `json:"column_name,omitempty"`
	ColumnType string `json:"column_type,omitempty"`
}

type schemaV2 struct {
	Fields []schemaFieldV2 `json:"fields"`
}

type sourceConnectionParamsV2 struct {
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

type kafkaTopicV2 struct {
	ID                         string                      `json:"id,omitempty"`
	Topic                      string                      `json:"name"`
	ConsumerGroupInitialOffset string                      `json:"consumer_group_initial_offset,omitempty"`
	Replicas                   int                         `json:"replicas,omitempty"`
	Deduplication              dedupConfigV2               `json:"deduplication,omitempty"`
	SchemaRegistry             models.SchemaRegistryConfig `json:"schema_registry,omitempty"`
	SchemaVersion              string                      `json:"schema_version,omitempty"`
	SchemaFields               []models.Field              `json:"schema_fields,omitempty"`
	SchemaV1                   *topicSchemaV1              `json:"schema,omitempty"`
}

type topicSchemaV1 struct {
	Type   string               `json:"type,omitempty"`
	Fields []topicSchemaFieldV1 `json:"fields,omitempty"`
}

type topicSchemaFieldV1 struct {
	Name string `json:"name"`
	Type string `json:"type"`
}

type dedupConfigV2 struct {
	Enabled bool                `json:"enabled"`
	Key     string              `json:"key,omitempty"`
	IDField string              `json:"id_field,omitempty"` // older v2 format used id_field instead of key
	Window  models.JSONDuration `json:"time_window,omitempty"`
}

type joinSourceV2 struct {
	SourceID    string              `json:"source_id"`
	Key         string              `json:"join_key"`
	Window      models.JSONDuration `json:"time_window"`
	Orientation string              `json:"orientation"`
}

type sinkConnectionParamsV2 struct {
	Host                        string `json:"host"`
	Port                        string `json:"port"`
	HttpPort                    string `json:"http_port"`
	Database                    string `json:"database"`
	Username                    string `json:"username"`
	Password                    string `json:"password"`
	Secure                      bool   `json:"secure"`
	SkipCertificateVerification bool   `json:"skip_certificate_verification,omitempty"`
}

type clickhouseSinkV2 struct {
	Kind             string                 `json:"type"`
	Provider         string                 `json:"provider,omitempty"`
	ConnectionParams sinkConnectionParamsV2 `json:"connection_params,omitempty"`
	// Flat fields — older v2 format stores connection params at top level
	Host                        string                `json:"host,omitempty"`
	Port                        string                `json:"port,omitempty"`
	HttpPort                    string                `json:"http_port,omitempty"`
	Database                    string                `json:"database,omitempty"`
	Username                    string                `json:"username,omitempty"`
	Password                    string                `json:"password,omitempty"`
	Secure                      bool                  `json:"secure,omitempty"`
	SkipCertificateVerification bool                  `json:"skip_certificate_verification,omitempty"`
	Table                       string                `json:"table"`
	MaxBatchSize                int                   `json:"max_batch_size"`
	MaxDelayTime                models.JSONDuration   `json:"max_delay_time"`
	SourceID                    string                `json:"source_id,omitempty"`
	TableMapping                []tableMappingEntryV2 `json:"mapping,omitempty"`
	TableMappingV1              []tableMappingEntryV1 `json:"table_mapping,omitempty"`
}

type tableMappingEntryV1 struct {
	SourceID   string `json:"source_id"`
	FieldName  string `json:"field_name"`
	ColumnName string `json:"column_name"`
	ColumnType string `json:"column_type"`
}

type tableMappingEntryV2 struct {
	Name       string `json:"name"`
	ColumnName string `json:"column_name"`
	ColumnType string `json:"column_type"`
}

// pipelineJSON is the API-layer representation of a pipeline.
// Wire format is JSON.
type pipelineJSON struct {
	Version    string                  `json:"version"`
	PipelineID string                  `json:"pipeline_id"`
	Name       string                  `json:"name"`
	Sources    []source                `json:"sources"`
	Transforms []pipelineTransform     `json:"transforms,omitempty"`
	Join       *join                   `json:"join,omitempty"`
	Sink       sink                    `json:"sink"`
	Metadata   models.PipelineMetadata `json:"metadata,omitempty"`
	Resources  resources               `json:"resources,omitempty"`
}

type source struct {
	Type                       string                       `json:"type"`
	SourceID                   string                       `json:"source_id"`
	ConnectionParams           *kafkaConnectionParams       `json:"connection_params,omitempty"`
	Topic                      string                       `json:"topic,omitempty"`
	SchemaVersion              string                       `json:"schema_version,omitempty"`
	SchemaRegistry             *models.SchemaRegistryConfig `json:"schema_registry,omitempty"`
	SchemaFields               []models.Field               `json:"schema_fields,omitempty"`
	ConsumerGroupInitialOffset string                       `json:"consumer_group_initial_offset,omitempty"`
}

type kafkaConnectionParams struct {
	Brokers             []string `json:"brokers"`
	SASLMechanism       string   `json:"mechanism"`
	SASLProtocol        string   `json:"protocol"`
	SkipAuth            bool     `json:"skip_auth,omitempty"`
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

type pipelineTransform struct {
	Type     string          `json:"type"`
	SourceID string          `json:"source_id"`
	Config   transformParams `json:"config"`
}

const (
	transformTypeDedup     = "dedup"
	transformTypeFilter    = "filter"
	transformTypeStateless = "stateless"
)

// transformParams is a flat union of all transform config fields.
// Which fields are relevant depends on the parent transformConfig.Type.
type transformParams struct {
	Key        string              `json:"key,omitempty"`
	TimeWindow models.JSONDuration `json:"time_window,omitempty"`
	Expression string              `json:"expression,omitempty"`
	Transforms []models.Transform  `json:"transforms,omitempty"`
}

type join struct {
	Enabled      bool              `json:"enabled"`
	Type         string            `json:"type,omitempty"`
	LeftSource   joinSource        `json:"left_source"`
	RightSource  joinSource        `json:"right_source"`
	OutputFields []joinOutputField `json:"output_fields,omitempty"`
}

type joinSource struct {
	SourceID   string              `json:"source_id"`
	Key        string              `json:"key"`
	TimeWindow models.JSONDuration `json:"time_window"`
}

type joinOutputField struct {
	SourceID   string `json:"source_id"`
	Name       string `json:"name"`
	OutputName string `json:"output_name,omitempty"`
}

type sink struct {
	Type             string                     `json:"type"`
	ConnectionParams clickhouseConnectionParams `json:"connection_params"`
	Table            string                     `json:"table"`
	MaxBatchSize     int                        `json:"max_batch_size"`
	MaxDelayTime     models.JSONDuration        `json:"max_delay_time"`
	Mapping          []sinkMappingEntry         `json:"mapping,omitempty"`
}

type clickhouseConnectionParams struct {
	Host                        string `json:"host"`
	Port                        string `json:"port"`
	HTTPPort                    string `json:"http_port"`
	Database                    string `json:"database"`
	Username                    string `json:"username"`
	Password                    string `json:"password"`
	Secure                      bool   `json:"secure"`
	SkipCertificateVerification bool   `json:"skip_certificate_verification,omitempty"`
}

type sinkMappingEntry struct {
	Name       string `json:"name"`
	ColumnName string `json:"column_name"`
	ColumnType string `json:"column_type"`
}

type resources struct {
	NATS      *models.NatsResources      `json:"nats,omitempty"`
	Sources   []sourceResources          `json:"sources,omitempty"`
	Transform []transformResources       `json:"transform,omitempty"`
	Sink      *models.ComponentResources `json:"sink,omitempty"`
}

type sourceResources struct {
	SourceID string               `json:"source_id"`
	Replicas *int64               `json:"replicas,omitempty"`
	Requests *models.ResourceList `json:"requests,omitempty"`
	Limits   *models.ResourceList `json:"limits,omitempty"`
}

type transformResources struct {
	SourceID string                `json:"source_id"`
	Replicas *int64                `json:"replicas,omitempty"`
	Storage  *models.StorageConfig `json:"storage,omitempty"`
	Requests *models.ResourceList  `json:"requests,omitempty"`
	Limits   *models.ResourceList  `json:"limits,omitempty"`
}
