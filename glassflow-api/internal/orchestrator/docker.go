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
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/storage"
)

type LocalOrchestrator struct {
	nc  *client.NATSClient
	db  *storage.Storage
	log *slog.Logger

	ingestorRunners []service.Runner
	joinRunner      service.Runner
	sinkRunner      service.Runner

	id string
	m  sync.Mutex

	watcherCancel context.CancelFunc
	watcherWG     sync.WaitGroup
}

func NewLocalOrchestrator(
	nc *client.NATSClient,
	db *storage.Storage,
	log *slog.Logger,
) service.Orchestrator {
	//nolint: exhaustruct // runners will be created on setup
	return &LocalOrchestrator{
		nc:  nc,
		db:  db,
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
		sinkConsumerStream = pi.Sink.StreamID

		d.log.Debug("create ingestor for the topic", slog.String("topic", t.Name))
		ingestorRunner := service.NewIngestorRunner(d.log.With("component", "ingestor", "topic", t.Name), d.nc, t.Name, *pi,
			schemaMapper)

		err = ingestorRunner.Start(ctx)
		if err != nil {
			return fmt.Errorf("start ingestor for topic %s: %w", t.Name, err)
		}

		d.ingestorRunners = append(d.ingestorRunners, ingestorRunner)
	}

	if pi.Join.Enabled {
		sinkConsumerStream = pi.Sink.StreamID
		sinkConsumerSubject = models.GetNATSSubjectName(sinkConsumerStream)

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

// ShutdownPipeline implements Orchestrator.
func (d *LocalOrchestrator) ShutdownPipeline(_ context.Context, pid string) error {
	d.m.Lock()
	defer d.m.Unlock()

	if d.id != pid {
		return fmt.Errorf("mismatched pipeline id: %w", service.ErrPipelineNotFound)
	}

	// Clear pipeline ID first to stop any pending restart attempts
	d.id = ""

	if d.watcherCancel != nil {
		d.watcherCancel()
		d.watcherWG.Wait()
	}

	if d.ingestorRunners != nil {
		for _, runner := range d.ingestorRunners {
			runner.Shutdown()
		}
	}
	if d.joinRunner != nil {
		d.joinRunner.Shutdown()
	}
	if d.sinkRunner != nil {
		d.sinkRunner.Shutdown()
	}

	return nil
}

// ShutdownPipeline implements Orchestrator.
func (d *LocalOrchestrator) TerminatePipeline(ctx context.Context, pid string) error {
	return d.ShutdownPipeline(ctx, pid)
}

// PausePipeline implements Orchestrator.
func (d *LocalOrchestrator) PausePipeline(ctx context.Context, pid string) error {
	d.m.Lock()
	defer d.m.Unlock()

	if d.id != pid {
		return service.ErrPipelineNotFound
	}

	d.log.Info("pausing local pipeline", slog.String("pipeline_id", pid))

	// For local orchestrator, we need to gracefully stop the ingestor
	// but keep the sink running to finish processing the queue
	for _, runner := range d.ingestorRunners {
		if runner != nil {
			// Stop ingestor gracefully - it will finish current batch but not consume new messages
			runner.Shutdown()
		}
	}

	// Note: Sink will continue running and will stop automatically when queue is empty
	// For local orchestrator, we need to start a background process to monitor sink queue
	// and update the pipeline status when the queue is empty
	d.startSinkQueueMonitoring(ctx, pid)

	d.log.Info("requested pause of local pipeline", slog.String("pipeline_id", pid))
	return nil
}

// ResumePipeline implements Orchestrator.
func (d *LocalOrchestrator) ResumePipeline(ctx context.Context, pid string) error {
	d.m.Lock()
	defer d.m.Unlock()

	if d.id != pid {
		return service.ErrPipelineNotFound
	}

	d.log.Info("resuming local pipeline", slog.String("pipeline_id", pid))

	// For local orchestrator, we need to restart the ingestor
	// The sink should already be running and will continue processing
	for i, runner := range d.ingestorRunners {
		if runner != nil {
			// Restart the ingestor
			err := runner.Start(ctx)
			if err != nil {
				return fmt.Errorf("failed to restart ingestor %d: %w", i, err)
			}
		}
	}

	// Note: For local orchestrator, the service layer will update the status to "running"
	// after this method returns successfully

	d.log.Info("requested resume of local pipeline", slog.String("pipeline_id", pid))
	return nil
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

// startSinkQueueMonitoring starts a background goroutine to monitor sink queue status
// and update pipeline status when the queue is empty
func (d *LocalOrchestrator) startSinkQueueMonitoring(ctx context.Context, pid string) {
	d.watcherWG.Add(1)
	go func() {
		defer d.watcherWG.Done()

		ticker := time.NewTicker(5 * time.Second)
		defer ticker.Stop()

		d.log.Info("started sink queue monitoring", slog.String("pipeline_id", pid))

		for {
			select {
			case <-ctx.Done():
				d.log.Info("sink queue monitoring stopped due to context cancellation", slog.String("pipeline_id", pid))
				return
			case <-ticker.C:
				// Check if sink queue is empty
				sinkQueueEmpty, err := d.checkSinkQueueStatus(ctx, pid)
				if err != nil {
					d.log.Error("failed to check sink queue status", slog.String("pipeline_id", pid), slog.Any("error", err))
					continue
				}

				if sinkQueueEmpty {
					// Update pipeline status to "Paused" in NATS
					status := models.PipelineHealth{
						OverallStatus: models.PipelineStatus(internal.PipelineStatusPaused),
						UpdatedAt:     time.Now().UTC(),
					}
					err = d.db.UpdatePipelineStatus(ctx, pid, status)
					if err != nil {
						d.log.Error("failed to update pipeline status to Paused", slog.String("pipeline_id", pid), slog.Any("error", err))
					} else {
						d.log.Info("pipeline status updated to Paused", slog.String("pipeline_id", pid))
					}
					return // Stop monitoring once paused
				}
			}
		}
	}()
}

// checkSinkQueueStatus checks if the sink queue is empty for the local orchestrator
func (d *LocalOrchestrator) checkSinkQueueStatus(ctx context.Context, pid string) (bool, error) {
	// For local orchestrator, we need to check the NATS streams that the sink consumes from
	// This is similar to the operator implementation but adapted for local use

	// Get pipeline configuration to determine which streams the sink consumes from
	pipelineConfig, err := d.db.GetPipeline(ctx, pid)
	if err != nil {
		return false, fmt.Errorf("failed to get pipeline config: %w", err)
	}

	// Determine sink input streams based on pipeline configuration
	var streamsToCheck []string

	// Add join output stream if join is enabled
	if pipelineConfig.Join.Enabled && pipelineConfig.Join.OutputStreamID != "" {
		streamsToCheck = append(streamsToCheck, pipelineConfig.Join.OutputStreamID)
	}

	// Add ingestor output streams
	for _, topic := range pipelineConfig.Ingestor.KafkaTopics {
		if topic.OutputStreamID != "" {
			streamsToCheck = append(streamsToCheck, topic.OutputStreamID)
		}
	}

	// If no streams to check, assume queue is empty
	if len(streamsToCheck) == 0 {
		return true, nil
	}

	// Check each stream for messages using NATS client
	for _, streamName := range streamsToCheck {
		messageCount, err := d.nc.CheckStreamMessageCount(ctx, streamName)
		if err != nil {
			return false, fmt.Errorf("failed to check message count for stream %s: %w", streamName, err)
		}

		// If any stream has messages, sink queue is not empty
		if messageCount > 0 {
			return false, nil
		}
	}

	// All streams are empty
	return true, nil
}
