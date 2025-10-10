package orchestrator

import (
	"context"
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

	// Store pipeline config in memory for cleanup
	pipelineConfig *models.PipelineConfig
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
			sinkConsumerStream = pi.Sink.StreamID

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

	d.sinkRunner = service.NewSinkRunner(d.log.With("component", "clickhouse_sink"), d.nc,
		sinkConsumerStream,
		models.SinkComponentConfig{
			Type:     internal.ClickHouseSinkType,
			StreamID: sinkConsumerStream,
			Batch: models.BatchConfig{
				MaxBatchSize: pi.Sink.Batch.MaxBatchSize,
				MaxDelayTime: pi.Sink.Batch.MaxDelayTime,
			},
			NATSConsumerName:           pi.Sink.NATSConsumerName,
			ClickHouseConnectionParams: pi.Sink.ClickHouseConnectionParams,
		},
		schemaMapper,
		nil, // nil meter for docker orchestrator
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

	// Stop the pipeline gracefully (wait for pending messages, then cleanup resources)
	err := d.pausePipelineComponents(ctx, pid)
	if err != nil {
		d.log.ErrorContext(ctx, "failed to pause pipeline during stop", "error", err)
		return fmt.Errorf("pause pipeline during stop: %w", err)
	}

	d.log.InfoContext(ctx, "pipeline stop completed successfully", "pipeline_id", pid)
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

// pausePipelineComponents gracefully stops pipeline components by waiting for pending messages to clear
func (d *LocalOrchestrator) pausePipelineComponents(ctx context.Context, pid string) error {
	// Get pipeline config to check for pending messages
	pipeline, err := d.getPipelineConfig(ctx)
	if err != nil {
		d.log.ErrorContext(ctx, "failed to get pipeline config for graceful stop", "error", err)
		return fmt.Errorf("get pipeline config: %w", err)
	}

	// Wait for all consumers to clear pending messages (graceful shutdown)
	d.log.InfoContext(ctx, "waiting for pending messages to clear before stopping pipeline", "pipeline_id", pid)

	// Wait for sink consumer to clear pending messages
	if pipeline.Sink.StreamID != "" {
		sinkConsumerName := models.GetNATSSinkConsumerName(pipeline.ID)
		err := d.waitForPendingMessagesToClear(ctx, pipeline, func(ctx context.Context, p *models.PipelineConfig) error {
			return d.checkConsumerPendingMessages(ctx, p.Sink.StreamID, sinkConsumerName)
		}, "sink")
		if err != nil {
			d.log.WarnContext(ctx, "timeout waiting for sink pending messages, proceeding with stop", "error", err)
		}
	}

	// Wait for join consumers to clear pending messages
	if pipeline.Join.Enabled && pipeline.Join.OutputStreamID != "" {
		// Check left consumer
		leftConsumerName := models.GetNATSJoinLeftConsumerName(pipeline.ID)
		err := d.waitForPendingMessagesToClear(ctx, pipeline, func(ctx context.Context, p *models.PipelineConfig) error {
			return d.checkConsumerPendingMessages(ctx, p.Join.OutputStreamID, leftConsumerName)
		}, "join-left")
		if err != nil {
			d.log.WarnContext(ctx, "timeout waiting for join left pending messages, proceeding with stop", "error", err)
		}

		// Check right consumer
		rightConsumerName := models.GetNATSJoinRightConsumerName(pipeline.ID)
		err = d.waitForPendingMessagesToClear(ctx, pipeline, func(ctx context.Context, p *models.PipelineConfig) error {
			return d.checkConsumerPendingMessages(ctx, p.Join.OutputStreamID, rightConsumerName)
		}, "join-right")
		if err != nil {
			d.log.WarnContext(ctx, "timeout waiting for join right pending messages, proceeding with stop", "error", err)
		}
	}

	// Wait for ingestor consumers to clear pending messages
	for _, topic := range pipeline.Ingestor.KafkaTopics {
		if topic.OutputStreamID != "" {
			streamName := models.GetIngestorStreamName(pipeline.ID, topic.Name)
			ingestorConsumerName := fmt.Sprintf("%s-ingestor-%s", pipeline.ID, topic.Name)
			err := d.waitForPendingMessagesToClear(ctx, pipeline, func(ctx context.Context, p *models.PipelineConfig) error {
				return d.checkConsumerPendingMessages(ctx, streamName, ingestorConsumerName)
			}, fmt.Sprintf("ingestor-%s", topic.Name))
			if err != nil {
				d.log.WarnContext(ctx, "timeout waiting for ingestor pending messages, proceeding with stop", "ingestor", topic.Name, "error", err)
			}
		}
	}

	d.log.InfoContext(ctx, "all pending messages cleared, proceeding with component cleanup", "pipeline_id", pid)

	// Now clean up the components (same as terminate but after graceful waiting)
	return d.terminatePipelineComponents(ctx, pid)
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
func (d *LocalOrchestrator) ResumePipeline(ctx context.Context, pid string) error {
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
