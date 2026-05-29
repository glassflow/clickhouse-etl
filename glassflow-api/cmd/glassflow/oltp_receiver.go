package main

import (
	"context"
	"log/slog"

	"github.com/glassflow/clickhouse-etl/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl/glassflow-api/internal/client"
	"github.com/glassflow/clickhouse-etl/glassflow-api/internal/componentsignals"
	oltp_receiver "github.com/glassflow/clickhouse-etl/glassflow-api/internal/otlp-receiver/server"
	configFetcher "github.com/glassflow/clickhouse-etl/glassflow-api/internal/otlp-receiver/server/config/fetcher"
	otlp_processor "github.com/glassflow/clickhouse-etl/glassflow-api/internal/otlp-receiver/server/processor"
)

func mainOLTPReceiver(
	ctx context.Context,
	nc *client.NATSClient,
	cfg *config,
	log *slog.Logger,
) error {
	fetcher := configFetcher.New(cfg.OTLPConfigFetcherBaseURL)

	signalPublisher, err := componentsignals.NewPublisher(nc)
	if err != nil {
		return err
	}

	otlpDataProcessor := otlp_processor.NewProcessor(fetcher, nc, cfg.OTLPMaxConcurrentRequests, cfg.OTLPNatsChunkSize, signalPublisher)
	r, err := oltp_receiver.New(log, nc, otlpDataProcessor)
	if err != nil {
		return err
	}

	usageStatsClient := newUsageStatsClient(cfg, log, nil)

	return runWithGracefulShutdown(
		ctx,
		r,
		log,
		internal.RoleOLTPReceiver,
		usageStatsClient,
	)
}
