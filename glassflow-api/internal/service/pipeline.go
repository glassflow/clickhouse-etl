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

var (
	ErrUnsupportedNumberOfTopics = errors.New("unsupported number of topics")
	ErrPipelineNotFound          = errors.New("no active pipeline found")
)

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

	if p.id != "" {
		return ActivePipelineError{pipelineID: p.id}
	}

	pipeline, err := models.NewPipeline(spec)
	if err != nil {
		return fmt.Errorf("parse pipeline config: %w", err)
	}

	p.id = pipeline.ID

	p.bridgeRunner = NewBridgeRunner(NewFactory(p.natsServer, p.log))
	p.joinRunner = NewJoinRunner(p.log, p.nc)
	p.sinkRunner = NewSinkRunner(p.log, p.nc)

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

	schemaMapper, err := schema.NewMapper(streamsCfg, sinkCfg)
	if err != nil {
		return fmt.Errorf("new schema mapper: %w", err)
	}

	err = p.bridgeRunner.SetupBridges(&pipeline.KafkaConfig, pipeline.Streams)
	if err != nil {
		return fmt.Errorf("setup bridges: %w", err)
	}

	if spec.Join.Enabled {
		sinkConsumerStream = fmt.Sprintf("%s-%s", GFJoinStream, spec.PipelineID)
		sinkConsumerSubject = GFJoinSubject

		err = p.joinRunner.SetupJoiner(ctx, pipeline.Streams, sinkConsumerStream, sinkConsumerSubject, schemaMapper)
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
		return ErrPipelineNotFound
	}

	p.bridgeRunner.Shutdown(ShutdownTimeout)
	p.joinRunner.Shutdown()
	p.sinkRunner.Shutdown()

	p.id = ""

	return nil
}
