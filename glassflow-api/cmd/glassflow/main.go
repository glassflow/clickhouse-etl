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

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/api"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/client"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/dlq"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/orchestrator"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/schema"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/server"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/service"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/storage"
)

type config struct {
	LogFormat    string     `default:"json" split_words:"true"`
	LogLevel     slog.Level `default:"debug" split_words:"true"`
	LogAddSource bool       `default:"false" split_words:"true"`
	LogFilePath  string     `split_words:"true"`

	ServerAddr            string        `default:":8081" split_words:"true"`
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

	K8sNamespace       string `default:"glassflow" split_words:"true"`
	K8sResourceKind    string `default:"Pipeline" split_words:"true"`
	K8sResourceName    string `default:"pipelines" split_words:"true"`
	K8sAPIGroup        string `default:"etl.glassflow.io" envconfig:"k8s_api_group"`
	K8sAPIGroupVersion string `default:"v1alpha1" envconfig:"k8s_api_group_version"`
}

type RunnerFunc func() error

type ShutdownFunc func()

type DoneFunc func() <-chan struct{}

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

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go func() {
		<-shutdown
		log.Info("Shutdown signal received, cancelling context")
		cancel()
	}()

	nc, err := client.NewNATSClient(
		ctx,
		cfg.NATSServer,
		client.WithMaxAge(cfg.NATSMaxStreamAge),
	)
	if err != nil {
		return fmt.Errorf("nats client: %w", err)
	}

	defer cleanUp(nc, log)

	switch role {
	case internal.RoleSink:
		return mainSink(ctx, nc, cfg, log)
	case internal.RoleJoin:
		return mainJoin(ctx, nc, cfg, log)
	case internal.RoleIngestor:
		return mainIngestor(ctx, nc, cfg, log)
	case internal.RoleETL:
		return mainEtl(ctx, nc, cfg, log)
	default:
		return fmt.Errorf("unknown role: %s", role)
	}
}

func mainEtl(ctx context.Context, nc *client.NATSClient, cfg *config, log *slog.Logger) error {
	db, err := storage.New(ctx, cfg.NATSPipelineKV, nc.JetStream())
	if err != nil {
		return fmt.Errorf("create nats store for pipelines: %w", err)
	}

	dlq := dlq.NewClient(nc)

	var orch service.Orchestrator

	if cfg.RunLocal {
		orch = orchestrator.NewLocalOrchestrator(nc, log)
	} else {
		orch, err = orchestrator.NewK8sOrchestrator(log, cfg.K8sNamespace, orchestrator.CustomResourceAPIGroupVersion{
			Kind:     cfg.K8sResourceKind,
			Resource: cfg.K8sResourceName,
			APIGroup: cfg.K8sAPIGroup,
			Version:  cfg.K8sAPIGroupVersion,
		})
		if err != nil {
			return fmt.Errorf("create k8s orchestrator: %w", err)
		}
	}

	pipelineSvc := service.NewPipelineManager(orch, db)
	dlqSvc := service.NewDLQImpl(dlq)

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
	case <-ctx.Done():
		log.Info("Received termination signal - service will shutdown")

		wg.Add(2)
		go func() {
			if err := apiServer.Shutdown(ctx, cfg.ServerShutdownTimeout); err != nil {
				log.Error("failed to shutdown server", slog.Any("error", err))
			}
			wg.Done()
		}()

		go func() {
			switch o := orch.(type) {
			case *orchestrator.LocalOrchestrator:
				err := orch.StopPipeline(ctx, o.ActivePipelineID())
				if err != nil && !errors.Is(err, service.ErrPipelineNotFound) {
					log.Error("pipeline stop error", slog.Any("error", err))
				}
				wg.Done()
			default:
				wg.Done()
			}
		}()
	}

	wg.Wait()
	return nil
}

func mainSink(ctx context.Context, nc *client.NATSClient, cfg *config, log *slog.Logger) error {
	pipelineCfg, err := getPipelineConfigFromJSON(cfg.PipelineConfig)
	if err != nil {
		return fmt.Errorf("failed to get pipeline config: %w", err)
	}

	schemaMapper, err := schema.NewMapper(pipelineCfg.Mapper)
	if err != nil {
		return fmt.Errorf("create schema mapper: %w", err)
	}

	if pipelineCfg.Sink.StreamID == "" {
		return fmt.Errorf("stream_id in sink config cannot be empty")
	}

	sinkRunner := service.NewSinkRunner(log, nc, pipelineCfg.Sink.StreamID, pipelineCfg.Sink, schemaMapper)

	return runWithGracefulShutdown(
		ctx,
		sinkRunner,
		log,
		internal.RoleSink,
	)
}

func mainJoin(ctx context.Context, nc *client.NATSClient, cfg *config, log *slog.Logger) error {
	if cfg.JoinType == "" {
		return fmt.Errorf("join type must be specified")
	}

	pipelineCfg, err := getPipelineConfigFromJSON(cfg.PipelineConfig)
	if err != nil {
		return fmt.Errorf("failed to get pipeline config: %w", err)
	}

	if !pipelineCfg.Join.Enabled {
		return fmt.Errorf("join is not enabled in pipeline config")
	}

	if len(pipelineCfg.Join.Sources) != 2 {
		return fmt.Errorf("join must have exactly 2 sources")
	}

	// Determine left and right streams based on orientation
	var leftStream, rightStream string
	if pipelineCfg.Join.Sources[0].Orientation == "left" {
		leftStream = pipelineCfg.Join.Sources[0].StreamID
		rightStream = pipelineCfg.Join.Sources[1].StreamID
	} else {
		leftStream = pipelineCfg.Join.Sources[1].StreamID
		rightStream = pipelineCfg.Join.Sources[0].StreamID
	}

	if leftStream == "" || rightStream == "" {
		return fmt.Errorf("both left and right streams must be specified in join sources")
	}

	// Generate output stream name for joined data
	outputStream := pipelineCfg.Join.OutputStreamID

	schemaMapper, err := schema.NewMapper(pipelineCfg.Mapper)
	if err != nil {
		return fmt.Errorf("create schema mapper: %w", err)
	}

	joinRunner := service.NewJoinRunner(log, nc, leftStream, rightStream, outputStream, pipelineCfg.Join, schemaMapper)

	return runWithGracefulShutdown(
		ctx,
		joinRunner,
		log,
		internal.RoleJoin,
	)
}

func mainIngestor(ctx context.Context, nc *client.NATSClient, cfg *config, log *slog.Logger) error {
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

	ingestorRunner := service.NewIngestorRunner(log, nc, cfg.IngestorTopic, pipelineCfg, schemaMapper)

	return runWithGracefulShutdown(
		ctx,
		ingestorRunner,
		log,
		internal.RoleIngestor,
	)
}

func runWithGracefulShutdown(
	ctx context.Context,
	runner service.Runner,
	log *slog.Logger,
	serviceName string,
) error {
	serverErr := make(chan error, 1)
	wg := sync.WaitGroup{}

	wg.Add(1)
	go func() {
		defer wg.Done()
		serverErr <- runner.Start(ctx)
	}()

	log.Info("Running service", slog.String("service", serviceName))

	for {
		select {
		case err := <-serverErr:
			if err != nil {
				return fmt.Errorf("%s runner failed: %w", serviceName, err)
			}
		case <-runner.Done():
			log.Warn("Component has crashed!", slog.String("service", serviceName))
			wg.Wait()
			return fmt.Errorf("%s component stopped by itself", serviceName)
		case <-ctx.Done():
			log.Info("Received termination signal - shutting down", slog.String("service", serviceName))
			wg.Add(1)
			go func() {
				defer wg.Done()
				runner.Shutdown()
			}()
			wg.Wait()
			return nil
		}
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
