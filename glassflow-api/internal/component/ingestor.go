package component

import (
	"context"
	"fmt"
	"log/slog"
	"sync"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/ingestor"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/schema"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/stream"
)

type Ingestor interface {
	Start(ctx context.Context) error
	Stop()
}

type IngestorComponent struct {
	ingestor  Ingestor
	topicName string
	wg        sync.WaitGroup
	log       *slog.Logger
}

func NewIngestorComponent(
	config models.IngestorComponentConfig,
	topicName string,
	streamPublisher stream.Publisher,
	dlqStreamPublisher stream.Publisher,
	schemaMapper schema.Mapper,
	log *slog.Logger,
) (*IngestorComponent, error) {
	if config.Type != models.KafkaIngestorType {
		return nil, fmt.Errorf("unknown ingestor type")
	}

	ing, err := ingestor.NewKafkaIngestor(config, topicName, streamPublisher, dlqStreamPublisher, schemaMapper, log)
	if err != nil {
		return nil, fmt.Errorf("error creating kafka source ingestor: %w", err)
	}
	return &IngestorComponent{
		ingestor: ing,
		log:      log,
		wg:       sync.WaitGroup{},
	}, nil
}

func (i *IngestorComponent) Start(ctx context.Context, errChan chan<- error) {
	i.wg.Add(1)
	defer i.wg.Done()

	i.log.Info("Ingestor component is starting...")

	err := i.ingestor.Start(ctx)
	if err != nil {
		i.log.Error("failed to start ingestor", "error", err)
		errChan <- err
		return
	}

	i.log.Info("Ingestor component started successfully", slog.String("topic", i.topicName))
}

func (i *IngestorComponent) Stop(_ ...StopOption) {
	i.log.Info("Stopping ingestor component...")
	i.ingestor.Stop()
	i.wg.Wait()
	i.log.Info("Ingestor component stopped")
}
