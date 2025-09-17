package api

import (
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"

	"github.com/gorilla/mux"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
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

	err = h.pipelineManager.CreatePipeline(r.Context(), &pipeline)
	if err != nil {
		var pErr models.PipelineConfigError
		switch {
		case errors.Is(err, service.ErrPipelineQuotaReached), errors.Is(err, service.ErrIDExists):
			jsonError(w, http.StatusForbidden, err.Error(), map[string]string{"pipeline_id": pipeline.ID})
		case errors.As(err, &pErr):
			jsonError(w, http.StatusUnprocessableEntity, err.Error(), nil)

		default:
			h.log.Error("failed to setup pipeline", slog.Any("error", err))
			serverError(w)
		}
	}
}

func (h *handler) stopPipeline(w http.ResponseWriter, r *http.Request) {
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

	err := h.pipelineManager.StopPipeline(r.Context(), id)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrPipelineNotFound):
			jsonError(w, http.StatusNotFound, "no active pipeline with given id to stop", nil)
		case errors.Is(err, service.ErrNotImplemented):
			jsonError(w, http.StatusNotImplemented, "feature not implemented for this version", nil)
		default:
			serverError(w)
		}
		return
	}

	h.log.Info("pipeline stop")
	w.WriteHeader(http.StatusNoContent)
}

func (h *handler) terminatePipeline(w http.ResponseWriter, r *http.Request) {
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

	err := h.pipelineManager.TerminatePipeline(r.Context(), id)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrPipelineNotExists):
			jsonError(w, http.StatusNotFound, "no active pipeline with given id to terminate", nil)
		case errors.Is(err, service.ErrNotImplemented):
			jsonError(w, http.StatusNotImplemented, "feature not implemented for this version", nil)
		default:
			serverError(w)
		}
		return
	}

	h.log.Info("pipeline terminated")
	w.WriteHeader(http.StatusNoContent)
}

func (h *handler) pausePipeline(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, ok := vars["id"]
	if !ok {
		h.log.Error("Cannot get id param")
		serverError(w)
		return
	}

	if len(strings.TrimSpace(id)) == 0 {
		jsonError(w, http.StatusUnprocessableEntity, "pipeline id cannot be empty", nil)
		return
	}

	err := h.pipelineManager.PausePipeline(r.Context(), id)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrPipelineNotExists):
			jsonError(w, http.StatusNotFound, "no pipeline with given id to pause", nil)
		case errors.Is(err, service.ErrNotImplemented):
			jsonError(w, http.StatusNotImplemented, "feature not implemented for this version", nil)
		default:
			h.log.Error("failed to pause pipeline", slog.String("pipeline_id", id), slog.Any("error", err))
			serverError(w)
		}
		return
	}

	h.log.Info("pipeline paused", slog.String("pipeline_id", id))
	w.WriteHeader(http.StatusNoContent)
}

func (h *handler) resumePipeline(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, ok := vars["id"]
	if !ok {
		h.log.Error("Cannot get id param")
		serverError(w)
		return
	}

	if len(strings.TrimSpace(id)) == 0 {
		jsonError(w, http.StatusUnprocessableEntity, "pipeline id cannot be empty", nil)
		return
	}

	err := h.pipelineManager.ResumePipeline(r.Context(), id)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrPipelineNotExists):
			jsonError(w, http.StatusNotFound, "no pipeline with given id to resume", nil)
		case errors.Is(err, service.ErrNotImplemented):
			jsonError(w, http.StatusNotImplemented, "feature not implemented for this version", nil)
		default:
			h.log.Error("failed to resume pipeline", slog.String("pipeline_id", id), slog.Any("error", err))
			serverError(w)
		}
		return
	}

	h.log.Info("pipeline resumed", slog.String("pipeline_id", id))
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

// getPipelineHealth returns the health status of a specific pipeline
func (h *handler) getPipelineHealth(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, ok := vars["id"]
	if !ok {
		h.log.Error("Cannot get id param")
		serverError(w)
		return
	}

	if len(id) == 0 {
		jsonError(w, http.StatusBadRequest, "pipeline id cannot be empty", nil)
		return
	}

	health, err := h.pipelineManager.GetPipelineHealth(r.Context(), id)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrPipelineNotFound):
			jsonError(w, http.StatusNotFound, fmt.Sprintf("pipeline with id %q does not exist", id), nil)
		default:
			h.log.Error("failed to get pipeline health", slog.String("pipeline_id", id), slog.Any("error", err))
			serverError(w)
		}
		return
	}

	jsonResponse(w, http.StatusOK, health)
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
	Sink   clickhouseSink        `json:"sink"`
	Status models.PipelineStatus `json:"status"`
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
	Replicas                   int              `json:"replicas" default:"1"`
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
		ic models.IngestorComponentConfig
		jc models.JoinComponentConfig
		sc models.SinkComponentConfig
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

	ic, err := models.NewIngestorComponentConfig(p.Source.Provider, kcfg, topics)
	if err != nil {
		return zero, fmt.Errorf("ingestor config: %w", err)
	}

	if p.Join.Enabled {
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

		jc, err = models.NewJoinComponentConfig(p.Join.Kind, sources)
		if err != nil {
			return zero, fmt.Errorf("join config: %w", err)
		}
		jc.OutputStreamID = models.GetJoinedStreamName(p.PipelineID)

	}

	// Determine the stream ID for the sink
	var sinkStreamID string
	if p.Join.Enabled {
		// If join is enabled, sink consumes from the joined stream
		sinkStreamID = models.GetJoinedStreamName(p.PipelineID)
	} else {
		// If join is not enabled, sink consumes from the first topic's stream
		if len(p.Source.Topics) > 0 {
			sinkStreamID = models.GetIngestorStreamName(p.PipelineID, p.Source.Topics[0].Topic)
		} else {
			return zero, fmt.Errorf("no topics defined for sink when join is disabled")
		}
	}

	sc, err = models.NewClickhouseSinkComponent(models.ClickhouseSinkArgs{
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
		Type:        internal.SchemaMapperJSONToCHType,
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
		Status: p.Status.OverallStatus,
	}
}

func (h *handler) deletePipeline(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, ok := vars["id"]
	if !ok {
		h.log.Error("Cannot get id param")
		serverError(w)
		return
	}

	if len(strings.TrimSpace(id)) == 0 {
		jsonError(w, http.StatusBadRequest, "pipeline id cannot be empty", nil)
		return
	}

	// Get the pipeline to check its status
	pipeline, err := h.pipelineManager.GetPipeline(r.Context(), id)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrPipelineNotExists):
			jsonError(w, http.StatusNotFound, fmt.Sprintf("pipeline with id %q does not exist", id), nil)
		default:
			h.log.Error("failed to get pipeline for deletion", slog.String("pipeline_id", id), slog.Any("error", err))
			serverError(w)
		}
		return
	}

	// Check if pipeline is in a deletable state (stopped or terminated)
	currentStatus := string(pipeline.Status.OverallStatus)
	if currentStatus != internal.PipelineStatusStopped && currentStatus != internal.PipelineStatusTerminated {
		jsonError(w, http.StatusBadRequest,
			fmt.Sprintf("pipeline can only be deleted if it's stopped or terminated, current status: %s", currentStatus),
			map[string]string{"current_status": currentStatus})
		return
	}

	// Delete the pipeline from NATS storage
	err = h.pipelineManager.DeletePipeline(r.Context(), id)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrPipelineNotExists):
			jsonError(w, http.StatusNotFound, fmt.Sprintf("pipeline with id %q does not exist", id), nil)
		default:
			h.log.Error("failed to delete pipeline", slog.String("pipeline_id", id), slog.Any("error", err))
			serverError(w)
		}
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
