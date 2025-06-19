package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"os"
	"os/signal"
	"path"
	"sync"
	"syscall"
	"time"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/client"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/operator"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/schema"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/service"
	"github.com/kelseyhightower/envconfig"
	"github.com/lmittmann/tint"
)

var sink operator.Sink

type config struct {
	LogFormat    string     `default:"json" split_words:"true"`
	LogLevel     slog.Level `default:"debug" split_words:"true"`
	LogAddSource bool       `default:"false" split_words:"true"`
	LogFilePath  string     `split_words:"true"`

	PipelineConfig string `default:"pipeline.json" split_words:"true"`

	NATSServer       string        `default:"localhost:4222" split_words:"true"`
	NATSMaxStreamAge time.Duration `default:"24h" split_words:"true"`

	StreamName    string `default:"" split_words:"true"`
	StreamSubject string `default:"" split_words:"true"`
}

func main() {
	var cfg config
	err := envconfig.Process("glassflow", &cfg)
	if err != nil {
		slog.Error("unable to parse config", slog.Any("error", err))
		os.Exit(1)
	}

	if err := mainErr(&cfg); err != nil {
		slog.Error("Service stopped with error", slog.Any("error", err))
		os.Exit(1)
	}

	slog.Info("Service terminated gracefully")
}

func mainErr(cfg *config) error {
	var logOut io.Writer
	var logFile io.WriteCloser
	var err error

	if cfg.StreamName == "" || cfg.StreamSubject == "" {
		return fmt.Errorf("stream name and subject must be provided")
	}

	switch cfg.LogFilePath {
	case "":
		logOut = os.Stdout
	default:
		fileflags := os.O_WRONLY | os.O_APPEND | os.O_CREATE
		logFile, err = os.OpenFile(
			path.Join(cfg.LogFilePath, time.Now().Format(time.RFC3339)+".log"),
			fileflags,
			os.FileMode(0o644),
		)
		if err != nil {
			slog.Error("unable to setup logfile", slog.Any("error", err))
			os.Exit(1)
		}
		defer logFile.Close()

		logOut = io.MultiWriter(os.Stdout, logFile)
	}

	log := configureLogger(cfg, logOut)

	nc, err := client.NewNATSWrapper(cfg.NATSServer, cfg.NATSMaxStreamAge)
	if err != nil {
		return fmt.Errorf("nats client: %w", err)
	}

	var pipelineCfg models.PipelineConfig

	cfgPath, err := os.ReadFile(cfg.PipelineConfig)
	if err != nil {
		return fmt.Errorf("failed to access sink config file %w", err)
	}

	err = json.Unmarshal(cfgPath, &pipelineCfg)
	if err != nil {
		return fmt.Errorf("unable to parse sink config %w", err)
	}

	schemaMapper, err := schema.NewMapper(pipelineCfg.Mapper)
	if err != nil {
		return fmt.Errorf("create schema mapper: %w", err)
	}

	sinkRunner := service.NewSinkRunner(log, nc)

	serverErr := make(chan error, 1)
	go func() {
		serverErr <- sinkRunner.Start(
			context.Background(),
			cfg.StreamName,
			cfg.StreamSubject,
			pipelineCfg.Sink,
			schemaMapper,
		)
	}()

	shutdown := make(chan os.Signal, 1)
	signal.Notify(shutdown, os.Interrupt, syscall.SIGINT, syscall.SIGTERM)

	select {
	case err := <-serverErr:
		if err != nil {
			return fmt.Errorf("failed to start sink operator: %w", err)
		}
		return nil
	case <-shutdown:
		log.Info("Received termination signal - sink operator will shutdown")

		wg := sync.WaitGroup{}
		wg.Add(1)

		go func() {
			sinkRunner.Shutdown()
			wg.Done()
		}()

		wg.Wait()

		return nil
	}
}

func configureLogger(cfg *config, logOut io.Writer) *slog.Logger {
	//nolint: exhaustruct // optional config
	logOpts := &slog.HandlerOptions{
		Level:     cfg.LogLevel,
		AddSource: cfg.LogAddSource,
	}

	var logHandler slog.Handler
	switch cfg.LogFormat {
	case "json":
		logHandler = slog.NewJSONHandler(logOut, logOpts)
	default:
		//nolint:exhaustruct // optional config
		logHandler = tint.NewHandler(logOut, &tint.Options{
			AddSource:  true,
			TimeFormat: time.Kitchen,
		})
	}

	return slog.New(logHandler)
}
