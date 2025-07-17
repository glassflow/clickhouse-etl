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

type IngestorOperator struct {
	ingestor ingestor.Ingestor
	wg       sync.WaitGroup
	log      *slog.Logger
}

func NewIngestorOperator(
	config models.IngestorOperatorConfig,
	topicName string,
	natsStreamSubject string,
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

	ingestor, err := ingestor.NewKafkaIngestor(config, topicName, streamPublisher, schemaMapper, log)
	if err != nil {
		return nil, fmt.Errorf("error creating kafka source ingestor: %w", err)
	}
	return &IngestorOperator{
		ingestor: ingestor,
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

	i.log.Info("Ingestor operator started successfully")
}

func (i *IngestorOperator) Stop(opts ...StopOption) {
	noWait := false
	options := &StopOptions{
		NoWait: false,
	}

	for _, opt := range opts {
		opt(options)
	}

	i.log.Info("Stopping ingestor operator", "noWait", options.NoWait)

	if options.NoWait {
		noWait = true
	}

	i.ingestor.Stop(noWait)

	i.wg.Wait()

	i.log.Info("Ingestor operator stopped")
}
