package component

import (
	"context"
	"fmt"
	"log/slog"
	"sync"

	"github.com/nats-io/nats.go/jetstream"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/join"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/kv"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/schema"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/stream"
)

type JoinComponent struct {
	leftStreamSubsriber   stream.Subscriber
	rightStreamSubscriber stream.Subscriber
	executor              join.Executor
	handleMu              sync.Mutex
	wg                    sync.WaitGroup
	once                  sync.Once
	ctx                   context.Context //nolint:containedctx // we need a context to use our Stop function
	cancelFunc            context.CancelFunc
	stopNoWait            bool
	doneCh                chan struct{}
	log                   *slog.Logger
}

func NewJoinComponent(
	cfg models.JoinComponentConfig,
	leftStreamConsumer, rightStreamConsumer stream.Consumer,
	resultsPublisher stream.Publisher,
	schema schema.Mapper,
	leftKVStore, rightKVStore kv.KeyValueStore,
	leftStreamName, rightStreamName string,
	doneCh chan struct{},
	log *slog.Logger,
) (Component, error) {
	if cfg.Type != internal.TemporalJoinType {
		return nil, fmt.Errorf("unsupported join type")
	}

	// not actaually a best approach to use background context here
	// but we need a context to use our Stop function
	ctx, cancel := context.WithCancel(context.Background())

	executor := join.NewTemporalJoinExecutor(
		resultsPublisher,
		schema,
		leftKVStore, rightKVStore,
		leftStreamName, rightStreamName,
		log,
	)
	return &JoinComponent{
		leftStreamSubsriber:   stream.NewNATSSubscriber(leftStreamConsumer, log),
		rightStreamSubscriber: stream.NewNATSSubscriber(rightStreamConsumer, log),
		executor:              executor,
		handleMu:              sync.Mutex{},
		wg:                    sync.WaitGroup{},
		ctx:                   ctx,
		cancelFunc:            cancel,
		doneCh:                doneCh,
		log:                   log,
	}, nil
}

func (j *JoinComponent) Start(ctx context.Context, errChan chan<- error) {
	j.wg.Add(1)
	defer j.wg.Done()

	defer close(j.doneCh)

	j.log.Info("Join component is starting...")

	err := j.leftStreamSubsriber.Subscribe(func(msg jetstream.Msg) {
		j.handleMu.Lock()
		defer j.handleMu.Unlock()

		err := j.executor.HandleLeftStreamEvents(ctx, msg)
		if err != nil {
			j.log.Error("failed to handle left stream event", slog.Any("error", err))
			return
		}
		err = msg.Ack()
		if err != nil {
			j.log.Error("failed to ack left stream message", slog.Any("error", err))
		}
	})
	if err != nil {
		errChan <- fmt.Errorf("failed to start left stream consumer: %w", err)
		return
	}

	err = j.rightStreamSubscriber.Subscribe(func(msg jetstream.Msg) {
		j.handleMu.Lock()
		defer j.handleMu.Unlock()

		err := j.executor.HandleRightStreamEvents(ctx, msg)
		if err != nil {
			j.log.Error("failed to handle right stream event", slog.Any("error", err))
			return
		}
		err = msg.Ack()
		if err != nil {
			j.log.Error("failed to ack right stream message", slog.Any("error", err))
		}
	})
	if err != nil {
		errChan <- fmt.Errorf("failed to start right stream consumer: %w", err)
		return
	}

	j.log.Info("Join component was started successfully!")

	select {
	case <-j.ctx.Done():
		// Context cancelled, normal shutdown
		j.log.Warn("Stopping Join component...")
		if j.stopNoWait {
			j.leftStreamSubsriber.Stop()
			j.rightStreamSubscriber.Stop()
		} else {
			j.leftStreamSubsriber.DrainAndStop()
			j.rightStreamSubscriber.DrainAndStop()
		}
		<-j.leftStreamSubsriber.Closed()
		<-j.rightStreamSubscriber.Closed()
		return

	case <-j.leftStreamSubsriber.Closed():
		err := fmt.Errorf("left stream subscriber closed unexpectedly")
		j.log.Error("Join unexpectedly stopping")
		j.rightStreamSubscriber.Stop()
		<-j.rightStreamSubscriber.Closed()
		errChan <- err
		return

	case <-j.rightStreamSubscriber.Closed():
		err := fmt.Errorf("right stream subscriber closed unexpectedly")
		j.log.Error("Join unexpectedly stopping")
		j.leftStreamSubsriber.Stop()
		<-j.leftStreamSubsriber.Closed()
		errChan <- err
		return
	}
}

func (j *JoinComponent) Stop(opts ...StopOption) {
	j.once.Do(func() {
		options := &StopOptions{
			NoWait: false,
		}

		for _, opt := range opts {
			opt(options)
		}

		j.log.Info("Stopping Join component ...")
		if options.NoWait {
			j.stopNoWait = true
		}

		j.cancelFunc()

		j.wg.Wait()

		j.log.Info("Join component stopped")
	})
}

// Done returns a channel that signals when the component stops by itself
func (j *JoinComponent) Done() <-chan struct{} {
	return j.doneCh
}

func (j *JoinComponent) Pause() error {
	j.log.Info("join component pause not needed - data flow stops when ingestor is paused")
	// Join component doesn't need explicit pause since data flow stops when ingestor is paused
	return nil
}

func (j *JoinComponent) Resume() error {
	j.log.Info("join component resume not needed - data flow resumes when ingestor resumes")
	// Join component doesn't need explicit resume since data flow resumes when ingestor resumes
	return nil
}
