package orchestrator

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/client"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/schema"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/service"
)

type LocalOrchestrator struct {
	nc  *client.NATSClient
	log *slog.Logger

	ingestorRunners []service.Runner
	joinRunner      service.Runner
	sinkRunner      service.Runner

	id string
	m  sync.Mutex

	watcherCancel context.CancelFunc
	watcherWG     sync.WaitGroup

	// Environment configuration
	pipelineKVStoreName string
}

func NewLocalOrchestrator(
	nc *client.NATSClient,
	log *slog.Logger,
	pipelineKVStoreName string,
) service.Orchestrator {
	//nolint: exhaustruct // runners will be created on setup
	return &LocalOrchestrator{
		nc:                  nc,
		log:                 log,
		pipelineKVStoreName: pipelineKVStoreName,
	}
}

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
			//nolint: errcheck // ignore error on failed pipeline stop
			go d.StopPipeline(ctx, pi.ID)
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

	for _, t := range pi.Ingestor.KafkaTopics {
		streamName := t.OutputStreamID
		subjectName := t.OutputStreamSubject
		err := d.nc.CreateOrUpdateStream(ctx, streamName, subjectName, t.Deduplication.Window.Duration())
		if err != nil {
			return fmt.Errorf("setup ingestion streams for pipeline: %w", err)
		}
	}
	d.log.Debug("created ingestion streams successfully")

	err = d.nc.CreateOrUpdateStream(ctx, models.GetDLQStreamName(d.id), models.GetDLQStreamSubjectName(d.id), 0)

	for _, t := range pi.Ingestor.KafkaTopics {
		for i := range t.Replicas {
			sinkConsumerStream = pi.Sink.StreamID

			d.log.Debug("create ingestor for the topic", slog.String("topic", t.Name), slog.Int("replica", i))
			ingestorRunner := service.NewIngestorRunner(d.log.With("component", "ingestor", "topic", t.Name), d.nc, t.Name, *pi,
				schemaMapper)

			err = ingestorRunner.Start(ctx)
			if err != nil {
				return fmt.Errorf("start ingestor for topic %s: %w", t.Name, err)
			}

			d.ingestorRunners = append(d.ingestorRunners, ingestorRunner)
		}
	}

	if pi.Join.Enabled {
		sinkConsumerStream = pi.Sink.StreamID
		sinkConsumerSubject = models.GetNATSSubjectNameDefault(sinkConsumerStream)

		err = d.nc.CreateOrUpdateStream(ctx, sinkConsumerStream, sinkConsumerSubject, 0)
		if err != nil {
			return fmt.Errorf("setup join stream for pipeline: %w", err)
		}
		d.log.Debug("created join stream successfully")

		// Get the pipeline-specific stream names for the input streams
		var leftInputStreamName, rightInputStreamName string
		if pi.Join.Sources[0].Orientation == "left" {
			leftInputStreamName = pi.Join.Sources[0].StreamID
			rightInputStreamName = pi.Join.Sources[1].StreamID
		} else {
			leftInputStreamName = pi.Join.Sources[1].StreamID
			rightInputStreamName = pi.Join.Sources[0].StreamID
		}

		// Create join KV stores for left and right buffers
		err = d.nc.CreateOrUpdateJoinKeyValueStore(ctx, leftInputStreamName, pi.Join.LeftBufferTTL.Duration())
		if err != nil {
			return fmt.Errorf("setup join left buffer KV store for pipeline: %w", err)
		}
		d.log.Debug("created join left buffer KV store successfully")

		err = d.nc.CreateOrUpdateJoinKeyValueStore(ctx, rightInputStreamName, pi.Join.RightBufferTTL.Duration())
		if err != nil {
			return fmt.Errorf("setup join right buffer KV store for pipeline: %w", err)
		}
		d.log.Debug("created join right buffer KV store successfully")

		d.joinRunner = service.NewJoinRunner(d.log.With("component", "join"), d.nc, leftInputStreamName, rightInputStreamName, sinkConsumerStream,
			pi.Join, schemaMapper)
		err = d.joinRunner.Start(ctx)
		if err != nil {
			return fmt.Errorf("setup join component: %w", err)
		}
	}

	d.sinkRunner = service.NewSinkRunner(d.log.With("component", "clickhouse_sink"), d.nc,
		sinkConsumerStream,
		models.SinkComponentConfig{
			Type:     internal.ClickHouseSinkType,
			StreamID: sinkConsumerStream,
			Batch: models.BatchConfig{
				MaxBatchSize: pi.Sink.Batch.MaxBatchSize,
				MaxDelayTime: pi.Sink.Batch.MaxDelayTime,
			},
			ClickHouseConnectionParams: pi.Sink.ClickHouseConnectionParams,
		},
		schemaMapper,
	)

	err = d.sinkRunner.Start(ctx)
	if err != nil {
		return fmt.Errorf("start sink: %w", err)
	}

	d.startRunnerWatcher(ctx)

	return nil
}

// StopPipeline implements Orchestrator.
func (d *LocalOrchestrator) StopPipeline(ctx context.Context, pid string) error {
	d.m.Lock()
	defer d.m.Unlock()

	if d.id != pid {
		return fmt.Errorf("mismatched pipeline id: %w", service.ErrPipelineNotFound)
	}

	d.log.Info("starting pipeline stop", slog.String("pipeline_id", pid))

	// Clear pipeline ID first to stop any pending restart attempts
	d.id = ""

	if d.watcherCancel != nil {
		d.watcherCancel()
		d.watcherWG.Wait()
	}

	// First pause the pipeline if it's running
	// Check if pipeline is active (has runners)
	if d.ingestorRunners != nil || d.joinRunner != nil || d.sinkRunner != nil {
		d.log.Info("pausing pipeline before stop", slog.String("pipeline_id", pid))

		// Pause the pipeline (graceful shutdown of components)
		err := d.pausePipelineComponents()
		if err != nil {
			d.log.Error("failed to pause pipeline during stop", slog.Any("error", err))
			return fmt.Errorf("pause pipeline during stop: %w", err)
		}

		d.log.Info("pipeline paused successfully, proceeding with termination", slog.String("pipeline_id", pid))
	}

	// Now terminate the pipeline (cleanup resources)
	err := d.terminatePipelineComponents(ctx, pid)
	if err != nil {
		d.log.Error("failed to terminate pipeline during stop", slog.Any("error", err))
		return fmt.Errorf("terminate pipeline during stop: %w", err)
	}

	d.log.Info("pipeline stop completed successfully", slog.String("pipeline_id", pid))
	return nil
}

// PausePipeline implements Orchestrator.
func (d *LocalOrchestrator) PausePipeline(ctx context.Context, pid string) error {
	d.m.Lock()
	defer d.m.Unlock()

	if d.id != pid {
		return fmt.Errorf("mismatched pipeline id: %w", service.ErrPipelineNotFound)
	}

	d.log.Info("pausing pipeline", slog.String("pipeline_id", pid))

	// Stop the watcher to prevent restarts during pause
	if d.watcherCancel != nil {
		d.watcherCancel()
		d.watcherWG.Wait()
		d.watcherCancel = nil
	}

	err := d.pausePipelineComponents()
	if err != nil {
		return err
	}

	d.log.Info("pipeline paused successfully", slog.String("pipeline_id", pid))
	return nil
}

// pausePipelineComponents gracefully shuts down pipeline components in order
func (d *LocalOrchestrator) pausePipelineComponents() error {
	// Shutdown components sequentially: Ingestor -> Join -> Sink
	// This ensures no data loss by processing all messages in order

	// 1. Shutdown ingestor runners first
	if d.ingestorRunners != nil {
		for _, runner := range d.ingestorRunners {
			d.log.Debug("shutting down ingestor runner")
			runner.Shutdown()
			// Wait for the component to fully stop
			<-runner.Done()
		}
		d.log.Debug("all ingestor runners stopped")
	}

	// 2. Shutdown join runner
	if d.joinRunner != nil {
		d.log.Debug("shutting down join runner")
		d.joinRunner.Shutdown()
		// Wait for the component to fully stop
		<-d.joinRunner.Done()
		d.log.Debug("join runner stopped")
	}

	// 3. Shutdown sink runner last
	if d.sinkRunner != nil {
		d.log.Debug("shutting down sink runner")
		d.sinkRunner.Shutdown()
		// Wait for the component to fully stop
		<-d.sinkRunner.Done()
		d.log.Debug("sink runner stopped")
	}

	return nil
}

// terminatePipelineComponents cleans up pipeline resources
func (d *LocalOrchestrator) terminatePipelineComponents(ctx context.Context, pid string) error {
	// Clear pipeline ID first to stop any pending restart attempts
	d.id = ""

	// Clean up runner references
	d.ingestorRunners = nil
	d.joinRunner = nil
	d.sinkRunner = nil

	// Get pipeline config
	var pipeline *models.PipelineConfig
	configData, err := d.nc.GetKeyValue(ctx, d.pipelineKVStoreName, pid)
	if err != nil {
		d.log.Warn("could not retrieve pipeline config for cleanup", slog.Any("error", err))
		return err
	}

	err = json.Unmarshal(configData, &pipeline)
	if err != nil {
		d.log.Error("failed to unmarshal pipeline config", slog.Any("error", err))
		return err
	}

	// Clean up NATS resources
	err = d.cleanupNATSResources(ctx, pipeline)
	if err != nil {
		d.log.Error("failed to cleanup NATS resources", slog.Any("error", err))
		// Continue anyway
	}

	return nil
}

// cleanupNATSResources cleans up NATS streams and KV stores for a pipeline
func (d *LocalOrchestrator) cleanupNATSResources(ctx context.Context, pipeline *models.PipelineConfig) error {
	d.log.Info("cleaning up NATS resources for pipeline", slog.String("pipeline_id", pipeline.ID))

	// Clean up DLQ stream
	dlqStreamName := models.GetDLQStreamName(pipeline.ID)
	d.log.Debug("deleting DLQ stream", slog.String("stream", dlqStreamName))
	err := d.nc.DeleteStream(ctx, dlqStreamName)
	if err != nil {
		d.log.Error("failed to delete DLQ stream", slog.Any("error", err), slog.String("stream", dlqStreamName))
		// Continue with other cleanup even if this fails
	}

	// Clean up ingestion streams
	for _, topic := range pipeline.Ingestor.KafkaTopics {
		if topic.OutputStreamID != "" {
			d.log.Debug("deleting ingestion stream", slog.String("stream", topic.OutputStreamID))
			err := d.nc.DeleteStream(ctx, topic.OutputStreamID)
			if err != nil {
				d.log.Error("failed to delete ingestion stream", slog.Any("error", err), slog.String("stream", topic.OutputStreamID))
				// Continue with other cleanup even if this fails
			}
		}
	}

	// Clean up join resources if join is enabled
	if pipeline.Join.Enabled {
		// Clean up join output stream
		if pipeline.Join.OutputStreamID != "" {
			d.log.Debug("deleting join output stream", slog.String("stream", pipeline.Join.OutputStreamID))
			err := d.nc.DeleteStream(ctx, pipeline.Join.OutputStreamID)
			if err != nil {
				d.log.Error("failed to delete join output stream", slog.Any("error", err), slog.String("stream", pipeline.Join.OutputStreamID))
				// Continue with other cleanup even if this fails
			}
		}

		// Clean up join KV stores
		for _, source := range pipeline.Join.Sources {
			if source.StreamID != "" {
				d.log.Debug("deleting join KV store", slog.String("store", source.StreamID))
				err := d.nc.DeleteKeyValueStore(ctx, source.StreamID)
				if err != nil {
					d.log.Error("failed to delete join KV store", slog.Any("error", err), slog.String("store", source.StreamID))
					// Continue with other cleanup even if this fails
				}
			}
		}
	}

	d.log.Info("NATS resources cleanup completed", slog.String("pipeline_id", pipeline.ID))
	return nil
}

// ResumePipeline implements Orchestrator.
func (d *LocalOrchestrator) ResumePipeline(ctx context.Context, pid string) error {
	d.m.Lock()
	defer d.m.Unlock()

	if d.id != pid {
		return fmt.Errorf("mismatched pipeline id: %w", service.ErrPipelineNotFound)
	}

	d.log.Info("resuming pipeline", slog.String("pipeline_id", pid))

	// Create a new background context for the components to run in
	// This prevents the components from inheriting any cancellation from the request context
	//nolint: contextcheck // new context for long running processes
	componentCtx := context.Background()

	// Start components sequentially: Sink -> Join -> Ingestor
	// This ensures proper data flow when resuming

	// 1. Start sink runner first
	if d.sinkRunner != nil {
		d.log.Debug("starting sink runner")
		err := d.sinkRunner.Start(componentCtx)
		if err != nil {
			return fmt.Errorf("start sink runner: %w", err)
		}
		d.log.Debug("sink runner started")
	}

	// 2. Start join runner
	if d.joinRunner != nil {
		d.log.Debug("starting join runner")
		err := d.joinRunner.Start(componentCtx)
		if err != nil {
			return fmt.Errorf("start join runner: %w", err)
		}
		d.log.Debug("join runner started")
	}

	// 3. Start ingestor runners last
	if d.ingestorRunners != nil {
		for _, runner := range d.ingestorRunners {
			d.log.Debug("starting ingestor runner")
			err := runner.Start(componentCtx)
			if err != nil {
				return fmt.Errorf("start ingestor runner: %w", err)
			}
		}
		d.log.Debug("all ingestor runners started")
	}

	// Restart the watcher
	d.startRunnerWatcher(componentCtx)

	d.log.Info("pipeline resumed successfully", slog.String("pipeline_id", pid))
	return nil
}

// TerminatePipeline implements Orchestrator.
func (d *LocalOrchestrator) TerminatePipeline(ctx context.Context, pid string) error {
	return d.StopPipeline(ctx, pid)
}

func (d *LocalOrchestrator) ActivePipelineID() string {
	d.m.Lock()
	defer d.m.Unlock()

	return d.id
}

// startRunnerWatcher starts a goroutine that monitors all runners and restarts them on failure
func (d *LocalOrchestrator) startRunnerWatcher(ctx context.Context) {
	watcherCtx, cancel := context.WithCancel(ctx)
	d.watcherCancel = cancel

	d.watcherWG.Add(1)
	go func() {
		defer d.watcherWG.Done()
		d.watchRunners(watcherCtx)
	}()
}

// watchRunners monitors all runners and restarts them if they fail
func (d *LocalOrchestrator) watchRunners(ctx context.Context) {
	ticker := time.NewTicker(internal.RunnerWatcherInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			d.log.Debug("component runners watcher is stopping...")
			return
		case <-ticker.C:
			d.checkAndRestartRunners(ctx)
		}
	}
}

// checkAndRestartRunners checks all runners and restarts any that have failed
func (d *LocalOrchestrator) checkAndRestartRunners(ctx context.Context) {
	d.m.Lock()
	defer d.m.Unlock()

	// Skip if pipeline is not active
	if d.id == "" {
		return
	}

	// Check ingestor runners
	for _, runner := range d.ingestorRunners {
		select {
		case <-runner.Done():
			d.log.Warn("ingestor runner failed, restarting")
			d.restartRunner(ctx, runner)
		default:
		}
	}

	// Check join runner
	if d.joinRunner != nil {
		select {
		case <-d.joinRunner.Done():
			d.log.Warn("join runner failed, restarting")
			d.restartRunner(ctx, d.joinRunner)
		default:
		}
	}

	// Check sink runner
	if d.sinkRunner != nil {
		select {
		case <-d.sinkRunner.Done():
			d.log.Warn("sink runner failed, restarting")
			d.restartRunner(ctx, d.sinkRunner)
		default:
		}
	}
}

// restartRunner restarts any runner with delay
func (d *LocalOrchestrator) restartRunner(ctx context.Context, runner service.Runner) {
	select {
	case <-ctx.Done():
		return
	case <-time.After(internal.RunnerRestartDelay):
	}

	if d.id == "" || runner == nil {
		return
	}

	if err := runner.Start(ctx); err != nil {
		d.log.Error("failed to restart runner", slog.Any("error", err))
	} else {
		d.log.Info("runner restarted successfully")
	}
}
