package main

import (
	"context"
	"log/slog"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/client"
	oltp_receiver "github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/otlp-receiver/server"
	otlp_processor "github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/otlp-receiver/server/processor"
)

func mainOLTPReceiver(
	ctx context.Context,
	nc *client.NATSClient,
	_ *config,
	log *slog.Logger,
) error {
	otlpDataProcessor := otlp_processor.NewProcessor(nil, nc)
	r, err := oltp_receiver.New(log, otlpDataProcessor)
	if err != nil {
		return err
	}
	defer r.Shutdown(context.Background())
	return r.Start(ctx)
}
