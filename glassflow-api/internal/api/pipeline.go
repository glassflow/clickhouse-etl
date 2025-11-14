package api

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/filter"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/service"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/status"
	"github.com/gorilla/mux"
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
}

func (h *handler) resumePipeline(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, ok := vars["id"]
	if !ok {
		h.log.ErrorContext(r.Context(), "Cannot get id param")
		serverError(w)
		return
	}

	if len(strings.TrimSpace(id)) == 0 {
		h.log.ErrorContext(r.Context(), "pipeline id cannot be empty")
		jsonError(w, http.StatusUnprocessableEntity, "pipeline id cannot be empty", nil)
		return
	}

	err := h.pipelineService.ResumePipeline(r.Context(), id)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrPipelineNotExists):
			h.log.ErrorContext(r.Context(), "pipeline not found for resume", "pipeline_id", id, "error", err)
			jsonError(w, http.StatusNotFound, "no pipeline with given id to resume", nil)
		case errors.Is(err, service.ErrNotImplemented):
			h.log.ErrorContext(r.Context(), "resume pipeline feature not implemented", "pipeline_id", id, "error", err)
			jsonError(w, http.StatusNotImplemented, "feature not implemented for this version", nil)
		default:
			// Check if it's a status validation error
			if statusErr, ok := status.GetStatusValidationError(err); ok {
				jsonStatusValidationError(w, statusErr)
				return
			}
			h.log.ErrorContext(r.Context(), "failed to resume pipeline", "pipeline_id", id, "error", err)
			serverError(w)
		}
		return
	}

	h.log.InfoContext(r.Context(), "pipeline resumed", "pipeline_id", id)
	w.WriteHeader(http.StatusNoContent)
}

func (h *handler) editPipeline(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, ok := vars["id"]
	if !ok {
		h.log.ErrorContext(r.Context(), "Cannot get id param")
		serverError(w)
		return
	}

	if len(strings.TrimSpace(id)) == 0 {
		h.log.ErrorContext(r.Context(), "pipeline id cannot be empty")
		jsonError(w, http.StatusUnprocessableEntity, "pipeline id cannot be empty", nil)
		return
	}

	req, err := parseRequest[pipelineJSON](w, r)
	if err != nil {
		var jsonErr invalidJSONError
		switch {
		case errors.As(err, &jsonErr):
			jsonError(w, http.StatusBadRequest, err.Error(), nil)
		default:
			h.log.ErrorContext(r.Context(), "failed to read edit pipeline request", "error", err)
			serverError(w)
		}
		return
	}

	// Validate that pipeline_id in JSON matches the route parameter
	if req.PipelineID != id {
		h.log.ErrorContext(r.Context(), "pipeline ID mismatch", "route_id", id, "json_id", req.PipelineID)
		jsonError(w, http.StatusBadRequest, "pipeline ID in request body must match the route parameter", nil)
		return
	}

	pipeline, err := req.toModel()
	if err != nil {
		h.log.ErrorContext(r.Context(), "failed to convert request to pipeline model", "error", err)
		jsonError(w, http.StatusUnprocessableEntity, err.Error(), nil)
		return
	}

	err = h.pipelineService.EditPipeline(r.Context(), id, &pipeline)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrPipelineNotExists):
			h.log.ErrorContext(r.Context(), "pipeline not found for edit", "pipeline_id", id, "error", err)
			jsonError(w, http.StatusNotFound, "no pipeline with given id to edit", nil)
		case errors.Is(err, service.ErrNotImplemented):
			h.log.ErrorContext(r.Context(), "edit pipeline feature not implemented", "pipeline_id", id, "error", err)
			jsonError(w, http.StatusNotImplemented, "feature not implemented for this version", nil)
		default:
			// Check if it's a status validation error
			if statusErr, ok := status.GetStatusValidationError(err); ok {
				jsonStatusValidationError(w, statusErr)
				return
			}
			h.log.ErrorContext(r.Context(), "failed to edit pipeline", "pipeline_id", id, "error", err)
			serverError(w)
		}
		return
	}

	h.log.InfoContext(r.Context(), "pipeline edit initiated", "pipeline_id", id)
	w.WriteHeader(http.StatusNoContent)
}

type updatePipelineNameRequest struct {
	Name string `json:"name"`
}

func (h *handler) updatePipelineName(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, ok := vars["id"]
	if !ok {
		h.log.ErrorContext(r.Context(), "Cannot get id param")
		serverError(w)
	}

	if len(strings.TrimSpace(id)) == 0 {
		h.log.ErrorContext(r.Context(), "pipeline id cannot be empty")
		jsonError(w, http.StatusUnprocessableEntity, "pipeline id cannot be empty", nil)
		return
	}

	req, err := parseRequest[updatePipelineNameRequest](w, r)
	if err != nil {
		var jsonErr invalidJSONError
		switch {
		case errors.As(err, &jsonErr):
			jsonError(w, http.StatusBadRequest, err.Error(), nil)
		default:
			h.log.ErrorContext(r.Context(), "failed to read update pipeline request", "error", err)
			serverError(w)
		}
		return
	}

	err = h.pipelineService.UpdatePipelineName(r.Context(), id, req.Name)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrPipelineNotExists):
			h.log.ErrorContext(r.Context(), "pipeline not found for name update", "pipeline_id", id, "new_name", req.Name, "error", err)
			jsonError(w, http.StatusNotFound, fmt.Sprintf("pipeline with id %q does not exist", id), nil)
		default:
			h.log.ErrorContext(r.Context(), "failed to update pipeline name", "error", err)
			serverError(w)
		}
		return
	}
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
	Expression string `json:"expression"`
}

type pipelineJSON struct {
	PipelineID string         `json:"pipeline_id"`
	Name       string         `json:"name"`
	Source     pipelineSource `json:"source"`
	Join       pipelineJoin   `json:"join,omitempty"`
	Filter     pipelineFilter `json:"filter,omitempty"`
	Sink       clickhouseSink `json:"sink"`

	// Metadata fields (ignored, for backwards compatibility with exported configs)
	Version    string `json:"version,omitempty"`
	ExportedAt string `json:"exported_at,omitempty"`
	ExportedBy string `json:"exported_by,omitempty"`
}

type sourceConnectionParams struct {
	Brokers             []string `json:"brokers"`
	SkipAuth            bool     `json:"skip_auth"`
	SASLProtocol        string   `json:"protocol"`
	SASLMechanism       string   `json:"mechanism,omitempty"`
	SASLUsername        string   `json:"username,omitempty"`
	SASLPassword        string   `json:"password,omitempty"`
	SASLTLSEnable       bool     `json:"sasl_tls_enable,omitempty"`
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
	Schema                     topicSchema      `json:"schema"`
	ConsumerGroupInitialOffset string           `json:"consumer_group_initial_offset,omitempty" default:"earliest"`
	Replicas                   int              `json:"replicas,omitempty" default:"1"`
	Deduplication              topicDedupConfig `json:"deduplication,omitempty"`
}

type topicSchema struct {
	Type   string             `json:"type"`
	Fields []topicSchemaField `json:"fields"`
}

type topicSchemaField struct {
	Name     string `json:"name"`
	DataType string `json:"type"`
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
	Host     string                    `json:"host"`
	Port     string                    `json:"port"`      // native port used in BE connection
	HttpPort string                    `json:"http_port"` // http port used by UI for FE connection
	Database string                    `json:"database"`
	Username string                    `json:"username"`
	Password string                    `json:"password"`
	Table    string                    `json:"table"`
	Secure   bool                      `json:"secure"`
	Mapping  []clickhouseColumnMapping `json:"table_mapping"`

	// Add validation for range
	MaxBatchSize                int                 `json:"max_batch_size"`
	MaxDelayTime                models.JSONDuration `json:"max_delay_time" format:"duration" doc:"Maximum delay time for batching (e.g., 60s, 1m, 5m)" example:"1m"`
	SkipCertificateVerification bool                `json:"skip_certificate_verification,omitempty" default:"false"`
}

type clickhouseColumnMapping struct {
	Source    string `json:"source_id"`
	FieldName string `json:"field_name"`

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
		SASLTLSEnable:       p.Source.ConnectionParams.SASLTLSEnable,
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
				Type:    t.Deduplication.Type,
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

	var sources []models.JoinSourceConfig
	for _, s := range p.Join.Sources {
		// Generate OutputStreamID using pipeline ID and source ID (topic name)
		streamID := models.GetIngestorStreamName(p.PipelineID, s.SourceID)
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
			sinkStreamID = models.GetIngestorStreamName(p.PipelineID, p.Source.Topics[0].Topic)
		} else {
			return "", fmt.Errorf("no topics defined for sink when join is disabled")
		}
	}

	return sinkStreamID, nil
}

func mapFieldsToStreamDataFields(fields []topicSchemaField) []models.StreamDataField {
	var resp []models.StreamDataField
	for _, f := range fields {
		field := models.StreamDataField{
			FieldName: f.Name,
			FieldType: f.DataType,
		}

		resp = append(resp, field)
	}

	return resp
}

func newMapperConfig(pipeline pipelineJSON) (zero models.MapperConfig, _ error) {
	// NOTE: optimized for speed - dirty implementation mixing infra
	// with domain logic and must be changed when schema mapper doesn't mix
	// multiple components together.
	streamsCfg := make(map[string]models.StreamSchemaConfig)
	sinkCfg := make([]models.SinkMappingConfig, len(pipeline.Sink.Mapping))
	for _, t := range pipeline.Source.Topics {
		if len(t.Schema.Fields) == 0 {
			return zero, fmt.Errorf("topic schema must have at least one value")
		}

		fields := mapFieldsToStreamDataFields(t.Schema.Fields)

		//nolint: exhaustruct // join info will be filled later
		streamsCfg[t.Topic] = models.StreamSchemaConfig{
			Fields: fields,
		}

		for _, js := range pipeline.Join.Sources {
			if js.SourceID == t.Topic {
				streamsCfg[t.Topic] = models.StreamSchemaConfig{
					Fields:          fields,
					JoinKeyField:    js.JoinKey,
					JoinOrientation: js.Orientation,
					JoinWindow:      js.Window,
				}
			}
		}

		sinkCfg = make([]models.SinkMappingConfig, len(pipeline.Sink.Mapping))

		for i, m := range pipeline.Sink.Mapping {
			mapping := models.SinkMappingConfig{
				ColumnName: m.ColumnName,
				StreamName: m.Source,
				FieldName:  m.FieldName,
				ColumnType: m.ColumnType,
			}

			sinkCfg[i] = mapping
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

	fields := mapFieldsToStreamDataFields(pipeline.Source.Topics[0].Schema.Fields)

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

func (pipeline pipelineJSON) toModel() (zero models.PipelineConfig, _ error) {
	if len(strings.TrimSpace(pipeline.PipelineID)) == 0 {
		return zero, fmt.Errorf("pipeline ID cannot be empty")
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

	return models.NewPipelineConfig(
		pipeline.PipelineID,
		pipeline.Name,
		mapperConfig,
		ingestorComponentConfig,
		joinComponentConfig,
		sinkComponentConfig,
		filterConfig,
	), nil
}

func toPipelineJSON(p models.PipelineConfig) pipelineJSON {
	topics := make([]kafkaTopic, 0, len(p.Ingestor.KafkaTopics))
	for _, t := range p.Ingestor.KafkaTopics {
		//nolint: exhaustruct // schema is added later
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

		for name, mapper := range p.Mapper.Streams {
			var schemaFields []topicSchemaField

			if name == t.Name {
				for _, f := range mapper.Fields {
					schemaFields = append(schemaFields, topicSchemaField{
						Name:     f.FieldName,
						DataType: f.FieldType,
					})
				}

				kt.Schema = topicSchema{
					Type:   "json",
					Fields: schemaFields,
				}
			}
		}

		topics = append(topics, kt)
	}

	chMapping := make([]clickhouseColumnMapping, 0, len(p.Mapper.SinkMapping))
	for _, m := range p.Mapper.SinkMapping {
		chMapping = append(chMapping, clickhouseColumnMapping{
			Source:     m.StreamName,
			FieldName:  m.FieldName,
			ColumnName: m.ColumnName,
			ColumnType: m.ColumnType,
		})
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
				Brokers:       p.Ingestor.KafkaConnectionParams.Brokers,
				SkipAuth:      p.Ingestor.KafkaConnectionParams.SkipAuth,
				SASLProtocol:  p.Ingestor.KafkaConnectionParams.SASLProtocol,
				SASLMechanism: p.Ingestor.KafkaConnectionParams.SASLMechanism,
				SASLUsername:  p.Ingestor.KafkaConnectionParams.SASLUsername,
				SASLPassword:  p.Ingestor.KafkaConnectionParams.SASLPassword,
				TLSRoot:       p.Ingestor.KafkaConnectionParams.TLSRoot,
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
			Mapping:                     chMapping,
			MaxBatchSize:                p.Sink.Batch.MaxBatchSize,
			MaxDelayTime:                p.Sink.Batch.MaxDelayTime,
			SkipCertificateVerification: p.Sink.ClickHouseConnectionParams.SkipCertificateCheck,
		},
		Filter: pipelineFilter{
			Enabled:    p.Filter.Enabled,
			Expression: p.Filter.Expression,
		},
	}
}

func (h *handler) deletePipeline(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, ok := vars["id"]
	if !ok {
		h.log.ErrorContext(r.Context(), "Cannot get id param")
		serverError(w)
		return
	}

	if len(strings.TrimSpace(id)) == 0 {
		h.log.ErrorContext(r.Context(), "pipeline id cannot be empty")
		jsonError(w, http.StatusBadRequest, "pipeline id cannot be empty", nil)
		return
	}

	// Get the pipeline to check its status
	pipeline, err := h.pipelineService.GetPipeline(r.Context(), id)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrPipelineNotExists):
			h.log.ErrorContext(r.Context(), "pipeline not found for deletion", "pipeline_id", id, "error", err)
			jsonError(w, http.StatusNotFound, fmt.Sprintf("pipeline with id %q does not exist", id), nil)
		default:
			h.log.ErrorContext(r.Context(), "failed to get pipeline for deletion", "pipeline_id", id, "error", err)
			serverError(w)
		}
		return
	}

	// Check if pipeline is in a deletable state (stopped)
	currentStatus := string(pipeline.Status.OverallStatus)
	if currentStatus != internal.PipelineStatusStopped {
		h.log.ErrorContext(r.Context(), "pipeline cannot be deleted due to invalid status", "pipeline_id", id, "current_status", currentStatus)
		jsonError(w, http.StatusBadRequest,
			fmt.Sprintf("pipeline can only be deleted if it's stopped, current status: %s", currentStatus),
			map[string]string{"current_status": currentStatus})
		return
	}

	err = h.pipelineService.DeletePipeline(r.Context(), id)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrPipelineNotExists):
			h.log.ErrorContext(r.Context(), "pipeline not found for deletion", "pipeline_id", id, "error", err)
			jsonError(w, http.StatusNotFound, fmt.Sprintf("pipeline with id %q does not exist", id), nil)
		case errors.Is(err, service.ErrNotImplemented):
			h.log.ErrorContext(r.Context(), "delete pipeline feature not implemented", "pipeline_id", id, "error", err)
			jsonError(w, http.StatusNotImplemented, "feature not implemented for this version", nil)
		default:
			// Check if it's a status validation error
			if statusErr, ok := status.GetStatusValidationError(err); ok {
				jsonStatusValidationError(w, statusErr)
				return
			}
			h.log.ErrorContext(r.Context(), "failed to delete pipeline", "pipeline_id", id, "error", err)
			serverError(w)
		}
		return
	}

	h.log.InfoContext(r.Context(), "pipeline deleted")
	w.WriteHeader(http.StatusNoContent)
}
