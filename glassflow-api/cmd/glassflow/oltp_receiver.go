package main

import (
	"context"
	"log/slog"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/client"
	oltp_receiver "github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/otlp-receiver/server"
	configFetcher "github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/otlp-receiver/server/config/fetcher"
	otlp_processor "github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/otlp-receiver/server/processor"
)

func mainOLTPReceiver(
	ctx context.Context,
	nc *client.NATSClient,
	cfg *config,
	log *slog.Logger,
) error {
	fetcher := configFetcher.New(cfg.OTLPConfigFetcherBaseURL)
	otlpDataProcessor := otlp_processor.NewProcessor(fetcher, nc)
	r, err := oltp_receiver.New(log, otlpDataProcessor)
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
