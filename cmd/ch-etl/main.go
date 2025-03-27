package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/glassflow/clickhouse-etl-internal/internal/core/schema"
	"github.com/glassflow/clickhouse-etl-internal/internal/core/sink"
	"github.com/glassflow/clickhouse-etl-internal/internal/core/stream"
)

type Config struct {
	StreamConsumerConfig stream.ConsumerConfig    `json:"stream_consumer"`
	ClickhouseSinkConfig sink.SinkConnectorConfig `json:"clickhouse_sink"`
	BatchConfig          sink.BatchConfig         `json:"batch"`
	SchemaConfig         schema.SchemaConfig      `json:"schema"`
}

type ConfigLoader[C any] struct {
	filePath string
}

func NewConfigLoader[C any](filePath string) (zero *ConfigLoader[C], _ error) {
	if len(filePath) == 0 {
		return zero, fmt.Errorf("config file path is empty")
	}
	return &ConfigLoader[C]{
		filePath: filePath,
	}, nil
}

func (cl *ConfigLoader[C]) Load() (zero C, _ error) {
	var config C
	jsFile, err := os.ReadFile(cl.filePath)
	if err != nil {
		return zero, fmt.Errorf("failed to read config file: %w", err)
	}

	if err := json.Unmarshal(jsFile, &config); err != nil {
		return zero, fmt.Errorf("failed to unmarshal config file: %w", err)
	}
	return config, nil
}

func main() {
	configPath := flag.String("config", "", "Path to config file")
	debug := flag.Bool("d", false, "Enable debug logging")
	flag.Parse()

	logHandlerOpts := slog.HandlerOptions{} //nolint:exhaustruct // optional config
	if *debug {
		logHandlerOpts.Level = slog.LevelDebug
	}

	log := slog.New(slog.NewTextHandler(os.Stdout, &logHandlerOpts))

	ctx, cancel := context.WithCancel(context.Background())

	signalChan := make(chan os.Signal, 1)
	signal.Notify(signalChan, os.Interrupt, syscall.SIGTERM)

	go func() {
		<-signalChan
		log.Info("Received interrupt signal, shutting down gracefully...")
		cancel()
	}()

	loader, err := NewConfigLoader[Config](*configPath)
	if err != nil {
		log.Error("failed to create config loader: ", slog.Any("error", err))
		return
	}

	cfg, err := loader.Load()
	if err != nil {
		log.Error("failed to load config: ", slog.Any("error", err))
		return
	}

	streamCfg := cfg.StreamConsumerConfig
	nc, err := stream.NewNATSWrapper(streamCfg.NatsURL)
	if err != nil {
		log.Error("failed to create NATS wrapper: ", slog.Any("error", err))
		return
	}

	eventsConsumer, err := stream.NewConsumer(ctx, nc.JetStream(), streamCfg)
	if err != nil {
		log.Error("failed to create NATS events consumer: ", slog.Any("error", err))
		return
	}

	schemaMapper, err := schema.NewSchemaMapper(cfg.SchemaConfig)
	if err != nil {
		log.Error("failed to create schema mapper: ", slog.Any("error", err))
		return
	}

	err = sink.ClickHouseSinkImporter(ctx, cfg.ClickhouseSinkConfig, cfg.BatchConfig, eventsConsumer, schemaMapper, log)
	if err != nil {
		log.Error("failed to import data to ClickHouse: ", slog.Any("error", err))
		return
	}

	// Close all connections
	err = func() error {
		if err := nc.Close(); err != nil {
			return fmt.Errorf("failed to close NATS wrapper: %w", err)
		}

		log.Info("All connections closed")

		return nil
	}()
	if err != nil {
		log.Error("failed wrap up: ", slog.Any("error", err))
		return
	}

	log.Info("ClickHouse ETL finished")
}
