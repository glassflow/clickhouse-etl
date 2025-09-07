package component

import (
	"context"
	"fmt"
	"log/slog"
	"sync"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/schema"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/sink"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/stream"
)

type Sink interface {
	// Start starts the sink component.
	Start(ctx context.Context) error
	Stop(noWait bool)
}

type SinkComponent struct {
	sink   Sink
	wg     sync.WaitGroup
	doneCh chan struct{}
	log    *slog.Logger
}

func NewSinkComponent(
	sinkConfig models.SinkComponentConfig,
	streamCon stream.Consumer,
	schemaMapper schema.Mapper,
	doneCh chan struct{},
	log *slog.Logger,
) (Component, error) {
	if sinkConfig.Type != internal.ClickHouseSinkType {
		return nil, fmt.Errorf("unsupported sink type: %s", sinkConfig.Type)
	}

	sink, err := sink.NewClickHouseSink(sinkConfig, streamCon, schemaMapper, log)
	if err != nil {
		return nil, fmt.Errorf("failed to create sink: %w", err)
	}

	return &SinkComponent{
		sink:   sink,
		log:    log,
		wg:     sync.WaitGroup{},
		doneCh: doneCh,
	}, nil
}

func (s *SinkComponent) Start(ctx context.Context, errChan chan<- error) {
	s.wg.Add(1)
	defer s.wg.Done()
	defer close(s.doneCh)

	err := s.sink.Start(ctx)
	if err != nil {
		s.log.Error("failed to start sink", "error", err)
		errChan <- err
		return
	}

	s.log.Info("Sink component finished successfully")
}

func (s *SinkComponent) Stop(opts ...StopOption) {
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

// Done returns a channel that signals when the component stops by itself
func (s *SinkComponent) Done() <-chan struct{} {
	return s.doneCh
}

func (s *SinkComponent) Pause() error {
	s.log.Debug("currently not needed")
	return nil
}

func (s *SinkComponent) Resume() error {
	s.log.Debug("currently not needed")
	return nil
}
