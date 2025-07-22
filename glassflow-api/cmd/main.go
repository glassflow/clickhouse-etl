package main

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log"
	"log/slog"
	"os"
	"os/signal"
	"path"
	"sync"
	"syscall"
	"time"

	"github.com/kelseyhightower/envconfig"
	"github.com/lmittmann/tint"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/api"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/client"
	messagequeue "github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/message_queue/nats"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/server"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/service"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/storage"
)

type config struct {
	LogFormat    string     `default:"json" split_words:"true"`
	LogLevel     slog.Level `default:"debug" split_words:"true"`
	LogAddSource bool       `default:"false" split_words:"true"`
	LogFilePath  string     `split_words:"true"`

	ServerAddr            string        `default:":8080" split_words:"true"`
	ServerWriteTimeout    time.Duration `default:"15s" split_words:"true"`
	ServerReadTimeout     time.Duration `default:"15s" split_words:"true"`
	ServerIdleTimeout     time.Duration `default:"5m" split_words:"true"`
	ServerShutdownTimeout time.Duration `default:"30s" split_words:"true"`

	NATSServer       string        `default:"localhost:4222" split_words:"true"`
	NATSMaxStreamAge time.Duration `default:"24h" split_words:"true"`
	NATSPipelineKV   string        `default:"glassflow-pipelines" split_words:"true"`
}

func main() {
	slog.Info("Starting main")

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

	mq, err := messagequeue.NewClient(cfg.NATSServer)
	if err != nil {
		return fmt.Errorf("initialize message queue: %w", err)
	}

	ctx := context.Background()

	db, err := storage.New(ctx, cfg.NATSPipelineKV, nc.JetStream())
	if err != nil {
		return fmt.Errorf("create nats store for pipelines: %w", err)
	}

	pipelineMgr := service.NewPipelineManager(nc, log, db)
	dlqSvc := service.NewDLQService(mq)

	handler := api.NewRouter(log, pipelineMgr, dlqSvc)

	apiServer := server.NewHTTPServer(
		cfg.ServerAddr,
		cfg.ServerReadTimeout,
		cfg.ServerWriteTimeout,
		cfg.ServerIdleTimeout,
		log,
		handler,
	)

	serverErr := make(chan error, 1)
	go func() {
		serverErr <- apiServer.Start()
	}()

	shutdown := make(chan os.Signal, 1)
	signal.Notify(shutdown, os.Interrupt, syscall.SIGINT, syscall.SIGTERM)

	select {
	case err := <-serverErr:
		if err != nil {
			return fmt.Errorf("failed to start server: %w", err)
		}
		return nil
	case <-shutdown:
		log.Info("Received termination signal - service will shutdown")

		wg := sync.WaitGroup{}

		wg.Add(2)
		go func() {
			if err := apiServer.Shutdown(cfg.ServerShutdownTimeout); err != nil {
				log.Error("failed to shutdown server", slog.Any("error", err))
			}
			wg.Done()
		}()

		go func() {
			err := pipelineMgr.ShutdownPipeline()
			if err != nil && !errors.Is(err, service.ErrPipelineNotFound) {
				log.Error("pipeline shutdown error", slog.Any("error", err))
			}

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
