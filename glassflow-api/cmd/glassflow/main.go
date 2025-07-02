package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
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
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/schema"
	messagequeue "github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/message_queue/nats"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/server"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/service"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/storage"
)

type Role string

const (
	RoleSink     Role = "sink"
	RoleJoin     Role = "join"
	RoleIngestor Role = "ingestor"
	RoleETL      Role = ""
)

func (r Role) Valid() bool {
	switch r {
	case RoleSink, RoleJoin, RoleIngestor, RoleETL:
		return true
	default:
		return false
	}
}

func (r Role) String() string {
	if r == RoleETL {
		return "ETL Pipeline"
	}
	return string(r)
}

func AllRoles() []string {
	return []string{
		string(RoleSink),
		string(RoleJoin),
		string(RoleIngestor),
		string(RoleETL),
	}
}

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

	PipelineConfig string `default:"pipeline.json" split_words:"true"`

	NATSServer       string        `default:"localhost:4222" split_words:"true"`
	NATSMaxStreamAge time.Duration `default:"24h" split_words:"true"`
	NATSPipelineKV   string        `default:"glassflow-pipelines" split_words:"true"`
}

func main() {
	if err := run(); err != nil {
		slog.Error("Service failed", slog.Any("error", err))
		os.Exit(1)
	}
}

func run() error {
	var cfg config

	roleStr := flag.String("role", "", "Role to run: sink, join, ingester or empty for pipeline manager")
	flag.Parse()

	role := Role(*roleStr)
	if !role.Valid() {
		return fmt.Errorf("invalid role specified: %s, valid roles are: %v", role, AllRoles())
	}

	err := envconfig.Process("glassflow", &cfg)
	if err != nil {
		return fmt.Errorf("unable to parse config: %w", err)
	}

	return mainErr(&cfg, role)
}

func mainErr(cfg *config, role Role) error {
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
			return fmt.Errorf("unable to setup logfile %w", err)
		}
		defer logFile.Close()

		logOut = io.MultiWriter(os.Stdout, logFile)
	}

	log := configureLogger(cfg, logOut)

	shutdown := make(chan os.Signal, 1)
	signal.Notify(shutdown, os.Interrupt, syscall.SIGINT, syscall.SIGTERM)

	nc, err := client.NewNATSWrapper(cfg.NATSServer, cfg.NATSMaxStreamAge)
	if err != nil {
		return fmt.Errorf("nats client: %w", err)
	}

	switch role {
	case RoleSink:
		return mainSink(nc, cfg, shutdown, log)
	case RoleJoin:
		return mainJoin(nc, cfg, shutdown, log)
	case RoleIngestor:
		return mainIngestor(nc, cfg, shutdown, log)
	case RoleETL:
		return mainEtl(nc, cfg, shutdown, log)
	default:
		return fmt.Errorf("unknown role: %s", role)
	}
}

func mainEtl(nc *client.NATSClient, cfg *config, shutdown <-chan (os.Signal), log *slog.Logger) error {
	ctx := context.Background()

	db, err := storage.New(ctx, cfg.NATSPipelineKV, nc.JetStream())
	if err != nil {
		return fmt.Errorf("create nats store for pipelines: %w", err)
	}

	pipelineMgr := service.NewPipelineManager(cfg.NATSServer, nc, log, db)

	mq, err := messagequeue.NewClient(cfg.NATSServer)
	if err != nil {
		return fmt.Errorf("initialize message queue: %w", err)
	}

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

	wg := sync.WaitGroup{}

	wg.Add(1)
	go func() {
		defer wg.Done()
		serverErr <- apiServer.Start()
	}()

	select {
	case err := <-serverErr:
		if err != nil {
			return fmt.Errorf("failed to start server: %w", err)
		}
		return nil
	case <-shutdown:
		log.Info("Received termination signal - service will shutdown")

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
	}

	wg.Wait()
	return nil
}

func mainSink(nc *client.NATSClient, cfg *config, shutdown <-chan (os.Signal), log *slog.Logger) error {
	// todo: implement sink functionality
	var streamName, streamSubject string
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

	wg := sync.WaitGroup{}

	wg.Add(1)

	go func() {
		defer wg.Done()
		serverErr <- sinkRunner.Start(
			context.Background(),
			streamName,
			streamSubject,
			pipelineCfg.Sink,
			schemaMapper,
		)
	}()

	select {
	case err := <-serverErr:
		if err != nil {
			return fmt.Errorf("sink runner failed: %w", err)
		}
	case <-shutdown:
		log.Info("Received termination signal - sink operator will shutdown")
		wg.Add(1)

		go func() {
			sinkRunner.Shutdown()
			wg.Done()
		}()
	}

	wg.Wait()
	return nil
}

func mainJoin(nc *client.NATSClient, cfg *config, shutdown <-chan (os.Signal), log *slog.Logger) error {
	// todo: implement join functionality
	log.Info("Sink functionality is not implemented yet")
	return nil
}

func mainIngestor(nc *client.NATSClient, cfg *config, shutdown <-chan (os.Signal), log *slog.Logger) error {
	// todo: implement ingestor functionality
	log.Info("Sink functionality is not implemented yet")
	return nil
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
