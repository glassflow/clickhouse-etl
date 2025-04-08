package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"runtime"
	"syscall"
	"time"

	"github.com/kelseyhightower/envconfig"

	"github.com/glassflow/nats-kafka-bridge/nats"
	"github.com/glassflow/nats-kafka-bridge/server/conf"
	"github.com/glassflow/nats-kafka-bridge/server/core"
)

//nolint:gochecknoglobals,revive // build variables
var (
	commit string = "unspecified"
	app    string = "unspecified"
)

type Config struct {
	LogFormat    string     `default:"json" split_words:"true"`
	LogLevel     slog.Level `default:"info" split_words:"true"`
	LogAddSource bool       `default:"true" split_words:"true"`
	LogWithColor bool       `default:"false" split_words:"true"`
	LogWithTime  bool       `default:"false" split_words:"true"`

	ConnectorID string `required:"true" split_words:"true"`

	NATSServer             string        `required:"true" split_words:"true"`
	NATSSubject            string        `required:"true" split_words:"true"`
	NATSStream             string        `required:"true" split_words:"true"`
	NATSStreamMaxAge       time.Duration `default:"24h" split_words:"true"`
	NATSStreamDedupWindow  time.Duration `required:"true" split_words:"true"`
	NATSStreamDedupKey     string        `required:"true" split_words:"true"`
	NATSStreamDedupKeyType string        `default:"string" split_words:"true"`

	KafkaBrokers []string `required:"true" split_words:"true"`
	KafkaTopic   string   `required:"true" split_words:"true"`

	KafkaTLSKey  string `split_words:"true"`
	KafkaTLSCert string `split_words:"true"`
	KafkaTLSRoot string `split_words:"true"`

	KafkaSASLUser      string `split_words:"true"`
	KafkaSASLPassword  string `split_words:"true"`
	KafkaSASLMechanism string `split_words:"true"`
	KafkaSASLTLSEnable bool   `envconfig:"kafka_sasl_tls_enable" split_words:"true"`

	KafkaIAMEnable bool   `split_words:"true"`
	KafkaIAMRegion string `split_words:"true"`

	KafkaConsumerPartition          int32                `split_words:"true"`                  // optional partition for the reader
	KafkaConsumerGroupID            string               `split_words:"true"`                  // optional group id for reader, exclusive with partition
	KafkaConsumerGroupInitialOffset conf.CGInitialOffset `default:"newest" split_words:"true"` // allowed values: newest, oldest. Default is newest.

	KafkaSchemaRegistryURL string `split_words:"true"` // schema registry url for message schema validation
	KafkaSchemaSubjectName string `split_words:"true"` // name of the subject in the schema registry for the value
	KafkaSchemaVersion     int    `split_words:"true"` // version of the value schema to use. Default is latest.
	KafkaSchemaType        string `split_words:"true"` // allowed values: avro, json, protobuf. Default is avro.
}

func main() {
	var cfg Config
	err := envconfig.Process("bridge", &cfg)
	if err != nil {
		slog.Error("Error parsing bridge config", slog.Any("error", err))
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
	case "text":
		logHandler = slog.NewTextHandler(os.Stdout, logOpts)
	default:
		slog.Error("Unsupported log handler", slog.Any("error", err))
		os.Exit(1)
	}

	log := slog.New(logHandler)

	log = log.With(
		slog.String("app", app),
		slog.String("commit_hash", commit),
		slog.String("goversion", runtime.Version()),
	)

	// setup NATS stream, take care of context
	err = nats.SetupNATS(context.Background(), cfg.NATSServer, cfg.NATSStream, cfg.NATSSubject, cfg.NATSStreamMaxAge, cfg.NATSStreamDedupWindow)
	if err != nil {
		slog.Error("Error setting up NATS stream", slog.Any("error", err))
		os.Exit(1)
	}

	// setup connector server
	// initialize server properly
	var server *core.NATSKafkaBridge

	//nolint: exhaustruct // optional config
	connectorConf := conf.ConnectorConfig{
		ID: cfg.ConnectorID,

		Subject:         cfg.NATSSubject,
		Stream:          cfg.NATSStream,
		DedupKey:        cfg.NATSStreamDedupKey,
		DedupKeyType:    cfg.NATSStreamDedupKeyType,
		StartAtSequence: -1,

		Brokers: cfg.KafkaBrokers,
		Topic:   cfg.KafkaTopic,
		TLS: conf.TLSConf{
			Key:  cfg.KafkaTLSKey,
			Cert: cfg.KafkaTLSCert,
			Root: cfg.KafkaTLSRoot,
		},
		SASL: conf.SASL{
			User:      cfg.KafkaSASLUser,
			Password:  cfg.KafkaSASLPassword,
			Mechanism: cfg.KafkaSASLMechanism,
			TLS:       cfg.KafkaSASLTLSEnable,
		},
		IAM: conf.IAM{
			Enable: cfg.KafkaIAMEnable,
			Region: cfg.KafkaIAMRegion,
		},
		Partition:     cfg.KafkaConsumerPartition,
		GroupID:       cfg.KafkaConsumerGroupID,
		InitialOffset: cfg.KafkaConsumerGroupInitialOffset,

		SchemaRegistryURL: cfg.KafkaSchemaRegistryURL,
		SubjectName:       cfg.KafkaSchemaSubjectName,
		SchemaVersion:     cfg.KafkaSchemaVersion,
		SchemaType:        cfg.KafkaSchemaType,
	}

	server = core.NewNATSKafkaBridge(cfg.LogWithColor, cfg.LogWithTime)

	serverConf := conf.DefaultBridgeConfig(cfg.LogWithColor, cfg.LogWithTime)
	serverConf.NATS.Servers = append(serverConf.NATS.Servers, cfg.NATSServer)
	serverConf.Connect = []conf.ConnectorConfig{connectorConf}

	err = server.InitializeFromConfig(serverConf)
	if err != nil {
		logErrorFatalf(server, log, "error initializing config, %s", err.Error())
	}

	err = server.Start()
	if err != nil {
		logErrorFatalf(server, log, "error starting bridge, %s", err.Error())
	}

	go func() {
		sigChan := make(chan os.Signal, 1)
		signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM, syscall.SIGINT)

		for {
			<-sigChan

			if server.Logger() != nil {
				server.Logger().Noticef("received sig-interrupt, shutting down")
			}
			server.Stop()
			os.Exit(0)
		}
	}()

	// exit main but keep running goroutines
	runtime.Goexit()
}

func logErrorFatalf(b *core.NATSKafkaBridge, log *slog.Logger, format string, args ...interface{}) {
	if b.Logger() != nil {
		b.Logger().Errorf(format, args...)
	} else {
		log.Error(format, args...)
	}
	b.Stop()
	os.Exit(0)
}
