package service

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/client"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/schema"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

var ErrPipelineNotFound = errors.New("no active pipeline found")

type ActivePipelineError struct {
	pipelineID string
}

func (e ActivePipelineError) Error() string {
	return fmt.Sprintf("pipeline with id %q already active; shutdown to start another", e.pipelineID)
}

type PipelineManager struct {
	natsServer string
	nc         *client.NATSClient
	log        *slog.Logger

	bridgeRunner *BridgeRunner
	joinRunner   *JoinRunner
	sinkRunner   *SinkRunner

	id string
	m  sync.Mutex
}

func NewPipelineManager(
	natsServer string,
	nc *client.NATSClient,
	log *slog.Logger,
) *PipelineManager {
	//nolint: exhaustruct // runners will be created on setup
	return &PipelineManager{
		natsServer: natsServer,
		nc:         nc,
		log:        log,
	}
}

const (
	GFJoinStream    = "gf-stream-joined"
	GFJoinSubject   = "merged"
	ShutdownTimeout = 30 * time.Second
)

func (p *PipelineManager) SetupPipeline(spec *models.PipelineRequest) error {
	p.m.Lock()
	defer p.m.Unlock()

	var err error

	defer func() {
		if err != nil {
			p.log.Info("pipeline setup failed; cleaning up pipeline")
			//nolint: errcheck // ignore error on failed pipeline shutdown
			go p.ShutdownPipeline()
		}
	}()

	if p.id != "" {
		return ActivePipelineError{pipelineID: p.id}
	}

	if err := p.nc.CleanupOldResources(); err != nil {
		p.log.Error("error on cleaning up nats resources", slog.Any("error", err))
	}

	pipeline, err := models.NewPipeline(spec)
	if err != nil {
		return fmt.Errorf("parse pipeline config: %w", err)
	}

	ctx := context.Background()

	var (
		sinkConsumerStream  string
		sinkConsumerSubject string
	)

	streamsCfg := make(map[string]schema.StreamSchemaConfig)
	for _, s := range pipeline.Streams {
		sinkConsumerStream = s.Name
		sinkConsumerSubject = s.Subject
		var fields []schema.StreamDataField

		for _, f := range s.Schema {
			field := schema.StreamDataField{
				FieldName: f.Name,
				FieldType: f.DataType,
			}

			fields = append(fields, field)
		}

		streamsCfg[s.Name] = schema.StreamSchemaConfig{
			Fields:       fields,
			JoinKeyField: s.Join.ID,
		}
	}

	sinkCfg := make([]schema.SinkMappingConfig, len(pipeline.ClickhouseConfig.Mapping))

	for i, m := range pipeline.ClickhouseConfig.Mapping {
		mapping := schema.SinkMappingConfig{
			ColumnName: m.ColumnName,
			StreamName: m.StreamName,
			FieldName:  m.FieldName,
			ColumnType: m.ColumnType,
		}

		sinkCfg[i] = mapping
	}

	// TODO: transfer all schema mapper validations in models.NewPipeline
	// so validation errors are handled the same way with correct HTTPStatus
	schemaMapper, err := schema.NewMapper(streamsCfg, sinkCfg)
	if err != nil {
		return fmt.Errorf("new schema mapper: %w", err)
	}

	p.id = pipeline.ID

	p.log = p.log.With("pipeline_id", p.id)

	p.bridgeRunner = NewBridgeRunner(NewFactory(p.natsServer, p.log.With("component", "kafka_bridge")))
	p.joinRunner = NewJoinRunner(p.log.With("component", "join"), p.nc)
	p.sinkRunner = NewSinkRunner(p.log.With("component", "clickhouse_sink"), p.nc)

	for _, s := range pipeline.Streams {
		err := p.nc.CreateOrUpdateStream(ctx, s.Name, s.Subject, s.Deduplication.Window)
		if err != nil {
			return fmt.Errorf("setup ingestion streams for pipeline: %w", err)
		}
	}
	p.log.Debug("created ingestion streams successfully")

	err = p.bridgeRunner.SetupBridges(&pipeline.KafkaConfig, pipeline.Streams)
	if err != nil {
		return fmt.Errorf("setup bridges: %w", err)
	}

	if spec.Join.Enabled {
		sinkConsumerStream = fmt.Sprintf("%s-%s", GFJoinStream, spec.PipelineID)
		sinkConsumerSubject = GFJoinSubject

		err = p.nc.CreateOrUpdateStream(ctx, sinkConsumerStream, sinkConsumerSubject, 0)
		if err != nil {
			return fmt.Errorf("setup join stream for pipeline: %w", err)
		}
		p.log.Debug("created join stream successfully")

		err = p.joinRunner.SetupJoiner(ctx, pipeline.Streams, sinkConsumerSubject, schemaMapper)
		if err != nil {
			return fmt.Errorf("setup join operator: %w", err)
		}
	}

	err = p.sinkRunner.Start(ctx, sinkConsumerStream, sinkConsumerSubject, pipeline.ClickhouseConfig, schemaMapper)
	if err != nil {
		return fmt.Errorf("start sink: %w", err)
	}

	return nil
}

func (p *PipelineManager) ShutdownPipeline() error {
	p.m.Lock()
	defer p.m.Unlock()

	if p.id == "" {
		//nolint: wrapcheck // custom internal errors
		return ErrPipelineNotFound
	}

	p.bridgeRunner.Shutdown(ShutdownTimeout)
	p.joinRunner.Shutdown()
	p.sinkRunner.Shutdown()

	p.id = ""

	return nil
}

func (p *PipelineManager) GetPipeline() (zero string, _ error) {
	p.m.Lock()
	defer p.m.Unlock()

	if p.id == "" {
		//nolint: wrapcheck // custom internal errors
		return zero, ErrPipelineNotFound
	}

	return p.id, nil
}
