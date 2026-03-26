package main

import (
	"context"
	"log/slog"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/client"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	oltp_receiver "github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/otlp-receiver/server"
	otlp_processor "github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/otlp-receiver/server/processor"
)

func mainOLTPReceiver(
	ctx context.Context,
	nc *client.NATSClient,
	_ *config,
	log *slog.Logger,
) error {
	configFetcher := configFetcherStub{}
	otlpDataProcessor := otlp_processor.NewProcessor(configFetcher, nc)
	r, err := oltp_receiver.New(log, otlpDataProcessor)
	if err != nil {
		return err
	}
	defer r.Shutdown(context.Background())
	return r.Start(ctx)
}

type configFetcherStub struct {
}

func (c configFetcherStub) GetOTLPConfig(
	_ context.Context,
	_ string,
) (models.OTLPConfig, error) {
	return models.OTLPConfig{
		Routing: models.RoutingConfig{
			OutputSubject: "otlp-test",
			Type:          models.RoutingTypeName,
		},
	}, nil
}
