package main

import (
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"runtime"
	"syscall"
	"time"

	"github.com/kelseyhightower/envconfig"
	"github.com/lmittmann/tint"

	"github.com/glassflow/clickhouse-etl-internal/internal/server"
)

//nolint:gochecknoglobals,revive // build variables
var (
	commit string = "unspecified"
	app    string = "unspecified"
)

type config struct {
	LogFormat    string     `default:"json" split_words:"true"`
	LogLevel     slog.Level `default:"info" split_words:"true"`
	LogAddSource bool       `default:"true" split_words:"true"`

	ServerAddr            string        `default:":8080" split_words:"true"`
	ServerWriteTimeout    time.Duration `default:"15s" split_words:"true"`
	ServerReadTimeout     time.Duration `default:"15s" split_words:"true"`
	ServerIdleTimeout     time.Duration `default:"5m" split_words:"true"`
	ServerShutdownTimeout time.Duration `default:"30s" split_words:"true"`
}

func main() {
	var cfg config
	err := envconfig.Process("glassflow", &cfg)
	if err != nil {
		slog.Error("unable to parse config", slog.Any("error", err))
		os.Exit(1)
	}

	//nolint: exhaustruct // optional config
	logOpts := &slog.HandlerOptions{
		Level:     cfg.LogLevel,
		AddSource: cfg.LogAddSource,
	}

	var logHandler slog.Handler
	switch cfg.LogFormat {
	case "json":
		logHandler = slog.NewJSONHandler(os.Stdout, logOpts)
	default:
		//nolint:exhaustruct // optional config
		logHandler = tint.NewHandler(os.Stdout, &tint.Options{
			AddSource:  true,
			TimeFormat: time.Kitchen,
		})
	}

	log := slog.New(logHandler)

	log = log.With(
		slog.String("app", app),
		slog.String("commit_hash", commit),
		slog.String("goversion", runtime.Version()),
	)

	if err := mainErr(&cfg, log); err != nil {
		log.Error("Service stopped with error", slog.Any("error", err))
		os.Exit(1)
	}

	log.Info("Service terminated gracefully")
}

func mainErr(cfg *config, log *slog.Logger) error {
	apiServer := server.NewHTTPServer(
		cfg.ServerAddr,
		cfg.ServerReadTimeout,
		cfg.ServerWriteTimeout,
		cfg.ServerIdleTimeout,
		log,
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
		if err := apiServer.Shutdown(cfg.ServerShutdownTimeout); err != nil {
			return fmt.Errorf("failed to shutdown server: %w", err)
		}
		return nil
	}
}
