package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/gorilla/mux"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/service"
)

func (h *handler) createPipeline(w http.ResponseWriter, r *http.Request) {
	req, err := parseRequest[pipelineRequest](w, r)
	if err != nil {
		var jsonErr invalidJSONError
		if errors.As(err, &jsonErr) {
			jsonError(w, http.StatusBadRequest, err.Error(), nil)
		} else {
			h.log.Error("failed to create pipeline request", slog.Any("error", err))
			serverError(w)
		}
		return
	}

	pipeline, err := req.ToModel()
	if err != nil {
		jsonError(w, http.StatusUnprocessableEntity, err.Error(), nil)
		return
	}

	err = h.ps.SetupPipeline(r.Context(), pipeline)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrIDExists):
			jsonError(w, http.StatusConflict, "pipeline id already exists", map[string]string{"id": req.PipelineID})
		default:
			h.log.Error("failed to save pipeline", slog.Any("error", err))
			serverError(w)
		}
		return
	}

	w.WriteHeader(http.StatusCreated)
}

func (h *handler) getPipeline(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, ok := vars["id"]
	if !ok {
		h.log.Error("Cannot get id param")
		serverError(w)
	}

	pid, err := models.NewPipelineID(id)
	if err != nil {
		jsonError(w, http.StatusUnprocessableEntity, err.Error(), nil)
		return
	}

	p, err := h.ps.GetPipeline(r.Context(), pid)
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

	jsonResponse(w, http.StatusOK, ToPipelineResponse(p))
}

func (h *handler) shutdownPipeline(w http.ResponseWriter, _ *http.Request) {
	// NOTE: noOp until operator is created
	h.log.Info("pipeline shutdown")
	w.WriteHeader(http.StatusNoContent)
}

type JSONDuration struct {
	t time.Duration
}

// NOTE: all these separate request/respone models are necessary
// because pipeline AIP contract doesn't follow the "component" logic
// and is tightly coupled with only kafka and clickhouse. This should go
// away once we have a flexible / generic JSON schema
type pipelineRequest struct {
	PipelineID string `json:"pipeline_id"`
	Source     struct {
		Kind             string                 `json:"type"`
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

	ID     string       `json:"id_field"`
	Type   string       `json:"id_field_type"`
	Window JSONDuration `json:"time_window"`
}

type joinSource struct {
	SourceID    string       `json:"source_id"`
	JoinKey     string       `json:"join_key"`
	Window      JSONDuration `json:"time_window"`
	Orientation string       `json:"orientation"`
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
	MaxBatchSize int          `json:"max_batch_size"`
	MaxDelayTime JSONDuration `json:"max_delay_time" default:"60s"`
}

type clickhouseColumnMapping struct {
	Source    string `json:"source_id"`
	FieldName string `json:"field_name"`

	ColumnName string `json:"column_name"`
	ColumnType string `json:"column_type"`
}

func (req *pipelineRequest) ToModel() (*models.Pipeline, error) {
	pid, err := models.NewPipelineID(req.PipelineID)
	if err != nil {
		return nil, err
	}

	var (
		sink models.Component
		join models.Component
	)

	graphOutputsMap := make(map[models.Component][]models.Component)

	switch req.Sink.Kind {
	case string(models.ClickhouseSink):
		var err error
		colMapArgs := []models.ClickhouseColumnMappingArgs{}

		for _, col := range req.Sink.Mapping {
			colMapArgs = append(colMapArgs, models.ClickhouseColumnMappingArgs{
				Source:     col.Source,
				Field:      col.FieldName,
				ColumnName: col.ColumnName,
				ColumnType: col.ColumnType,
			})
		}

		sink, err = models.NewClickhouseSinkComponent(
			models.ClickhouseSinkArgs{
				Host:         req.Sink.Host,
				Port:         req.Sink.Port,
				DB:           req.Sink.Database,
				User:         req.Sink.Username,
				Password:     req.Sink.Password,
				Table:        req.Sink.Table,
				Secure:       req.Sink.Secure,
				MaxBatchSize: req.Sink.MaxBatchSize,
				MaxDelayTime: req.Sink.MaxDelayTime.Duration(),
				ColMap:       colMapArgs,
			})
		if err != nil {
			return nil, fmt.Errorf("create new sink: %w", err)
		}
		graphOutputsMap[sink] = []models.Component{}

	default:
		return nil, fmt.Errorf("unsupported sink type: %s", req.Sink.Kind)
	}

	if req.Join.Enabled {
		sources := make([]models.JoinSourceArgs, len(req.Join.Sources))

		for i, s := range req.Join.Sources {
			sources[i] = models.JoinSourceArgs{
				Source:    s.SourceID,
				JoinKey:   s.JoinKey,
				Window:    s.Window.Duration(),
				JoinOrder: s.Orientation,
			}
		}

		join, err = models.NewJoinComponent(req.Join.Kind, sources)
		if err != nil {
			return nil, fmt.Errorf("new join component: %w", err)
		}

		graphOutputsMap[join] = []models.Component{sink}
	}

	switch req.Source.Kind {
	case string(models.KafkaSource):
		for _, t := range req.Source.Topics {
			schemaFieldMap := make(map[string]string)

			for _, f := range t.Schema.Fields {
				schemaFieldMap[f.Name] = f.DataType
			}

			c, err := models.NewKafkaSourceComponent(models.KafkaSourceArgs{
				Servers:                    req.Source.ConnectionParams.Brokers,
				SkipAuth:                   req.Source.ConnectionParams.SkipAuth,
				SASLUser:                   req.Source.ConnectionParams.SASLUsername,
				SASLPassword:               req.Source.ConnectionParams.SASLPassword,
				SASLMechanism:              req.Source.ConnectionParams.SASLMechanism,
				Protocol:                   req.Source.ConnectionParams.SASLProtocol,
				RootCert:                   req.Source.ConnectionParams.TLSRoot,
				TopicName:                  t.Topic,
				ConsumerGroupInitialOffset: t.ConsumerGroupInitialOffset,
				DedupEnabled:               t.Deduplication.Enabled,
				DedupKey:                   t.Deduplication.ID,
				DedupType:                  t.Deduplication.Type,
				DedupWindow:                t.Deduplication.Window.Duration(),
				SchemaKind:                 t.Schema.Type,
				SchemaMap:                  schemaFieldMap,
			})
			if err != nil {
				return nil, fmt.Errorf("create kafka source: %w", err)
			}

			// NOTE: hardcoded graph because API contract is not in shape of graph
			if req.Join.Enabled {
				graphOutputsMap[c] = []models.Component{join}
			} else {
				graphOutputsMap[c] = []models.Component{sink}
			}
		}

	default:
		return nil, fmt.Errorf("unsupported source type: %s", req.Source.Kind)
	}

	p, err := models.NewPipeline(pid, graphOutputsMap)
	if err != nil {
		return nil, fmt.Errorf("new pipeline: %w", err)
	}
	return p, nil
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

type pipelineResponse = pipelineRequest

func ToPipelineResponse(p *models.Pipeline) pipelineResponse {
	//nolint: exhaustruct // build pipeline
	res := pipelineResponse{
		PipelineID: p.ID.String(),
	}

	for _, c := range p.Components {
		switch c := c.(type) {
		case *models.KafkaSourceComponent:
			res.Source.Kind = "kafka"
			connParams := sourceConnectionParams{
				Brokers:       c.Brokers,
				SkipAuth:      c.SkipAuth,
				SASLProtocol:  c.SASLProtocol,
				SASLMechanism: c.SASLMechanism,
				SASLUsername:  c.SASLUser,
				SASLPassword:  c.SASLPassword,
				TLSRoot:       c.TLSRoot,
			}
			res.Source.ConnectionParams = connParams

			schemaFields := []topicSchemaField{}

			for _, f := range c.Topic.Schema.Fields {
				schemaFields = append(schemaFields, topicSchemaField{
					Name:     f.Name,
					DataType: f.DataType.String(),
				})
			}
			kt := kafkaTopic{
				Topic: c.Topic.Name,
				ID:    c.Topic.Name, // TODO: discuss what to do with this?
				Schema: topicSchema{
					Type:   models.JSONSchema.String(),
					Fields: schemaFields,
				},
				ConsumerGroupInitialOffset: c.Topic.ConsumerGroupInitialOffset,
				Deduplication: topicDedupConfig{
					Enabled: c.Topic.Deduplicate.Enabled,
					ID:      c.Topic.Deduplicate.Key,
					Type:    c.Topic.Deduplicate.DataType,
					Window:  JSONDuration{c.Topic.Deduplicate.Window},
				},
			}
			res.Source.Topics = append(res.Source.Topics, kt)

		case *models.JoinComponent:
			res.Join.Kind = c.Kind
			res.Join.Enabled = true

			for _, s := range c.Sources {
				res.Join.Sources = append(res.Join.Sources, joinSource{
					SourceID:    s.Source,
					JoinKey:     s.JoinKey,
					Window:      JSONDuration{s.Window},
					Orientation: s.JoinOrder.String(),
				})
			}

		case *models.ClickhouseSinkComponent:
			//nolint: exhaustruct // add mapping separately
			res.Sink = clickhouseSink{
				Kind:         "clickhouse",
				Host:         c.Host,
				Port:         c.Port,
				Database:     c.Database,
				Username:     c.Username,
				Password:     c.Password,
				Table:        c.Table,
				Secure:       c.Secure,
				MaxBatchSize: c.MaxBatchSize,
				MaxDelayTime: JSONDuration{c.MaxDelayTime},
			}

			for _, m := range c.Mapping {
				res.Sink.Mapping = append(res.Sink.Mapping, clickhouseColumnMapping{
					Source:     m.Source,
					FieldName:  m.FieldName,
					ColumnName: m.ColumnName,
					ColumnType: m.ColumnType.String(),
				})
			}
		}
	}

	return res
}
