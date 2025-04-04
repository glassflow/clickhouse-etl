package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"sync"
	"syscall"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/schema"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/sink"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/stream"
)

type Config struct {
	StreamConsumerConfig stream.ConsumerConfig `json:"stream_consumer"`
	ClickhouseSinkConfig sink.ConnectorConfig  `json:"clickhouse_sink"`
	BatchConfig          sink.BatchConfig      `json:"batch"`
	SchemaConfig         schema.Config         `json:"schema"`
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

	ctx := context.Background()

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

	schemaMapper, err := schema.NewMapper(cfg.SchemaConfig.Streams, cfg.SchemaConfig.SinkMapping)
	if err != nil {
		log.Error("failed to create schema mapper: ", slog.Any("error", err))
		return
	}

	// Create ClickHouse sink
	clickhouseSink, err := sink.NewClickHouseSink(cfg.ClickhouseSinkConfig, cfg.BatchConfig, eventsConsumer, schemaMapper, log)
	if err != nil {
		log.Error("failed to create ClickHouse sink: ", slog.Any("error", err))
		return
	}

	wg := sync.WaitGroup{}

	signalChan := make(chan os.Signal, 1)
	signal.Notify(signalChan, os.Interrupt, syscall.SIGTERM)

	wg.Add(1)
	go func() {
		// Wait for interrupt signal
		defer wg.Done()
		<-signalChan
		log.Info("Received interrupt signal, shutting down gracefully...")
		clickhouseSink.Stop()
	}()

	errCh := make(chan error, 1)
	wg.Add(1)
	go func() {
		// Run the ClickHouse sink
		defer wg.Done()
		clickhouseSink.Start(ctx, errCh)
	}()

	// Wait for all goroutines to finish
	wg.Wait()

	// Close all connections
	errs := func() []error {
		errors := make([]error, 0)

		select {
		case err, ok := <-errCh:
			if ok {
				errors = append(errors, fmt.Errorf("error from sink: %w", err))
			}
		default:
		}

		if err := nc.Close(); err != nil {
			errors = append(errors, fmt.Errorf("failed to close NATS wrapper: %w", err))
		}

		log.Info("All connections closed")

		return errors
	}()
	if len(errs) != 0 {
		for _, err := range errs {
			log.Error("error: ", slog.Any("error", err))
		}
	}

	log.Info("ClickHouse ETL finished")
}
