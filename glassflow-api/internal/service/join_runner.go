package service

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

type JoinRunner struct {
	log *slog.Logger
	nc  *client.NATSClient

	operator operator.Operator
	c        chan error
}

func NewJoinRunner(log *slog.Logger, nc *client.NATSClient) *JoinRunner {
	return &JoinRunner{
		nc:  nc,
		log: log,

		operator: nil,
		c:        make(chan error, 1),
	}
}

func (j *JoinRunner) Start(ctx context.Context, joinType string, publisherSubject string, schemaMapper schema.Mapper) error {
	var mapper schema.JsonToClickHouseMapper

	switch sm := schemaMapper.(type) {
	case *schema.JsonToClickHouseMapper:
		mapper = *sm
	default:
		return fmt.Errorf("unsupported schema mapper")
	}

	if len(mapper.Streams) == 0 {
		return fmt.Errorf("setup joiner: length of streams must not be 0")
	}

	var (
		leftConsumer    stream.Consumer
		rightConsumer   stream.Consumer
		leftBuffer      kv.KeyValueStore
		rightBuffer     kv.KeyValueStore
		leftStreamName  string
		rightStreamName string
		err             error
	)
	for n, s := range mapper.Streams {
		if s.JoinOrientation == "left" {
			leftStreamName = n

			//nolint: exhaustruct // optional config
			leftConsumer, err = stream.NewNATSConsumer(ctx, j.nc.JetStream(), stream.ConsumerConfig{
				NatsStream:   n,
				NatsConsumer: "leftStreamConsumer",
				NatsSubject:  n + ".input",
			})
			if err != nil {
				return fmt.Errorf("create left consumer: %w", err)
			}

			leftBuffer, err = kv.NewNATSKeyValueStore(
				ctx,
				j.nc.JetStream(),
				kv.KeyValueStoreConfig{
					StoreName: n,
					TTL:       s.JoinWindow,
				})
			if err != nil {
				j.log.Error("failed to create left stream buffer: ", slog.Any("error", err))
				return fmt.Errorf("create left buffer: %w", err)
			}
		} else {
			rightStreamName = n

			//nolint: exhaustruct // optional config
			rightConsumer, err = stream.NewNATSConsumer(ctx, j.nc.JetStream(), stream.ConsumerConfig{
				NatsStream:   n,
				NatsConsumer: "rightStreamConsumer",
				NatsSubject:  n + ".input",
			})
			if err != nil {
				return fmt.Errorf("create right consumer: %w", err)
			}

			rightBuffer, err = kv.NewNATSKeyValueStore(
				ctx,
				j.nc.JetStream(),
				kv.KeyValueStoreConfig{
					StoreName: n,
					TTL:       s.JoinWindow,
				})
			if err != nil {
				j.log.Error("failed to create right stream buffer: ", slog.Any("error", err))
				return fmt.Errorf("create right buffer: %w", err)
			}
		}
	}

	resultsPublisher := stream.NewNATSPublisher(j.nc.JetStream(), stream.PublisherConfig{
		Subject: publisherSubject,
	})

	joinOp, err := operator.NewJoinOperator(
		models.JoinOperatorConfig{
			Type: joinType,
		},
		leftConsumer,
		rightConsumer,
		resultsPublisher,
		schemaMapper,
		leftBuffer,
		rightBuffer,
		leftStreamName,
		rightStreamName,
		j.log,
	)
	if err != nil {
		j.log.Error("failed to join: ", slog.Any("error", err))
		return fmt.Errorf("create join: %w", err)
	}

	go func() {
		joinOp.Start(ctx, j.c)

		j.operator = joinOp

		for err := range j.c {
			j.log.Error("Error in join operator", slog.Any("error", err))
		}
	}()

	return nil
}

func (j *JoinRunner) Shutdown() {
	if j.operator != nil {
		j.operator.Stop()
	}
}
