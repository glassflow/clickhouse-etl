package api

import (
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"

	"github.com/gorilla/mux"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/service"
)

func (h *handler) createPipeline(w http.ResponseWriter, r *http.Request) {
	req, err := parseRequest[pipelineJSON](w, r)
	if err != nil {
		var jsonErr invalidJSONError
		switch {
		case errors.As(err, &jsonErr):
			jsonError(w, http.StatusBadRequest, err.Error(), nil)
		default:
			h.log.Error("failed to read create pipeline request", slog.Any("error", err))
			serverError(w)
		}
		return
	}

	pipeline, err := req.toModel()
	if err != nil {
		jsonError(w, http.StatusUnprocessableEntity, err.Error(), nil)
		return
	}

	err = h.pipelineManager.SetupPipeline(&pipeline)
	if err != nil {
		var activePipelineErr service.ActivePipelineError
		var pErr models.PipelineConfigError
		switch {
		case errors.As(err, &activePipelineErr), errors.Is(err, service.ErrIDExists):
			jsonError(w, http.StatusForbidden, err.Error(), map[string]string{"pipeline_id": pipeline.ID})
		case errors.As(err, &pErr):
			jsonError(w, http.StatusUnprocessableEntity, err.Error(), nil)

		default:
			h.log.Error("failed to setup pipeline", slog.Any("error", err))
			serverError(w)
		}
	}
}

func (h *handler) shutdownPipeline(w http.ResponseWriter, _ *http.Request) {
	err := h.pipelineManager.ShutdownPipeline()
	if err != nil {
		switch {
		case errors.Is(err, service.ErrPipelineNotFound):
			jsonError(w, http.StatusNotFound, "no active pipeline to shutdown", nil)
		default:
			serverError(w)
		}
		return
	}

	h.log.Info("pipeline shutdown")
	w.WriteHeader(http.StatusNoContent)
}

func (h *handler) getPipeline(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, ok := vars["id"]
	if !ok {
		h.log.Error("Cannot get id param")
		serverError(w)
	}

	if len(strings.TrimSpace(id)) == 0 {
		jsonError(w, http.StatusUnprocessableEntity, "pipeline id cannot be empty", nil)
		return
	}

	p, err := h.pipelineManager.GetPipeline(r.Context(), id)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrPipelineNotExists):
			jsonError(w, http.StatusNotFound, fmt.Sprintf("pipeline with id %q does not exist", id), nil)
		default:
			h.log.Error("Unable to load pipeline", slog.Any("error", err))
			serverError(w)
		}
		return
	}

	jsonResponse(w, http.StatusOK, toPipelineJSON(p))
}

// TODO: set up pagination to avoid unsavory memory errors
func (h *handler) getPipelines(w http.ResponseWriter, r *http.Request) {
	pipelines, err := h.pipelineManager.GetPipelines(r.Context())
	if err != nil {
		h.log.Error("Unable to list pipelines", slog.Any("error", err))
		serverError(w)
		return
	}

	jsonResponse(w, http.StatusOK, pipelines)
}

type updatePipelineNameRequest struct {
	Name string `json:"name"`
}

func (h *handler) updatePipelineName(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, ok := vars["id"]
	if !ok {
		h.log.Error("Cannot get id param")
		serverError(w)
	}

	if len(strings.TrimSpace(id)) == 0 {
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
			h.log.Error("failed to read update pipeline request", slog.Any("error", err))
			serverError(w)
		}
		return
	}

	err = h.pipelineManager.UpdatePipelineName(r.Context(), id, req.Name)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrPipelineNotExists):
			jsonError(w, http.StatusNotFound, fmt.Sprintf("pipeline with id %q does not exist", id), nil)
		default:
			h.log.Error("failed to update pipeline name", slog.Any("error", err))
			serverError(w)
		}
		return
	}
}

type pipelineJSON struct {
	PipelineID string `json:"pipeline_id"`
	Name       string `json:"name"`
	Source     struct {
		Kind             string                 `json:"type"`
		Provider         string                 `json:"provider"`
		ConnectionParams sourceConnectionParams `json:"connection_params"`
		Topics           []kafkaTopic           `json:"topics"`
	} `json:"source"`
	Join struct {
		Kind    string `json:"type"`
		Enabled bool   `json:"enabled"`

		Sources []joinSource `json:"sources"`
	} `json:"join"`
	Sink clickhouseSink `json:"sink"`
}

type sourceConnectionParams struct {
	Brokers       []string `json:"brokers"`
	SkipAuth      bool     `json:"skip_auth"`
	SASLProtocol  string   `json:"protocol"`
	SASLMechanism string   `json:"mechanism"`
	SASLUsername  string   `json:"username"`
	SASLPassword  string   `json:"password"`
	TLSRoot       string   `json:"root_ca"`
}

type kafkaTopic struct {
	Topic                      string           `json:"name"`
	ID                         string           `json:"id"`
	Schema                     topicSchema      `json:"schema"`
	ConsumerGroupInitialOffset string           `json:"consumer_group_initial_offset" default:"earliest"`
	Deduplication              topicDedupConfig `json:"deduplication"`
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

	ID     string              `json:"id_field"`
	Type   string              `json:"id_field_type"`
	Window models.JSONDuration `json:"time_window"`
}

type joinSource struct {
	SourceID    string              `json:"source_id"`
	JoinKey     string              `json:"join_key"`
	Window      models.JSONDuration `json:"time_window"`
	Orientation string              `json:"orientation"`
}

type clickhouseSink struct {
	Kind string `json:"type"`
	// Add validation for null/empty values
	Host     string                    `json:"host"`
	Port     string                    `json:"port"`
	Database string                    `json:"database"`
	Username string                    `json:"username"`
	Password string                    `json:"password"`
	Table    string                    `json:"table"`
	Secure   bool                      `json:"secure"`
	Mapping  []clickhouseColumnMapping `json:"table_mapping"`

	// Add validation for range
	MaxBatchSize                int                 `json:"max_batch_size"`
	MaxDelayTime                models.JSONDuration `json:"max_delay_time" default:"60s"`
	SkipCertificateVerification bool                `json:"skip_certificate_verification"`
}

type clickhouseColumnMapping struct {
	Source    string `json:"source_id"`
	FieldName string `json:"field_name"`

	ColumnName string `json:"column_name"`
	ColumnType string `json:"column_type"`
}

func (p pipelineJSON) toModel() (zero models.PipelineConfig, _ error) {
	if len(strings.TrimSpace(p.PipelineID)) == 0 {
		return zero, fmt.Errorf("pipeline ID cannot be empty")
	}

	var (
		ic models.IngestorOperatorConfig
		jc models.JoinOperatorConfig
		sc models.SinkOperatorConfig
	)

	kcfg := models.KafkaConnectionParamsConfig{
		Brokers:       p.Source.ConnectionParams.Brokers,
		SkipAuth:      p.Source.ConnectionParams.SkipAuth,
		SASLProtocol:  p.Source.ConnectionParams.SASLProtocol,
		SASLMechanism: p.Source.ConnectionParams.SASLMechanism,
		SASLUsername:  p.Source.ConnectionParams.SASLUsername,
		SASLPassword:  p.Source.ConnectionParams.SASLPassword,
		TLSRoot:       p.Source.ConnectionParams.TLSRoot,
	}

	topics := make([]models.KafkaTopicsConfig, 0, len(p.Source.Topics))
	for _, t := range p.Source.Topics {
		topics = append(topics, models.KafkaTopicsConfig{
			Name:                       t.Topic,
			ID:                         t.ID,
			ConsumerGroupInitialOffset: t.ConsumerGroupInitialOffset,
			Deduplication: models.DeduplicationConfig{
				Enabled: t.Deduplication.Enabled,
				ID:      t.Deduplication.ID,
				Type:    t.Deduplication.Type,
				Window:  t.Deduplication.Window,
			},
		})
	}

	ic, err := models.NewIngestorOperatorConfig(p.Source.Provider, kcfg, topics)
	if err != nil {
		return zero, fmt.Errorf("ingestor config: %w", err)
	}

	if p.Join.Enabled {
		var sources []models.JoinSourceConfig
		for _, s := range p.Join.Sources {
			sources = append(sources, models.JoinSourceConfig{
				SourceID:    s.SourceID,
				JoinKey:     s.JoinKey,
				Window:      s.Window,
				Orientation: s.Orientation,
			})
		}

		jc, err = models.NewJoinOperatorConfig(p.Join.Kind, sources)
		if err != nil {
			return zero, fmt.Errorf("join config: %w", err)
		}
	}

	sc, err = models.NewClickhouseSinkOperator(models.ClickhouseSinkArgs{
		Host:                 p.Sink.Host,
		Port:                 p.Sink.Port,
		DB:                   p.Sink.Database,
		User:                 p.Sink.Username,
		Password:             p.Sink.Password,
		Table:                p.Sink.Table,
		Secure:               p.Sink.Secure,
		MaxBatchSize:         p.Sink.MaxBatchSize,
		MaxDelayTime:         p.Sink.MaxDelayTime,
		SkipCertificateCheck: p.Sink.SkipCertificateVerification,
	})
	if err != nil {
		return zero, fmt.Errorf("sink config: %w", err)
	}

	// NOTE: optimized for speed - dirty implementation mixing infra
	// with domain logic and must be changed when schema mapper doesn't mix
	// multiple components together.
	streamsCfg := make(map[string]models.StreamSchemaConfig)
	sinkCfg := make([]models.SinkMappingConfig, len(p.Sink.Mapping))
	for _, t := range p.Source.Topics {
		if len(t.Schema.Fields) == 0 {
			return zero, fmt.Errorf("topic schema must have at least one value")
		}

		var fields []models.StreamDataField
		for _, f := range t.Schema.Fields {
			field := models.StreamDataField{
				FieldName: f.Name,
				FieldType: f.DataType,
			}

			fields = append(fields, field)
		}

		//nolint: exhaustruct // join info will be filled later
		streamsCfg[t.Topic] = models.StreamSchemaConfig{
			Fields: fields,
		}

		for _, js := range p.Join.Sources {
			if js.SourceID == t.Topic {
				streamsCfg[t.Topic] = models.StreamSchemaConfig{
					Fields:          fields,
					JoinKeyField:    js.JoinKey,
					JoinOrientation: js.Orientation,
					JoinWindow:      js.Window,
				}
			}
		}

		sinkCfg = make([]models.SinkMappingConfig, len(p.Sink.Mapping))

		for i, m := range p.Sink.Mapping {
			mapping := models.SinkMappingConfig{
				ColumnName: m.ColumnName,
				StreamName: m.Source,
				FieldName:  m.FieldName,
				ColumnType: m.ColumnType,
			}

			sinkCfg[i] = mapping
		}
	}

	mc := models.MapperConfig{
		Type:        models.SchemaMapperJSONToCHType,
		Streams:     streamsCfg,
		SinkMapping: sinkCfg,
	}

	return models.NewPipelineConfig(p.PipelineID, p.Name, mc, ic, jc, sc), nil
}

func toPipelineJSON(p models.PipelineConfig) pipelineJSON {
	topics := make([]kafkaTopic, 0, len(p.Ingestor.KafkaTopics))
	for _, t := range p.Ingestor.KafkaTopics {
		//nolint: exhaustruct // schema is added later
		kt := kafkaTopic{
			Topic:                      t.Name,
			ID:                         t.ID,
			ConsumerGroupInitialOffset: t.ConsumerGroupInitialOffset,
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
		Source: struct {
			Kind             string                 `json:"type"`
			Provider         string                 `json:"provider"`
			ConnectionParams sourceConnectionParams `json:"connection_params"`
			Topics           []kafkaTopic           `json:"topics"`
		}{
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
		Join: struct {
			Kind    string `json:"type"`
			Enabled bool   `json:"enabled"`

			Sources []joinSource `json:"sources"`
		}{
			Kind:    models.TemporalJoinType,
			Enabled: p.Join.Enabled,
			Sources: joinSources,
		},
		Sink: clickhouseSink{
			Kind:                        models.ClickHouseSinkType,
			Host:                        p.Sink.ClickHouseConnectionParams.Host,
			Port:                        p.Sink.ClickHouseConnectionParams.Port,
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
	}
}
