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
	chDone                <-chan struct{}
	once                  sync.Once
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
	log *slog.Logger,
) (*JoinComponent, error) {
	if cfg.Type != internal.TemporalJoinType {
		return nil, fmt.Errorf("unsupported join type")
	}

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
		log:                   log,
	}, nil
}

func (j *JoinComponent) Start(ctx context.Context) error {
	j.log.Info("Join component is starting...")

	// in ideal world we should have some kind of separate process to handle shutdown
	shutdownCtx, cancel := context.WithCancel(context.Background())
	j.cancelFunc = cancel
	j.chDone = shutdownCtx.Done()
	defer cancel()

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
		return fmt.Errorf("failed to start left stream consumer: %w", err)
	}

	err = j.rightStreamSubscriber.Subscribe(func(msg jetstream.Msg) {
		j.handleMu.Lock()
		defer j.handleMu.Unlock()

		err = j.executor.HandleRightStreamEvents(ctx, msg)
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
		return fmt.Errorf("failed to start right stream consumer: %w", err)
	}

	j.log.Info("Join component was started successfully!")

	select {
	case <-j.chDone:
		// Context cancelled, normal shutdown
		if j.stopNoWait {
			j.leftStreamSubsriber.Stop()
			j.rightStreamSubscriber.Stop()
		} else {
			j.leftStreamSubsriber.DrainAndStop()
			j.rightStreamSubscriber.DrainAndStop()
		}
		<-j.leftStreamSubsriber.Closed()
		<-j.rightStreamSubscriber.Closed()
		return nil

	case <-j.leftStreamSubsriber.Closed():
		err = fmt.Errorf("left stream subscriber closed unexpectedly")
		j.log.Error("Join unexpectedly stopping")
		j.rightStreamSubscriber.Stop()
		<-j.rightStreamSubscriber.Closed()
		return err
	case <-j.rightStreamSubscriber.Closed():
		err = fmt.Errorf("right stream subscriber closed unexpectedly")
		j.log.Error("Join unexpectedly stopping")
		j.leftStreamSubsriber.Stop()
		<-j.leftStreamSubsriber.Closed()
		return err
	}
}

func (j *JoinComponent) Stop(opts ...StopOption) {
	j.once.Do(func() {
		options := &StopOptions{}

		for _, opt := range opts {
			opt(options)
		}

		j.log.Info("Stopping Join component ...")
		if options.NoWait {
			j.stopNoWait = true
		}

		j.cancelFunc()

		j.log.Info("Join component stopped")
	})
}

// Done returns a channel that signals when the component stops by itself
func (j *JoinComponent) Done() <-chan struct{} {
	return j.doneCh
}
