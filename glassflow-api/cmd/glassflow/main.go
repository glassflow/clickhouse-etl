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
	"strconv"
	"sync"
	"syscall"
	"time"

	"github.com/kelseyhightower/envconfig"
	_ "go.uber.org/automaxprocs"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/api"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/client"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/dlq"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/orchestrator"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/server"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/service"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/storage"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/storage/postgres/datamigrations"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/pkg/observability"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/pkg/usagestats"
)

type config struct {
	LogFormat    string     `default:"json" split_words:"true"`
	LogLevel     slog.Level `default:"info" split_words:"true"`
	LogAddSource bool       `default:"false" split_words:"true"`
	LogFilePath  string     `split_words:"true"`

	// OpenTelemetry observability configuration
	OtelLogsEnabled       bool   `default:"true" split_words:"true"`
	OtelMetricsEnabled    bool   `default:"true" split_words:"true"`
	OtelServiceName       string `default:"glassflow" split_words:"true"`
	OtelServiceVersion    string `default:"dev" split_words:"true"`
	OtelServiceNamespace  string `default:"" split_words:"true"`
	OtelPipelineID        string `default:"" split_words:"true"`
	OtelServiceInstanceID string `default:"" split_words:"true"`

	ServerAddr            string        `default:":8081" split_words:"true"`
	ServerWriteTimeout    time.Duration `default:"15s" split_words:"true"`
	ServerReadTimeout     time.Duration `default:"15s" split_words:"true"`
	ServerIdleTimeout     time.Duration `default:"5m" split_words:"true"`
	ServerShutdownTimeout time.Duration `default:"30s" split_words:"true"`

	RunLocal bool `default:"false" split_words:"true"`

	PipelineConfig string `default:"pipeline.json" split_words:"true"`

	IngestorTopic string `default:"" split_words:"true"`

	DedupTopic string `default:"" split_words:"true"`

	JoinType string `default:"temporal" split_words:"true"`

	NATSServer         string        `default:"localhost:4222" split_words:"true"`
	NATSMaxStreamAge   time.Duration `default:"168h" split_words:"true"`
	NATSMaxStreamBytes int64         `default:"107374182400" split_words:"true"` // 100GB in bytes
	NATSPipelineKV     string        `default:"glassflow-pipelines" split_words:"true"`

	// Database configuration
	DatabaseURL string `default:"" split_words:"true"`

	// Encryption configuration
	EncryptionKeyPath string `default:"/etc/glassflow/secrets/encryption-key" split_words:"true"`
	EncryptionKey     string `default:"" split_words:"true"`

	K8sNamespace       string `default:"glassflow" split_words:"true"`
	K8sResourceKind    string `default:"Pipeline" split_words:"true"`
	K8sResourceName    string `default:"pipelines" split_words:"true"`
	K8sAPIGroup        string `default:"etl.glassflow.io" envconfig:"k8s_api_group"`
	K8sAPIGroupVersion string `default:"v1alpha1" envconfig:"k8s_api_group_version"`

	UsageStatsEnabled        bool   `default:"true" split_words:"true"`
	UsageStatsEndpoint       string `default:"" split_words:"true"`
	UsageStatsUsername       string `default:"" split_words:"true"`
	UsageStatsPassword       string `default:"" split_words:"true"`
	UsageStatsInstallationID string `default:"" split_words:"true"`

	OTLPConfigFetcherBaseURL string `default:"" split_words:"true"`
}

var version = "dev"

func main() {
	if err := run(); err != nil {
		slog.Error("Service failed", slog.Any("error", err))
		os.Exit(1)
	}
}

func run() error {
	// automaxprocs is used to set the number of CPU cores to use for the application.

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

	// Configure observability
	obsConfig := &observability.Config{
		LogFormat:         cfg.LogFormat,
		LogLevel:          cfg.LogLevel,
		LogAddSource:      cfg.LogAddSource,
		LogsEnabled:       cfg.OtelLogsEnabled,
		MetricsEnabled:    cfg.OtelMetricsEnabled,
		ServiceName:       cfg.OtelServiceName,
		ServiceVersion:    cfg.OtelServiceVersion,
		ServiceNamespace:  cfg.OtelServiceNamespace,
		PipelineID:        cfg.OtelPipelineID,
		ServiceInstanceID: cfg.OtelServiceInstanceID,
	}
	log := observability.ConfigureLogger(obsConfig, logOut)

	log.Info("Starting App", slog.String("version", version))

	if err := observability.InitMetrics(obsConfig); err != nil {
		return fmt.Errorf("init metrics: %w", err)
	}

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
		client.WithMaxBytes(cfg.NATSMaxStreamBytes),
	)
	if err != nil {
		return fmt.Errorf("nats client: %w", err)
	}

	defer cleanUp(nc, log)

	if cfg.DatabaseURL == "" {
		return fmt.Errorf("database URL is required: set GLASSFLOW_DATABASE_URL environment variable")
	}

	if role == internal.RoleMigrateData {
		pool, err := storage.NewPool(ctx, cfg.DatabaseURL)
		if err != nil {
			return fmt.Errorf("connect to postgres: %w", err)
		}
		defer pool.Close()
		return datamigrations.Run(ctx, pool)
	}

	encryptionKey, err := loadEncryptionKey(cfg, log)
	if err != nil {
		return fmt.Errorf("load encryption key: %w", err)
	}

	db, err := storage.NewPipelineStore(ctx, cfg.DatabaseURL, log, encryptionKey, role)
	if err != nil {
		return fmt.Errorf("create postgres store for pipelines: %w", err)
	}

	switch role {
	case internal.RoleSink:
		return mainSink(ctx, nc, cfg, db, log)
	case internal.RoleJoin:
		return mainJoin(ctx, nc, cfg, db, log)
	case internal.RoleIngestor:
		return mainIngestor(ctx, nc, cfg, db, log)
	case internal.RoleETL:
		return mainEtl(ctx, nc, cfg, db, log)
	case internal.RoleDeduplicator:
		return mainDeduplicatorV2(ctx, nc, cfg, log)
	case internal.RoleOLTPReceiver:
		return mainOLTPReceiver(ctx, nc, cfg, log)
	default:
		return fmt.Errorf("unknown role: %s", role)
	}
}

func mainEtl(
	ctx context.Context,
	nc *client.NATSClient,
	cfg *config,
	db service.PipelineStore,
	log *slog.Logger,
) error {
	// Run data migration from NATS KV to Postgres
	kvStoreName := cfg.NATSPipelineKV

	err := storage.MigratePipelinesFromNATSKV(ctx, nc, db, kvStoreName, log)
	if err != nil {
		// Log error but don't fail startup (data migration failures shouldn't block API)
		log.Error("data migration from NATS KV failed",
			slog.String("error", err.Error()),
			slog.String("kv_store_name", kvStoreName))
	} else {
		log.Info("data migration from NATS KV completed",
			slog.String("kv_store_name", kvStoreName))
	}

	dlq := dlq.NewClient(nc)

	var orch service.Orchestrator

	if cfg.RunLocal {
		orch = orchestrator.NewLocalOrchestrator(nc, db, log)
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

	usageStatsClient := newUsageStatsClient(cfg, log, db)

	pipelineSvc := service.NewPipelineService(orch, db, log)

	err = pipelineSvc.CleanUpPipelines(ctx)
	if err != nil {
		log.Error("failed to clean up pipelines on startup", slog.Any("error", err))
	}

	handler := api.NewRouter(log, pipelineSvc, dlq, usageStatsClient)

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

	go func() {
		time.Sleep(2 * time.Second) // small delay to wait for server to start
		usageStatsClient.SendEvent("ready", "api", nil)
		usageStatsCollector := service.NewUsageStatsCollector(db, nc, dlq, usageStatsClient, log)
		usageStatsCollector.Start(ctx)
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

func mainSink(ctx context.Context, nc *client.NATSClient, cfg *config, db service.PipelineStore, log *slog.Logger) error {
	pipelineCfg, err := getPipelineConfigFromJSON(cfg.PipelineConfig)
	if err != nil {
		return fmt.Errorf("failed to get pipeline config: %w", err)
	}

	if pipelineCfg.ID == "" {
		return fmt.Errorf("pipeline ID is empty")
	}

	observability.SetPipelineID(pipelineCfg.ID)

	if pipelineCfg.Sink.SourceID == "" {
		return fmt.Errorf("stream_id in sink config cannot be empty")
	}

	sinkRunner := service.NewSinkRunner(
		log,
		nc,
		pipelineCfg,
		db,
	)

	usageStatsClient := newUsageStatsClient(cfg, log, nil)

	return runWithGracefulShutdown(
		ctx,
		sinkRunner,
		log,
		internal.RoleSink,
		usageStatsClient,
	)
}

func mainJoin(ctx context.Context, nc *client.NATSClient, cfg *config, db service.PipelineStore, log *slog.Logger) error {
	if cfg.JoinType == "" {
		return fmt.Errorf("join type must be specified")
	}

	pipelineCfg, err := getPipelineConfigFromJSON(cfg.PipelineConfig)
	if err != nil {
		return fmt.Errorf("failed to get pipeline config: %w", err)
	}

	if pipelineCfg.ID == "" {
		return fmt.Errorf("pipeline ID is empty")
	}

	observability.SetPipelineID(pipelineCfg.ID)

	if !pipelineCfg.Join.Enabled {
		return fmt.Errorf("join is not enabled in pipeline config")
	}

	if len(pipelineCfg.Join.Sources) != 2 {
		return fmt.Errorf("join must have exactly 2 sources")
	}

	joinRunner := service.NewJoinRunner(log, nc, pipelineCfg, db)

	usageStatsClient := newUsageStatsClient(cfg, log, nil)

	return runWithGracefulShutdown(
		ctx,
		joinRunner,
		log,
		internal.RoleJoin,
		usageStatsClient,
	)
}

func mainIngestor(ctx context.Context, nc *client.NATSClient, cfg *config, db service.PipelineStore, log *slog.Logger) error {
	if cfg.IngestorTopic == "" {
		return fmt.Errorf("ingestor topic must be specified")
	}

	pipelineCfg, err := getPipelineConfigFromJSON(cfg.PipelineConfig)
	if err != nil {
		return fmt.Errorf("failed to get pipeline config: %w", err)
	}

	if pipelineCfg.ID == "" {
		return fmt.Errorf("pipeline ID is empty")
	}

	observability.SetPipelineID(pipelineCfg.ID)

	topicCfg, err := getIngestorTopicConfig(pipelineCfg, cfg.IngestorTopic)
	if err != nil {
		return fmt.Errorf("resolve ingestor topic config: %w", err)
	}

	runtimeCfg, err := getIngestorRuntimeConfigFromEnv(topicCfg.Deduplication.Enabled)
	if err != nil {
		return fmt.Errorf("resolve ingestor runtime config: %w", err)
	}

	ingestorRunner := service.NewIngestorRunner(log, nc, cfg.IngestorTopic, pipelineCfg, db, runtimeCfg)

	usageStatsClient := newUsageStatsClient(cfg, log, nil)

	return runWithGracefulShutdown(
		ctx,
		ingestorRunner,
		log,
		internal.RoleIngestor,
		usageStatsClient,
	)
}

func getIngestorTopicConfig(pipelineCfg models.PipelineConfig, topicName string) (models.KafkaTopicsConfig, error) {
	for _, topic := range pipelineCfg.Ingestor.KafkaTopics {
		if topic.Name == topicName {
			return topic, nil
		}
	}

	return models.KafkaTopicsConfig{}, fmt.Errorf("topic %q not found in ingestor config", topicName)
}

func getIngestorRuntimeConfigFromEnv(dedupEnabled bool) (models.IngestorRuntimeConfig, error) {
	prefix := os.Getenv("NATS_SUBJECT_PREFIX")
	if prefix == "" {
		return models.IngestorRuntimeConfig{}, fmt.Errorf("required environment variable NATS_SUBJECT_PREFIX is missing or empty")
	}

	podIndexRaw := os.Getenv("GLASSFLOW_POD_INDEX")
	if podIndexRaw == "" {
		return models.IngestorRuntimeConfig{}, fmt.Errorf("required environment variable GLASSFLOW_POD_INDEX is missing or empty")
	}

	podIndex, err := strconv.Atoi(podIndexRaw)
	if err != nil || podIndex < 0 {
		return models.IngestorRuntimeConfig{}, fmt.Errorf("invalid GLASSFLOW_POD_INDEX=%q: must be a non-negative integer", podIndexRaw)
	}

	totalSubjects := 1
	if raw := os.Getenv("NATS_SUBJECT_TOTAL_COUNT"); raw != "" {
		n, err := strconv.Atoi(raw)
		if err != nil || n <= 0 {
			return models.IngestorRuntimeConfig{}, fmt.Errorf("invalid NATS_SUBJECT_TOTAL_COUNT=%q: must be a positive integer", raw)
		}
		totalSubjects = n
	}

	cfg := models.IngestorRuntimeConfig{
		OutputSubject:       fmt.Sprintf("%s.%d", prefix, podIndex),
		OutputSubjectPrefix: prefix,
		TotalSubjectCount:   totalSubjects,
		DedupSubjectPrefix:  prefix,
	}

	if !dedupEnabled {
		return cfg, nil
	}

	subjectCountRaw := os.Getenv("NATS_SUBJECT_COUNT")
	if subjectCountRaw == "" {
		return models.IngestorRuntimeConfig{}, fmt.Errorf("required environment variable NATS_SUBJECT_COUNT is missing or empty when deduplication is enabled")
	}

	subjectCount, err := strconv.Atoi(subjectCountRaw)
	if err != nil || subjectCount <= 0 {
		return models.IngestorRuntimeConfig{}, fmt.Errorf("invalid NATS_SUBJECT_COUNT=%q: must be a positive integer when deduplication is enabled", subjectCountRaw)
	}

	cfg.DedupSubjectCount = subjectCount
	return cfg, nil
}

func runWithGracefulShutdown(
	ctx context.Context,
	runner service.Runner,
	log *slog.Logger,
	serviceName string,
	usageStatsClient *usagestats.Client,
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
			usageStatsClient.SendEvent("ready", serviceName, nil)
		case <-runner.Done():
			log.Warn("Component has crashed!", slog.String("service", serviceName))
			wg.Wait()
			usageStatsClient.SendEvent("crashed", serviceName, nil)
			return fmt.Errorf("%s component stopped by itself", serviceName)
		case <-ctx.Done():
			log.Info("Received termination signal - shutting down", slog.String("service", serviceName))
			wg.Add(1)
			usageStatsClient.SendEvent("terminated", serviceName, nil)
			go func() {
				defer wg.Done()
				runner.Shutdown()
			}()
			wg.Wait()
			return nil
		}
	}
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

func newUsageStatsClient(cfg *config, log *slog.Logger, db service.PipelineStore) *usagestats.Client {
	return usagestats.NewClient(
		cfg.UsageStatsEndpoint,
		cfg.UsageStatsUsername,
		cfg.UsageStatsPassword,
		cfg.UsageStatsInstallationID,
		cfg.UsageStatsEnabled,
		log,
		db,
	)
}

func cleanUp(nc *client.NATSClient, log *slog.Logger) {
	if nc != nil {
		err := nc.Close()
		if err != nil {
			log.Error("failed to close NATS connection", slog.Any("error", err))
		}
	}
}
