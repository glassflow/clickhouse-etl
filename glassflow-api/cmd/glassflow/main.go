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

	RunLocal bool `default:"false" split_words:"true"`

	PipelineConfig string `default:"pipeline.json" split_words:"true"`

	IngestorTopic string `default:"" split_words:"true"`

	JoinType string `default:"temporal" split_words:"true"`

	NATSServer       string        `default:"localhost:4222" split_words:"true"`
	NATSMaxStreamAge time.Duration `default:"24h" split_words:"true"`
	NATSPipelineKV   string        `default:"glassflow-pipelines" split_words:"true"`
}

type RunnerFunc func() error

type ShutdownFunc func()

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

	role := models.Role(*roleStr)
	if !role.Valid() {
		return fmt.Errorf("invalid role specified: %s, valid roles are: %v", role, models.AllRoles())
	}

	err := envconfig.Process("glassflow", &cfg)
	if err != nil {
		return fmt.Errorf("unable to parse config: %w", err)
	}

	return mainErr(&cfg, role)
}

func mainErr(cfg *config, role models.Role) error {
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

	defer cleanUp(nc, log)

	switch role {
	case models.RoleSink:
		return mainSink(nc, cfg, shutdown, log)
	case models.RoleJoin:
		return mainJoin(nc, cfg, shutdown, log)
	case models.RoleIngestor:
		return mainIngestor(nc, cfg, shutdown, log)
	case models.RoleETL:
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

	mq, err := messagequeue.NewClient(cfg.NATSServer)
	if err != nil {
		return fmt.Errorf("initialize message queue: %w", err)
	}

	var orchestrator service.Orchestrator

	if cfg.RunLocal {
		orchestrator = service.NewLocalOrchestrator(nc, log)
	} else {
		orchestrator = service.NewK8sOrchestrator(log)
	}

	pipelineSvc := service.NewPipelineManager(orchestrator, db)
	dlqSvc := service.NewDLQImpl(mq)

	handler := api.NewRouter(log, pipelineSvc, dlqSvc)

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
			switch o := orchestrator.(type) {
			case *service.LocalOrchestrator:
				err := orchestrator.ShutdownPipeline(context.Background(), o.ActivePipelineID())
				if err != nil && !errors.Is(err, service.ErrPipelineNotFound) {
					log.Error("pipeline shutdown error", slog.Any("error", err))
				}
				wg.Done()
			default:
			}
		}()
	}

	wg.Wait()
	return nil
}

func mainSink(nc *client.NATSClient, cfg *config, shutdown <-chan (os.Signal), log *slog.Logger) error {
	var streamName, streamSubject string

	pipelineCfg, err := getPipelineConfigFromJSON(cfg.PipelineConfig)
	if err != nil {
		return fmt.Errorf("failed to get pipeline config: %w", err)
	}

	schemaMapper, err := schema.NewMapper(pipelineCfg.Mapper)
	if err != nil {
		return fmt.Errorf("create schema mapper: %w", err)
	}

	if pipelineCfg.Join.Enabled {
		streamName = models.GetJoinedStreamName(pipelineCfg.ID)
		streamSubject = models.GFJoinSubject
	} else {
		if len(pipelineCfg.Ingestor.KafkaTopics) == 0 {
			return fmt.Errorf("no Kafka topics configured")
		}
		streamName = pipelineCfg.Ingestor.KafkaTopics[0].Name
		streamSubject = streamName + ".input"
	}

	sinkRunner := service.NewSinkRunner(log, nc)

	return runWithGracefulShutdown(
		func() error {
			return sinkRunner.Start(
				context.Background(),
				streamName,
				streamSubject,
				pipelineCfg.Sink,
				schemaMapper,
			)
		},
		sinkRunner.Shutdown,
		shutdown,
		log,
		models.RoleSink.String(),
	)
}

func mainJoin(nc *client.NATSClient, cfg *config, shutdown <-chan (os.Signal), log *slog.Logger) error {
	pipelineCfg, err := getPipelineConfigFromJSON(cfg.PipelineConfig)
	if err != nil {
		return fmt.Errorf("failed to get pipeline config: %w", err)
	}

	schemaMapper, err := schema.NewMapper(pipelineCfg.Mapper)
	if err != nil {
		return fmt.Errorf("create schema mapper: %w", err)
	}

	joinRunner := service.NewJoinRunner(log, nc)

	return runWithGracefulShutdown(
		func() error {
			return joinRunner.Start(
				context.Background(),
				cfg.JoinType,
				models.GFJoinSubject,
				schemaMapper,
			)
		},
		joinRunner.Shutdown,
		shutdown,
		log,
		models.RoleJoin.String(),
	)
}

func mainIngestor(nc *client.NATSClient, cfg *config, shutdown <-chan (os.Signal), log *slog.Logger) error {
	if cfg.IngestorTopic == "" {
		return fmt.Errorf("ingestor topic must be specified")
	}

	pipelineCfg, err := getPipelineConfigFromJSON(cfg.PipelineConfig)
	if err != nil {
		return fmt.Errorf("failed to get pipeline config: %w", err)
	}

	schemaMapper, err := schema.NewMapper(pipelineCfg.Mapper)
	if err != nil {
		return fmt.Errorf("create schema mapper: %w", err)
	}

	ingestorRunner := service.NewIngestorRunner(log, nc)

	return runWithGracefulShutdown(
		func() error {
			return ingestorRunner.Start(
				context.Background(),
				cfg.IngestorTopic,
				pipelineCfg,
				schemaMapper,
			)
		},
		ingestorRunner.Shutdown,
		shutdown,
		log,
		models.RoleIngestor.String(),
	)
}

func runWithGracefulShutdown(
	runnerFunc RunnerFunc,
	shutdownFunc ShutdownFunc,
	shutdown <-chan os.Signal,
	log *slog.Logger,
	serviceName string,
) error {
	serverErr := make(chan error, 1)
	wg := sync.WaitGroup{}

	wg.Add(1)
	go func() {
		defer wg.Done()
		serverErr <- runnerFunc()
	}()

	select {
	case err := <-serverErr:
		if err != nil {
			return fmt.Errorf("%s runner failed: %w", serviceName, err)
		}
	case <-shutdown:
		log.Info("Received termination signal - shutting down", slog.String("service", serviceName))
		wg.Add(1)
		go func() {
			defer wg.Done()
			shutdownFunc()
		}()
	}

	wg.Wait()
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

func getPipelineConfigFromJSON(cfgPath string) (zero models.PipelineConfig, _ error) {
	var pipelineCfg models.PipelineConfig

	cfgJSON, err := os.ReadFile(cfgPath)
	if err != nil {
		return zero, fmt.Errorf("failed to access sink config file: %w", err)
	}

	err = json.Unmarshal(cfgJSON, &pipelineCfg)
	if err != nil {
		return zero, fmt.Errorf("unable to parse sink config: %w", err)
	}

	return pipelineCfg, nil
}

func cleanUp(nc *client.NATSClient, log *slog.Logger) {
	if nc != nil {
		err := nc.Close()
		if err != nil {
			log.Error("failed to close NATS connection", slog.Any("error", err))
		}
	}
}
