package operator

import (
	"context"
	"fmt"
	"log/slog"
	"sync"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/client"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/schema"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/sink"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/stream"
)

type Sink interface {
	// Start starts the sink operator.
	Start(ctx context.Context) error
	Stop(noWait bool)
}

type SinkOperator struct {
	sink Sink
	wg   sync.WaitGroup
	log  *slog.Logger
}

func NewSinkOperator(
	client *client.ClickHouseClient,
	sinkConfig sink.ClickHouseSinkConfig,
	streamCon *stream.Consumer,
	schemaMapper *schema.Mapper,
	log *slog.Logger,
) (*SinkOperator, error) {
	sink, err := sink.NewClickHouseSink(sinkConfig, client, streamCon, schemaMapper, log)
	if err != nil {
		return nil, fmt.Errorf("failed to create sink: %w", err)
	}

	return &SinkOperator{
		sink: sink,
		log:  log,
		wg:   sync.WaitGroup{},
	}, nil
}

func (s *SinkOperator) Start(ctx context.Context, errChan chan<- error) {
	s.wg.Add(1)
	defer s.wg.Done()
	err := s.sink.Start(ctx)
	if err != nil {
		s.log.Error("failed to start sink", "error", err)
		errChan <- err
	}
}

func (s *SinkOperator) Stop(opts ...StopOtion) {
	noWait := false
	options := &StopOptions{
		NoWait: false,
	}

	for _, opt := range opts {
		opt(options)
	}

	if options.NoWait {
		noWait = true
	}

	s.sink.Stop(noWait)
	s.wg.Wait()
}
