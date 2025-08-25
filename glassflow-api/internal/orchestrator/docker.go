package orchestrator

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/client"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/schema"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/service"
)

type LocalOrchestrator struct {
	nc  *client.NATSClient
	log *slog.Logger

	ingestorRunner *service.IngestorRunner
	joinRunner     *service.JoinRunner
	sinkRunner     *service.SinkRunner

	id string
	m  sync.Mutex
}

func NewLocalOrchestrator(
	nc *client.NATSClient,
	log *slog.Logger,
) service.Orchestrator {
	//nolint: exhaustruct // runners will be created on setup
	return &LocalOrchestrator{
		nc:  nc,
		log: log,
	}
}

const ShutdownTimeout = 30 * time.Second

var _ service.Orchestrator = (*LocalOrchestrator)(nil)

// GetType implements Orchestrator.
func (d *LocalOrchestrator) GetType() string {
	return "local"
}

// SetupPipeline implements Orchestrator.
func (d *LocalOrchestrator) SetupPipeline(ctx context.Context, pi *models.PipelineConfig) error {
	d.m.Lock()
	defer d.m.Unlock()

	var err error

	defer func() {
		if err != nil {
			d.log.Info("pipeline setup failed; cleaning up pipeline")
			//nolint: errcheck // ignore error on failed pipeline shutdown
			go d.ShutdownPipeline(ctx, pi.ID)
		}
	}()

	if d.id != "" {
		return fmt.Errorf("setup local pipeline: %w", service.ErrPipelineQuotaReached)
	}

	// FIX IT: not working anymore since local pipeline names aren't namespaced
	// to "gf-stream"
	if err := d.nc.CleanupOldResources(ctx); err != nil {
		d.log.Error("error on cleaning up nats resources", slog.Any("error", err))
	}

	//nolint: contextcheck // new context for long running processes
	ctx = context.Background()

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

	d.id = pi.ID

	d.log = d.log.With("pipeline_id", d.id)

	d.ingestorRunner = service.NewIngestorRunner(d.log.With("component", "ingestor"), d.nc)
	d.joinRunner = service.NewJoinRunner(d.log.With("component", "join"), d.nc)
	d.sinkRunner = service.NewSinkRunner(d.log.With("component", "clickhouse_sink"), d.nc)

	for _, t := range pi.Ingestor.KafkaTopics {
		err := d.nc.CreateOrUpdateStream(ctx, t.Name, t.Name+".input", t.Deduplication.Window.Duration())
		if err != nil {
			return fmt.Errorf("setup ingestion streams for pipeline: %w", err)
		}
	}
	d.log.Debug("created ingestion streams successfully")

	err = d.nc.CreateOrUpdateStream(ctx, models.GetDLQStreamName(d.id), models.GetDLQStreamSubjectName(d.id), 0)

	for _, t := range pi.Ingestor.KafkaTopics {
		sinkConsumerStream = t.Name

		d.log.Debug("create ingestor for the topic", slog.String("topic", t.Name))
		err = d.ingestorRunner.Start(
			ctx, t.Name, sinkConsumerStream, *pi,
			schemaMapper,
		)
		if err != nil {
			return fmt.Errorf("start ingestor for topic %s: %w", t.Name, err)
		}
	}

	if pi.Join.Enabled {
		sinkConsumerStream = models.GetJoinedStreamName(pi.ID)
		sinkConsumerSubject = models.GFJoinSubject

		err = d.nc.CreateOrUpdateStream(ctx, sinkConsumerStream, sinkConsumerSubject, 0)
		if err != nil {
			return fmt.Errorf("setup join stream for pipeline: %w", err)
		}
		d.log.Debug("created join stream successfully")

		err = d.joinRunner.Start(ctx, "temporal", sinkConsumerSubject, schemaMapper)
		if err != nil {
			return fmt.Errorf("setup join operator: %w", err)
		}
	}

	err = d.sinkRunner.Start(
		ctx,
		sinkConsumerStream,
		sinkConsumerSubject,
		models.SinkOperatorConfig{
			Type: models.ClickHouseSinkType,
			Batch: models.BatchConfig{
				MaxBatchSize: pi.Sink.Batch.MaxBatchSize,
				MaxDelayTime: pi.Sink.Batch.MaxDelayTime,
			},
			ClickHouseConnectionParams: pi.Sink.ClickHouseConnectionParams,
		},
		schemaMapper,
	)
	if err != nil {
		return fmt.Errorf("start sink: %w", err)
	}

	return nil
}

// ShutdownPipeline implements Orchestrator.
func (d *LocalOrchestrator) ShutdownPipeline(_ context.Context, pid string) error {
	d.m.Lock()
	defer d.m.Unlock()

	if d.id != pid {
		return fmt.Errorf("mismatched pipeline id: %w", service.ErrPipelineNotFound)
	}

	if d.ingestorRunner != nil {
		d.ingestorRunner.Shutdown()
	}
	if d.joinRunner != nil {
		d.joinRunner.Shutdown()
	}
	if d.sinkRunner != nil {
		d.sinkRunner.Shutdown()
	}

	d.id = ""

	return nil
}

// ShutdownPipeline implements Orchestrator.
func (d *LocalOrchestrator) TerminatePipeline(_ context.Context, pid string) error {
	return d.ShutdownPipeline(context.Background(), pid)
}

func (d *LocalOrchestrator) ActivePipelineID() string {
	d.m.Lock()
	defer d.m.Unlock()

	return d.id
}
