package operator

import (
	"context"
	"fmt"
	"log/slog"
	"sync"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/client"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/ingestor"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/schema"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/stream"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

type Ingestor interface {
	Start(ctx context.Context) error
	Stop()
}

type IngestorOperator struct {
	ingestor  Ingestor
	topicName string
	wg        sync.WaitGroup
	log       *slog.Logger
}

func NewIngestorOperator(
	config models.IngestorOperatorConfig,
	topicName string,
	streamName string,
	natsStreamSubject string,
	dlqStreamSubject string,
	nc *client.NATSClient,
	schemaMapper schema.Mapper,
	log *slog.Logger,
) (*IngestorOperator, error) {
	if config.Type != models.KafkaIngestorType {
		return nil, fmt.Errorf("unknown ingestor type")
	}

	if natsStreamSubject == "" {
		return nil, fmt.Errorf("NATS stream subject cannot be empty")
	}

	if nc == nil {
		return nil, fmt.Errorf("NATS client cannot be nil")
	}

	streamPublisher := stream.NewNATSPublisher(
		nc.JetStream(),
		stream.PublisherConfig{
			Subject: natsStreamSubject,
		},
	)

	dlqStreamPublisher := stream.NewNATSPublisher(
		nc.JetStream(),
		stream.PublisherConfig{
			Subject: dlqStreamSubject,
		},
	)

	op, err := ingestor.NewKafkaIngestor(config, topicName, streamName, streamPublisher, dlqStreamPublisher, schemaMapper, log)
	if err != nil {
		return nil, fmt.Errorf("error creating kafka source ingestor: %w", err)
	}
	return &IngestorOperator{
		ingestor: op,
		log:      log,
		wg:       sync.WaitGroup{},
	}, nil
}

func (i *IngestorOperator) Start(ctx context.Context, errChan chan<- error) {
	i.wg.Add(1)
	defer i.wg.Done()

	i.log.Info("Ingestor operator is starting...")

	err := i.ingestor.Start(ctx)
	if err != nil {
		i.log.Error("failed to start ingestor", "error", err)
		errChan <- err
		return
	}

	i.log.Info("Ingestor operator started successfully", slog.String("topic", i.topicName))
}

func (i *IngestorOperator) Stop(_ ...StopOption) {
	i.log.Info("Stopping ingestor operator")
	i.ingestor.Stop()
	i.wg.Wait()
	i.log.Info("Ingestor operator stopped")
}
