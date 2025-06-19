package operator

import (
	"context"
	"fmt"
	"log/slog"
	"sync"

	"github.com/nats-io/nats.go/jetstream"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/join"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/kv"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/schema"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/stream"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

type JoinOperator struct {
	leftStreamSubsriber   stream.Subscriber
	rightStreamSubscriber stream.Subscriber
	executor              join.Executor
	mu                    sync.Mutex
	handleMu              sync.Mutex
	isClosed              bool
	wg                    sync.WaitGroup
	log                   *slog.Logger
}

func NewJoinOperator(
	cfg models.JoinOperatorConfig,
	leftStreamConsumer, rightStreamConsumer stream.Consumer,
	resultsPublisher stream.Publisher,
	schema schema.Mapper,
	leftKVStore, rightKVStore kv.KeyValueStore,
	leftStreamName, rightStreamName string,
	log *slog.Logger,
) (Operator, error) {
	if cfg.Type != models.TemporalJoinType {
		return nil, fmt.Errorf("unsupported join type")
	}

	executor := join.NewTemporalJoinExecutor(
		resultsPublisher,
		schema,
		leftKVStore, rightKVStore,
		leftStreamName, rightStreamName,
		log,
	)
	return &JoinOperator{
		leftStreamSubsriber:   stream.NewNATSSubscriber(leftStreamConsumer, log),
		rightStreamSubscriber: stream.NewNATSSubscriber(rightStreamConsumer, log),
		executor:              executor,
		mu:                    sync.Mutex{},
		handleMu:              sync.Mutex{},
		isClosed:              false,
		wg:                    sync.WaitGroup{},
		log:                   log,
	}, nil
}

func (j *JoinOperator) Start(ctx context.Context, errChan chan<- error) {
	j.wg.Add(1)
	defer j.wg.Done()

	j.log.Info("Join operator is starting...")

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

	j.log.Info("Join operator was started successfully!")
}

func (j *JoinOperator) Stop(opts ...StopOption) {
	j.mu.Lock()
	defer j.mu.Unlock()

	if j.isClosed {
		j.log.Debug("Join operator is already stopped.")
		return
	}

	options := &StopOptions{
		NoWait: false,
	}

	for _, opt := range opts {
		opt(options)
	}

	j.log.Info("Stopping Join operator ...")
	if options.NoWait {
		j.leftStreamSubsriber.Stop()
		j.rightStreamSubscriber.Stop()
	} else {
		j.leftStreamSubsriber.DrainAndStop()
		j.rightStreamSubscriber.DrainAndStop()
	}

	<-j.leftStreamSubsriber.Closed()
	<-j.rightStreamSubscriber.Closed()

	j.isClosed = true
	j.log.Debug("Join operator stopped")
}
