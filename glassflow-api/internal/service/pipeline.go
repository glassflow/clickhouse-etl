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
	ErrIDExists          = errors.New("pipeline with this ID already exists")
	ErrPipelineNotFound  = errors.New("no active pipeline found")
	ErrPipelineNotExists = errors.New("no pipeline with given id exists")
)

type ActivePipelineError struct {
	pipelineID string
}

func (e ActivePipelineError) Error() string {
	return fmt.Sprintf("pipeline with id %q already active; shutdown to start another", e.pipelineID)
}

type PipelineManager struct {
	nc    *client.NATSClient
	log   *slog.Logger
	store PipelineStore

	ingestorRunner *IngestorRunner
	joinRunner     *JoinRunner
	sinkRunner     *SinkRunner

	id string
	m  sync.Mutex
}

type PipelineStore interface {
	InsertPipeline(context.Context, models.PipelineConfig) error
	GetPipeline(context.Context, string) (*models.PipelineConfig, error)
}

func NewPipelineManager(
	nc *client.NATSClient,
	log *slog.Logger,
	store PipelineStore,
) *PipelineManager {
	//nolint: exhaustruct // runners will be created on setup
	return &PipelineManager{
		nc:    nc,
		log:   log,
		store: store,
	}
}

const (
	GFJoinStream    = "gf-stream-joined"
	GFJoinSubject   = "merged"
	ShutdownTimeout = 30 * time.Second
)

func (p *PipelineManager) SetupPipeline(pi *models.PipelineConfig) error {
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

	ctx := context.Background()

	existing, err := p.store.GetPipeline(ctx, pi.ID)
	if err != nil && !errors.Is(err, ErrPipelineNotExists) {
		return fmt.Errorf("check existing pipeline ID: %w", err)
	}

	if existing != nil {
		return ErrIDExists
	}

	if p.id != "" {
		return ActivePipelineError{pipelineID: p.id}
	}

	if err := p.nc.CleanupOldResources(); err != nil {
		p.log.Error("error on cleaning up nats resources", slog.Any("error", err))
	}

	var (
		sinkConsumerStream  string
		sinkConsumerSubject string
	)

	// TODO: transfer all schema mapper validations in models.NewPipeline
	// so validation errors are handled the same way with correct HTTPStatus
	schemaMapper, err := schema.NewMapper(pi.Mapper)
	if err != nil {
		return models.PipelineConfigError{Msg: fmt.Sprintf("new schema mapper: %s", err)}
	}

	p.id = pi.ID

	p.log = p.log.With("pipeline_id", p.id)

	p.ingestorRunner = NewIngestorRunner(p.log.With("component", "ingestor"), p.nc)
	p.joinRunner = NewJoinRunner(p.log.With("component", "join"), p.nc)
	p.sinkRunner = NewSinkRunner(p.log.With("component", "clickhouse_sink"), p.nc)

	for _, t := range pi.Ingestor.KafkaTopics {
		err := p.nc.CreateOrUpdateStream(ctx, t.Name, t.Name+".input", t.Deduplication.Window.Duration())
		if err != nil {
			return fmt.Errorf("setup ingestion streams for pipeline: %w", err)
		}
	}
	p.log.Debug("created ingestion streams successfully")

	for _, t := range pi.Ingestor.KafkaTopics {
		sinkConsumerStream = t.Name
		sinkConsumerSubject = t.Name + ".input"

		p.log.Debug("create ingestor for the topic", slog.String("topic", t.Name))
		err = p.ingestorRunner.Start(
			ctx, t.Name, *pi,
			schemaMapper,
		)
		if err != nil {
			return fmt.Errorf("start ingestor for topic %s: %w", t.Name, err)
		}
	}

	if pi.Join.Enabled {
		sinkConsumerStream = fmt.Sprintf("%s-%s", GFJoinStream, pi.ID)
		sinkConsumerSubject = GFJoinSubject

		err = p.nc.CreateOrUpdateStream(ctx, sinkConsumerStream, sinkConsumerSubject, 0)
		if err != nil {
			return fmt.Errorf("setup join stream for pipeline: %w", err)
		}
		p.log.Debug("created join stream successfully")

		err = p.joinRunner.SetupJoiner(ctx, "temporal", sinkConsumerSubject, schemaMapper)
		if err != nil {
			return fmt.Errorf("setup join operator: %w", err)
		}
	}

	err = p.sinkRunner.Start(
		ctx, sinkConsumerStream, sinkConsumerSubject,
		models.SinkOperatorConfig{
			Type: models.ClickHouseSinkType,
			Batch: models.BatchConfig{
				MaxBatchSize: pi.Sink.Batch.MaxBatchSize,
				MaxDelayTime: pi.Sink.Batch.MaxDelayTime,
			},
			ClickHouseConnectionParams: models.ClickHouseConnectionParamsConfig{
				Host:     pi.Sink.ClickHouseConnectionParams.Host,
				Port:     pi.Sink.ClickHouseConnectionParams.Port,
				Database: pi.Sink.ClickHouseConnectionParams.Database,
				Username: pi.Sink.ClickHouseConnectionParams.Username,
				Password: pi.Sink.ClickHouseConnectionParams.Password,
				Table:    pi.Sink.ClickHouseConnectionParams.Table,
				Secure:   pi.Sink.ClickHouseConnectionParams.Secure,
			},
		}, schemaMapper)
	if err != nil {
		return fmt.Errorf("start sink: %w", err)
	}

	err = p.store.InsertPipeline(ctx, *pi)
	if err != nil {
		return fmt.Errorf("insert pipeline: %w", err)
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

	p.ingestorRunner.Shutdown()
	p.joinRunner.Shutdown()
	p.sinkRunner.Shutdown()

	p.id = ""

	return nil
}

func (p *PipelineManager) GetPipeline(ctx context.Context, id string) (zero models.PipelineConfig, _ error) {
	p.m.Lock()
	defer p.m.Unlock()

	pi, err := p.store.GetPipeline(ctx, id)
	if err != nil {
		return zero, fmt.Errorf("load pipeline: %w", err)
	}

	return *pi, nil
}
