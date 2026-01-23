package orchestrator

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"go.opentelemetry.io/otel/trace/noop"

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

	// Store pipeline config in memory for cleanup
	pipelineConfig *models.PipelineConfig
}

func (d *LocalOrchestrator) DeletePipeline(ctx context.Context, pid string) error {
	d.log.InfoContext(ctx, "deleting docker pipeline", "pipeline_id", pid)

	// Terminate the pipeline to clean up any remaining resources
	err := d.TerminatePipeline(ctx, pid)
	if err != nil {
		d.log.ErrorContext(ctx, "failed to terminate pipeline during deletion", "pipeline_id", pid, "error", err)
		return fmt.Errorf("terminate pipeline during deletion: %w", err)
	}

	d.log.InfoContext(ctx, "successfully deleted docker pipeline", "pipeline_id", pid)
	return nil
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
		d.log.ErrorContext(ctx, "pipeline quota reached - only one local pipeline allowed", "existing_pipeline_id", d.id)
		return fmt.Errorf("setup local pipeline: %w", service.ErrPipelineQuotaReached)
	}

	// FIX IT: not working anymore since local pipeline names aren't namespaced
	// to "gf-stream"
	if err := d.nc.CleanupOldResources(ctx); err != nil {
		d.log.ErrorContext(ctx, "error on cleaning up nats resources", "error", err)
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

	// Store pipeline config in memory for cleanup
	d.pipelineConfig = pi

	d.log = d.log.With("pipeline_id", d.id)

	for _, t := range pi.Ingestor.KafkaTopics {
		streamName := t.OutputStreamID
		subjectName := t.OutputStreamSubject
		err := d.nc.CreateOrUpdateStream(ctx, streamName, subjectName, t.Deduplication.Window.Duration())
		if err != nil {
			d.log.ErrorContext(ctx, "failed to create ingestion stream", "stream_name", streamName, "subject_name", subjectName, "error", err)
			return fmt.Errorf("setup ingestion streams for pipeline: %w", err)
		}
	}
	d.log.DebugContext(ctx, "created ingestion streams successfully")

	err = d.nc.CreateOrUpdateStream(ctx, models.GetDLQStreamName(d.id), models.GetDLQStreamSubjectName(d.id), 0)

	for _, t := range pi.Ingestor.KafkaTopics {
		for i := range t.Replicas {
			d.log.DebugContext(ctx, "create ingestor for the topic", "topic", t.Name, "replica", i)
			ingestorRunner := service.NewIngestorRunner(d.log.With("component", "ingestor", "topic", t.Name), d.nc, t.Name, *pi,
				schemaMapper, nil) // nil meter for docker orchestrator

			err = ingestorRunner.Start(ctx)
			if err != nil {
				d.log.ErrorContext(ctx, "failed to start ingestor runner", "topic", t.Name, "replica", i, "error", err)
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
			d.log.ErrorContext(ctx, "failed to create join stream", "stream_name", sinkConsumerStream, "subject_name", sinkConsumerSubject, "error", err)
			return fmt.Errorf("setup join stream for pipeline: %w", err)
		}
		d.log.DebugContext(ctx, "created join stream successfully")

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
			d.log.ErrorContext(ctx, "failed to create join left buffer KV store", "stream_name", leftInputStreamName, "ttl", pi.Join.LeftBufferTTL.Duration(), "error", err)
			return fmt.Errorf("setup join left buffer KV store for pipeline: %w", err)
		}
		d.log.DebugContext(ctx, "created join left buffer KV store successfully")

		err = d.nc.CreateOrUpdateJoinKeyValueStore(ctx, rightInputStreamName, pi.Join.RightBufferTTL.Duration())
		if err != nil {
			d.log.ErrorContext(ctx, "failed to create join right buffer KV store", "stream_name", rightInputStreamName, "ttl", pi.Join.RightBufferTTL.Duration(), "error", err)
			return fmt.Errorf("setup join right buffer KV store for pipeline: %w", err)
		}
		d.log.DebugContext(ctx, "created join right buffer KV store successfully")

		d.joinRunner = service.NewJoinRunner(d.log.With("component", "join"), d.nc, leftInputStreamName, rightInputStreamName, sinkConsumerStream,
			pi.Join, schemaMapper)
		err = d.joinRunner.Start(ctx)
		if err != nil {
			d.log.ErrorContext(ctx, "failed to start join runner", "left_stream", leftInputStreamName, "right_stream", rightInputStreamName, "error", err)
			return fmt.Errorf("setup join component: %w", err)
		}
	}

	d.sinkRunner = service.NewSinkRunner(
		d.log.With("component", "clickhouse_sink"),
		d.nc,
		*pi,
		schemaMapper,
		nil, // nil meter for docker orchestrator
		noop.NewTracerProvider().Tracer("glassflow-etl"), // no-op tracer for docker orchestrator
	)

	err = d.sinkRunner.Start(ctx)
	if err != nil {
		d.log.ErrorContext(ctx, "failed to start sink runner", "error", err)
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
		d.log.ErrorContext(ctx, "mismatched pipeline id for stop", "expected_id", d.id, "requested_id", pid)
		return fmt.Errorf("mismatched pipeline id: %w", service.ErrPipelineNotFound)
	}

	d.log.InfoContext(ctx, "starting pipeline stop", "pipeline_id", pid)

	if d.watcherCancel != nil {
		d.watcherCancel()
		d.watcherWG.Wait()
	}

	// First pause the pipeline if it's running
	// Check if pipeline is active (has runners)
	if d.ingestorRunners != nil || d.joinRunner != nil || d.sinkRunner != nil {
		d.log.InfoContext(ctx, "pausing pipeline before stop", "pipeline_id", pid)

		// Pause the pipeline (graceful shutdown of components)
		err := d.pausePipelineComponents(ctx)
		if err != nil {
			d.log.ErrorContext(ctx, "failed to pause pipeline during stop", "error", err)
			return fmt.Errorf("pause pipeline during stop: %w", err)
		}

		d.log.InfoContext(ctx, "pipeline paused successfully, proceeding with termination", "pipeline_id", pid)
	}

	// Now terminate the pipeline (cleanup resources)
	err := d.terminatePipelineComponents(ctx, pid)
	if err != nil {
		d.log.ErrorContext(ctx, "failed to terminate pipeline during stop", "error", err)
		return fmt.Errorf("terminate pipeline during stop: %w", err)
	}

	d.log.InfoContext(ctx, "pipeline stop completed successfully", "pipeline_id", pid)
	return nil
}

// pausePipelineComponents gracefully shuts down pipeline components in order
func (d *LocalOrchestrator) pausePipelineComponents(ctx context.Context) error {
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

	// 2. Check join and shutdown join runner
	if d.joinRunner != nil {
		pipeline, err := d.getPipelineConfig(ctx)
		if err != nil {
			d.log.ErrorContext(ctx, "failed to get pipeline config for join safety check", "error", err)
			return fmt.Errorf("get pipeline config for join safety check: %w", err)
		}

		// Wait for join pending messages to clear
		checkJoinFunc := func(ctx context.Context, pipeline *models.PipelineConfig) error {
			if !pipeline.Join.Enabled {
				return nil // No join, nothing to check
			}

			leftConsumerName := models.GetNATSJoinLeftConsumerName(pipeline.ID)
			rightConsumerName := models.GetNATSJoinRightConsumerName(pipeline.ID)
			leftStreamName := pipeline.Join.Sources[0].StreamID
			rightStreamName := pipeline.Join.Sources[1].StreamID

			// Check left stream
			err := d.checkConsumerPendingMessages(ctx, leftStreamName, leftConsumerName)
			if err != nil {
				d.log.ErrorContext(ctx, "left join consumer has pending messages", "left_consumer", leftConsumerName, "left_stream", leftStreamName, "error", err)
				return fmt.Errorf("left join consumer: %w", err)
			}

			// Check right stream
			err = d.checkConsumerPendingMessages(ctx, rightStreamName, rightConsumerName)
			if err != nil {
				d.log.ErrorContext(ctx, "right join consumer has pending messages", "right_consumer", rightConsumerName, "right_stream", rightStreamName, "error", err)
				return fmt.Errorf("right join consumer: %w", err)
			}

			d.log.InfoContext(ctx, "join consumers are clear of pending messages",
				"left_consumer", leftConsumerName,
				"right_consumer", rightConsumerName)

			return nil
		}
		err = d.waitForPendingMessagesToClear(context.Background(), pipeline, checkJoinFunc, "join")
		if err != nil {
			d.log.ErrorContext(ctx, "waiting for join pending messages to clear failed", "error", err)
			return fmt.Errorf("waiting for join pending messages to clear failed: %w", err)
		}

		d.log.Debug("shutting down join runner")
		d.joinRunner.Shutdown()
		// Wait for the component to fully stop
		<-d.joinRunner.Done()
		d.log.Debug("join runner stopped")
	}

	// 3. Check sink and shutdown sink runner
	if d.sinkRunner != nil {
		pipeline, err := d.getPipelineConfig(ctx)
		if err != nil {
			d.log.ErrorContext(ctx, "failed to get pipeline config for sink safety check", "error", err)
			return fmt.Errorf("get pipeline config for sink safety check: %w", err)
		}

		// Wait for sink pending messages to clear
		checkSinkFunc := func(ctx context.Context, pipeline *models.PipelineConfig) error {
			sinkConsumerName := models.GetNATSSinkConsumerName(pipeline.ID)
			sinkStreamName := pipeline.Sink.StreamID

			err := d.checkConsumerPendingMessages(ctx, sinkStreamName, sinkConsumerName)
			if err != nil {
				d.log.ErrorContext(ctx, "sink consumer has pending messages", "sink_consumer", sinkConsumerName, "sink_stream", sinkStreamName, "error", err)
				return fmt.Errorf("sink consumer: %w", err)
			}

			return nil
		}
		err = d.waitForPendingMessagesToClear(context.Background(), pipeline, checkSinkFunc, "sink")
		if err != nil {
			d.log.ErrorContext(ctx, "waiting for sink pending messages to clear failed", "error", err)
			return fmt.Errorf("waiting for sink pending messages to clear failed: %w", err)
		}

		d.log.Debug("shutting down sink runner")
		d.sinkRunner.Shutdown()
		// Wait for the component to fully stop
		<-d.sinkRunner.Done()
		d.log.Debug("sink runner stopped")
	}

	return nil
}

// waitForPendingMessagesToClear waits for consumers to clear pending messages using a provided check function
func (d *LocalOrchestrator) waitForPendingMessagesToClear(ctx context.Context, pipeline *models.PipelineConfig, checkFunc func(context.Context, *models.PipelineConfig) error, componentName string) error {
	maxRetries := 30 // 1 minute with 2-second intervals
	retryInterval := 2 * time.Second

	for i := 0; i < maxRetries; i++ {
		err := checkFunc(ctx, pipeline)
		if err != nil {
			d.log.InfoContext(ctx, fmt.Sprintf("%s has pending messages, waiting...", componentName),
				"pipeline_id", pipeline.ID,
				"retry", i+1,
				"error", err.Error())

			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(retryInterval):
				continue
			}
		}

		// Checks passed
		d.log.InfoContext(ctx, fmt.Sprintf("%s consumers are clear of pending messages", componentName),
			"pipeline_id", pipeline.ID)
		return nil
	}

	d.log.ErrorContext(ctx, "timeout waiting for pending messages to clear", "component", componentName, "pipeline_id", pipeline.ID, "max_retries", maxRetries)
	return fmt.Errorf("timeout waiting for %s pending messages to clear after %d retries", componentName, maxRetries)
}

// getPipelineConfig retrieves pipeline config from memory
func (d *LocalOrchestrator) getPipelineConfig(ctx context.Context) (*models.PipelineConfig, error) {
	if d.pipelineConfig == nil {
		d.log.ErrorContext(ctx, "pipeline config not available in memory")
		return nil, fmt.Errorf("pipeline config not available in memory")
	}

	return d.pipelineConfig, nil
}

// checkConsumerPendingMessages checks if a specific consumer has pending messages
func (d *LocalOrchestrator) checkConsumerPendingMessages(ctx context.Context, streamName, consumerName string) error {
	hasPending, pending, unack, err := d.nc.CheckConsumerPendingMessages(ctx, streamName, consumerName)
	if err != nil {
		d.log.ErrorContext(ctx, "failed to check consumer pending messages", "consumer", consumerName, "stream", streamName, "error", err)
		return fmt.Errorf("check consumer %s: %w", consumerName, err)
	}
	if hasPending {
		d.log.WarnContext(ctx, "consumer has pending messages",
			"consumer", consumerName,
			"stream", streamName,
			"pending", pending,
			"unacknowledged", unack)
		return fmt.Errorf("consumer %s has %d pending and %d unacknowledged messages", consumerName, pending, unack)
	}

	d.log.InfoContext(ctx, "consumer is clear of pending messages",
		"consumer", consumerName,
		"stream", streamName)

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

	// Clean up NATS resources using stored config
	if d.pipelineConfig != nil {
		err := d.cleanupNATSResources(ctx, d.pipelineConfig)
		if err != nil {
			d.log.ErrorContext(ctx, "failed to cleanup NATS resources", "error", err)
			// Continue anyway
		}
	} else {
		d.log.Warn("no pipeline config available for cleanup")
	}

	// Clear pipeline config at the end (similar to cleaning d.id)
	d.pipelineConfig = nil

	return nil
}

// cleanupNATSResources cleans up NATS streams and KV stores for a pipeline
func (d *LocalOrchestrator) cleanupNATSResources(ctx context.Context, pipeline *models.PipelineConfig) error {
	d.log.InfoContext(ctx, "cleaning up NATS resources for pipeline", "pipeline_id", pipeline.ID)

	// Clean up DLQ stream
	dlqStreamName := models.GetDLQStreamName(pipeline.ID)
	d.log.DebugContext(ctx, "deleting DLQ stream", "stream", dlqStreamName)
	err := d.nc.DeleteStream(ctx, dlqStreamName)
	if err != nil {
		d.log.ErrorContext(ctx, "failed to delete DLQ stream", "error", err, "stream", dlqStreamName)
		// Continue with other cleanup even if this fails
	}

	// Clean up ingestion streams
	for _, topic := range pipeline.Ingestor.KafkaTopics {
		if topic.OutputStreamID != "" {
			d.log.DebugContext(ctx, "deleting ingestion stream", "stream", topic.OutputStreamID)
			err := d.nc.DeleteStream(ctx, topic.OutputStreamID)
			if err != nil {
				d.log.ErrorContext(ctx, "failed to delete ingestion stream", "error", err, "stream", topic.OutputStreamID)
				// Continue with other cleanup even if this fails
			}
		}
	}

	// Clean up join resources if join is enabled
	if pipeline.Join.Enabled {
		// Clean up join output stream
		if pipeline.Join.OutputStreamID != "" {
			d.log.DebugContext(ctx, "deleting join output stream", "stream", pipeline.Join.OutputStreamID)
			err := d.nc.DeleteStream(ctx, pipeline.Join.OutputStreamID)
			if err != nil {
				d.log.ErrorContext(ctx, "failed to delete join output stream", "error", err, "stream", pipeline.Join.OutputStreamID)
				// Continue with other cleanup even if this fails
			}
		}

		// Clean up join KV stores
		for _, source := range pipeline.Join.Sources {
			if source.StreamID != "" {
				d.log.DebugContext(ctx, "deleting join KV store", "store", source.StreamID)
				err := d.nc.DeleteKeyValueStore(ctx, source.StreamID)
				if err != nil {
					d.log.ErrorContext(ctx, "failed to delete join KV store", "error", err, "store", source.StreamID)
					// Continue with other cleanup even if this fails
				}
			}
		}
	}

	d.log.InfoContext(ctx, "NATS resources cleanup completed", "pipeline_id", pipeline.ID)
	return nil
}

// ResumePipeline implements Orchestrator.
func (d *LocalOrchestrator) ResumePipeline(ctx context.Context, pid string, pipelineCfg *models.PipelineConfig) error {
	d.m.Lock()
	defer d.m.Unlock()

	if d.id != pid {
		d.log.ErrorContext(ctx, "mismatched pipeline id for resume", "expected_id", d.id, "requested_id", pid)
		return fmt.Errorf("mismatched pipeline id: %w", service.ErrPipelineNotFound)
	}

	d.log.InfoContext(ctx, "resuming pipeline", "pipeline_id", pid)

	// Create a new background context for the components to run in
	// This prevents the components from inheriting any cancellation from the request context
	//nolint: contextcheck // new context for long running processes
	componentCtx := context.Background()

	// Start components sequentially: Sink -> Join -> Ingestor
	// This ensures proper data flow when resuming

	// 1. Start sink runner first
	if d.sinkRunner != nil {
		d.log.DebugContext(componentCtx, "starting sink runner")
		err := d.sinkRunner.Start(componentCtx)
		if err != nil {
			d.log.ErrorContext(componentCtx, "failed to start sink runner during resume", "error", err)
			return fmt.Errorf("start sink runner: %w", err)
		}
		d.log.DebugContext(componentCtx, "sink runner started")
	}

	// 2. Start join runner
	if d.joinRunner != nil {
		d.log.DebugContext(componentCtx, "starting join runner")
		err := d.joinRunner.Start(componentCtx)
		if err != nil {
			d.log.ErrorContext(componentCtx, "failed to start join runner during resume", "error", err)
			return fmt.Errorf("start join runner: %w", err)
		}
		d.log.DebugContext(componentCtx, "join runner started")
	}

	// 3. Start ingestor runners last
	if d.ingestorRunners != nil {
		for _, runner := range d.ingestorRunners {
			d.log.DebugContext(componentCtx, "starting ingestor runner")
			err := runner.Start(componentCtx)
			if err != nil {
				d.log.ErrorContext(componentCtx, "failed to start ingestor runner during resume", "error", err)
				return fmt.Errorf("start ingestor runner: %w", err)
			}
		}
		d.log.DebugContext(componentCtx, "all ingestor runners started")
	}

	// Restart the watcher
	d.startRunnerWatcher(componentCtx)

	d.log.InfoContext(ctx, "pipeline resumed successfully", "pipeline_id", pid)
	return nil
}

// EditPipeline implements Orchestrator.
func (d *LocalOrchestrator) EditPipeline(ctx context.Context, pid string, newCfg *models.PipelineConfig) error {
	d.log.InfoContext(ctx, "editing local pipeline", "pipeline_id", pid)

	// Check if this is the active pipeline
	d.m.Lock()
	activeID := d.id
	d.m.Unlock()

	if activeID != pid {
		d.log.ErrorContext(ctx, "pipeline is not active", "pipeline_id", pid, "active_pipeline_id", activeID)
		return fmt.Errorf("pipeline %s is not active, cannot edit", pid)
	}

	// Update the pipeline configuration
	d.m.Lock()
	d.pipelineConfig = newCfg
	d.m.Unlock()

	// Start the pipeline with new configuration
	err := d.SetupPipeline(ctx, newCfg)
	if err != nil {
		d.log.ErrorContext(ctx, "failed to setup pipeline with new config", "pipeline_id", pid, "error", err)
		return fmt.Errorf("setup pipeline with new config: %w", err)
	}

	d.log.InfoContext(ctx, "pipeline edited successfully", "pipeline_id", pid)
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
			d.log.DebugContext(ctx, "component runners watcher is stopping...")
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
			d.log.WarnContext(ctx, "ingestor runner failed, restarting")
			d.restartRunner(ctx, runner)
		default:
		}
	}

	// Check join runner
	if d.joinRunner != nil {
		select {
		case <-d.joinRunner.Done():
			d.log.WarnContext(ctx, "join runner failed, restarting")
			d.restartRunner(ctx, d.joinRunner)
		default:
		}
	}

	// Check sink runner
	if d.sinkRunner != nil {
		select {
		case <-d.sinkRunner.Done():
			d.log.WarnContext(ctx, "sink runner failed, restarting")
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
		d.log.ErrorContext(ctx, "failed to restart runner", "error", err)
	} else {
		d.log.InfoContext(ctx, "runner restarted successfully")
	}
}
