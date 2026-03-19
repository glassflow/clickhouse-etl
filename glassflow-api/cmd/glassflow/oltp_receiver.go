package main

import (
	"context"
	"log/slog"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/client"
	oltp_receiver "github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/otlp-receiver/server"
)

func mainOLTPReceiver(
	ctx context.Context,
	_ *client.NATSClient,
	_ *config,
	log *slog.Logger,
) error {
	r, err := oltp_receiver.New(log)
	if err != nil {
		return err
	}
	defer r.Shutdown(context.Background())
	return r.Start(ctx)
}
