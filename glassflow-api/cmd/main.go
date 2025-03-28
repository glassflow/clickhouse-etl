package main

import (
	"fmt"
	"io"
	"log/slog"
	"os"
	"os/signal"
	"runtime"
	"sync"
	"syscall"
	"time"

	"github.com/kelseyhightower/envconfig"
	"github.com/lmittmann/tint"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/api"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/server"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/service"
)

//nolint:gochecknoglobals,revive // build variables
var (
	commit string = "unspecified"
	app    string = "unspecified"
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

	NATSServer string `default:"localhost:4222" split_words:"true"`
}

func main() {
	var cfg config
	err := envconfig.Process("glassflow", &cfg)
	if err != nil {
		slog.Error("unable to parse config", slog.Any("error", err))
		os.Exit(1)
	}

	var logOut io.Writer
	var logFile io.WriteCloser

	switch cfg.LogFilePath {
	case "":
		logOut = os.Stdout
	default:
		fileflags := os.O_WRONLY | os.O_APPEND | os.O_CREATE
		logFile, err = os.OpenFile(cfg.LogFilePath, fileflags, os.FileMode(0o600))
		if err != nil {
			slog.Error("unable to setup logfile", slog.Any("error", err))
			os.Exit(1)
		}
		defer logFile.Close()

		logOut = io.MultiWriter(os.Stdout, logFile)
	}

	log := configureLogger(cfg, logOut)

	if err := mainErr(&cfg, log); err != nil {
		log.Error("Service stopped with error", slog.Any("error", err))
		logFile.Close()

		//nolint: gocritic // deferred call explicitly handled above
		os.Exit(1)
	}

	log.Info("Service terminated gracefully")
}

func mainErr(cfg *config, log *slog.Logger) error {
	bridgeMgr := service.NewBridgeManager(cfg.NATSServer, log)

	handler := api.NewRouter(log, bridgeMgr)

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
			bridgeMgr.Shutdown(cfg.ServerShutdownTimeout)
			wg.Done()
		}()

		wg.Wait()

		return nil
	}
}

func configureLogger(cfg config, logOut io.Writer) *slog.Logger {
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

	log := slog.New(logHandler)

	return log.With(
		slog.String("app", app),
		slog.String("commit_hash", commit),
		slog.String("goversion", runtime.Version()),
	)
}
