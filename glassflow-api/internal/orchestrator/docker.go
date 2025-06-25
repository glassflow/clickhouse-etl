package orchestrator

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/client"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/kv"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/operator"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/schema"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/stream"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

type LocalOrchestrator struct {
	log *slog.Logger
	nc  *client.NATSClient
}

func New(lg *slog.Logger, nc *client.NATSClient) *LocalOrchestrator {
	return &LocalOrchestrator{
		log: lg,
		nc:  nc,
	}
}

func (o *LocalOrchestrator) SetupPipeline(ctx context.Context, pi models.Pipeline) error {
	var (
		joinOp operator.JoinOperator
		sinkOp operator.SinkOperator
	)

	for _, c := range pi.Components {
		switch co := c.(type) {
		case *models.JoinComponent:
			var (
				leftConsumer    stream.Consumer
				rightConsumer   stream.Consumer
				leftBuffer      kv.KeyValueStore
				rightBuffer     kv.KeyValueStore
				leftStreamName  string
				rightStreamName string
				err             error
			)
			for _, s := range co.Sources {
				err := o.nc.CreateOrUpdateStream(ctx, s.Source, "input", s.Window)
				if err != nil {
					return fmt.Errorf("create join stream %s", s.Source)
				}

				if s.JoinOrder == models.JoinLeft {
					leftStreamName = s.Source

					//nolint: exhaustruct // optional config
					leftConsumer, err = stream.NewNATSConsumer(ctx, o.nc.JetStream(), stream.ConsumerConfig{
						NatsStream:   leftStreamName,
						NatsConsumer: "leftStreamConsumer",
						NatsSubject:  "input",
					})
					if err != nil {
						return fmt.Errorf("create join left consumer: %w", err)
					}

					leftBuffer, err = kv.NewNATSKeyValueStore(
						ctx,
						o.nc.JetStream(),
						kv.KeyValueStoreConfig{
							StoreName: leftStreamName,
							TTL:       s.Window,
						})
					if err != nil {
						return fmt.Errorf("create left buffer: %w", err)
					}
				} else if s.JoinOrder == models.JoinRight {
					rightStreamName = s.Source

					//nolint: exhaustruct // optional config
					rightConsumer, err = stream.NewNATSConsumer(ctx, o.nc.JetStream(), stream.ConsumerConfig{
						NatsStream:   rightStreamName,
						NatsConsumer: "rightStreamConsumer",
						NatsSubject:  "input",
					})
					if err != nil {
						return fmt.Errorf("create right consumer: %w", err)
					}

					rightBuffer, err = kv.NewNATSKeyValueStore(
						ctx,
						o.nc.JetStream(),
						kv.KeyValueStoreConfig{
							StoreName: rightStreamName,
							TTL:       s.Window,
						})
					if err != nil {
						return fmt.Errorf("create right buffer: %w", err)
					}
				}
			}

			resultStreamName := co.GetOutputs()[0].ID()

			err = o.nc.CreateOrUpdateStream(ctx, resultStreamName, "input", 0)
			if err != nil {
				return fmt.Errorf("create join result stream: %w", err)
			}

			resultsPublisher := stream.NewNATSPublisher(o.nc.JetStream(), stream.PublisherConfig{
				Subject: "input",
			})

			mapperCfg := models.MapperConfig{
				Type:        "",
				Streams:     map[string]models.StreamSchemaConfig{},
				SinkMapping: []models.SinkMappingConfig{},
			}

			mapper, err := schema.NewMapper(mapperCfg)
			if err != nil {
				return fmt.Errorf("join schema mapper: %w", err)
			}

			_ = operator.NewJoinOperator(*co, leftConsumer, rightConsumer, resultsPublisher, mapper, leftBuffer, rightBuffer, leftStreamName, rightStreamName, o.log)
		}
	}
	return nil
}
