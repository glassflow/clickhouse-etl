package component

import (
	"context"
	"fmt"
	"log/slog"
	"sync"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/ingestor"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/schema"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/stream"
)

type Ingestor interface {
	Start(ctx context.Context) error
	Stop()
	Pause() error
	Resume() error
}

type IngestorComponent struct {
	ingestor  Ingestor
	topicName string
	wg        sync.WaitGroup
	doneCh    chan struct{}
	log       *slog.Logger
}

func NewIngestorComponent(
	config models.IngestorComponentConfig,
	topicName string,
	streamPublisher stream.Publisher,
	dlqStreamPublisher stream.Publisher,
	schemaMapper schema.Mapper,
	doneCh chan struct{},
	log *slog.Logger,
) (*IngestorComponent, error) {
	if config.Type != internal.KafkaIngestorType {
		return nil, fmt.Errorf("unknown ingestor type")
	}

	ingestor, err := ingestor.NewKafkaIngestor(config, topicName, streamPublisher, dlqStreamPublisher, schemaMapper, log)
	if err != nil {
		return nil, fmt.Errorf("error creating kafka source ingestor: %w", err)
	}
	return &IngestorComponent{
		ingestor:  ingestor,
		log:       log,
		topicName: topicName,
		wg:        sync.WaitGroup{},
		doneCh:    doneCh,
	}, nil
}

func (i *IngestorComponent) Start(ctx context.Context, errChan chan<- error) {
	i.wg.Add(1)
	defer i.wg.Done()
	defer close(i.doneCh)

	i.log.Info("Ingestor component is starting...")

	err := i.ingestor.Start(ctx)
	if err != nil {
		i.log.Error("failed to process ingestor", "error", err)
		errChan <- err
		return
	}

	i.log.Info("Ingestor component finished successfully", slog.String("topic", i.topicName))
}

func (i *IngestorComponent) Stop(_ ...StopOption) {
	i.log.Info("Stopping ingestor component...")
	i.ingestor.Stop()
	i.wg.Wait()
	i.log.Info("Ingestor component stopped")
}

func (i *IngestorComponent) Done() <-chan struct{} {
	return i.doneCh
}

func (i *IngestorComponent) Pause() error {
	if i.ingestor == nil {
		return fmt.Errorf("ingestor not initialized")
	}

	i.log.Info("pausing ingestor component", slog.String("topic", i.topicName))
	return i.ingestor.Pause()
}

func (i *IngestorComponent) Resume() error {
	if i.ingestor == nil {
		return fmt.Errorf("ingestor not initialized")
	}

	i.log.Info("resuming ingestor component", slog.String("topic", i.topicName))
	return i.ingestor.Resume()
}
