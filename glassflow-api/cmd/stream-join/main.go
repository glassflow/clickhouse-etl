package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"runtime"
	"runtime/pprof"
	"sync"
	"syscall"
	"time"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/client"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/kv"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/operator"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/schema"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/stream"
)

type NATSStreamConfig struct {
	StreamName  string `json:"stream_name"`
	SubjectName string `json:"subject_name"`
	TTL         string `json:"ttl"`
}

type Config struct {
	NstsURL  string           `json:"nats_url"`
	Left     NATSStreamConfig `json:"left"`
	Right    NATSStreamConfig `json:"right"`
	Results  NATSStreamConfig `json:"results"`
	JoinType string           `json:"join_type"`
	Schema   schema.Config    `json:"schema"`
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
	cpuProfile := flag.String("cpuprofile", "", "write CPU profile to file")
	memProfile := flag.String("memprofile", "", "write memory profile to `file`")
	flag.Parse()

	if *cpuProfile != "" {
		f, err := os.Create(*cpuProfile)
		if err != nil {
			fmt.Fprintf(os.Stderr, "error: %v\n", err)
			os.Exit(1)
		}
		err = pprof.StartCPUProfile(f)
		if err != nil {
			fmt.Fprintf(os.Stderr, "could not start CPU profile: %s\n", err)
			os.Exit(1)
		}
		defer pprof.StopCPUProfile()
	}

	if *memProfile != "" {
		f, err := os.Create(*memProfile)
		if err != nil {
			fmt.Fprintf(os.Stderr, "could not create memory profile: %s\n", err)
		}
		defer f.Close()
		runtime.GC()
		if err := pprof.Lookup("allocs").WriteTo(f, 0); err != nil {
			fmt.Fprintf(os.Stderr, "could not write memory profile: %s\n", err)
		}
	}

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

	// hardcoded the changes for now
	nc, err := client.NewNATSWrapper(cfg.NstsURL, 24*time.Hour)
	if err != nil {
		log.Error("failed to create NATS wrapper: ", slog.Any("error", err))
		return
	}

	// Create left and right stream consumers
	//nolint: exhaustruct // optional config
	leftConsumer, err := stream.NewConsumer(ctx, nc.JetStream(), stream.ConsumerConfig{
		NatsStream:   cfg.Left.StreamName,
		NatsConsumer: "leftStreamConsumer",
		NatsSubject:  cfg.Left.SubjectName,
	})
	if err != nil {
		log.Error("failed to create left consumer: ", slog.Any("error", err))
		return
	}

	//nolint: exhaustruct // optional config
	rightConsumer, err := stream.NewConsumer(ctx, nc.JetStream(), stream.ConsumerConfig{
		NatsStream:   cfg.Right.StreamName,
		NatsConsumer: "rightStreamConsumer",
		NatsSubject:  cfg.Right.SubjectName,
	})
	if err != nil {
		log.Error("failed to create right consumer: ", slog.Any("error", err))
		return
	}

	// Create results stream publisher
	resultsPublisher := stream.NewPublisher(nc.JetStream(), stream.PublisherConfig{
		Subject: cfg.Results.SubjectName,
	})

	// parse TTL values for left stream buffer
	leftTTL, err := time.ParseDuration(cfg.Left.TTL)
	if err != nil {
		log.Error("failed to parse left stream TTL: ", slog.Any("error", err))
		return
	}

	// parse TTL values for right stream buffer
	rightTTL, err := time.ParseDuration(cfg.Right.TTL)
	if err != nil {
		log.Error("failed to parse right stream TTL: ", slog.Any("error", err))
		return
	}

	// Create left and right stream buffers (NATS KeyValue stores)
	leftStreamBuffer, err := kv.NewNATSKeyValueStore(
		ctx,
		nc.JetStream(),
		kv.KeyValueStoreConfig{
			StoreName: cfg.Left.StreamName,
			TTL:       leftTTL,
		})
	if err != nil {
		log.Error("failed to create left stream buffer: ", slog.Any("error", err))
		return
	}

	rightStreamBuffer, err := kv.NewNATSKeyValueStore(
		ctx,
		nc.JetStream(),
		kv.KeyValueStoreConfig{
			StoreName: cfg.Right.StreamName,
			TTL:       rightTTL,
		})
	if err != nil {
		log.Error("failed to create right stream buffer: ", slog.Any("error", err))
		return
	}

	// Create schema mapper
	schemaMapper, err := schema.NewMapper(cfg.Schema.Streams, cfg.Schema.SinkMapping)
	if err != nil {
		log.Error("failed to create schema mapper: ", slog.Any("error", err))
		return
	}

	// Create JOIN operator
	joinOperator := operator.NewJoinOperator(
		leftConsumer,
		rightConsumer,
		resultsPublisher,
		schemaMapper,
		leftStreamBuffer,
		rightStreamBuffer,
		cfg.Left.StreamName,
		cfg.Right.StreamName,
		log,
	)

	wg := sync.WaitGroup{}

	signalChan := make(chan os.Signal, 1)
	signal.Notify(signalChan, os.Interrupt, syscall.SIGTERM)

	wg.Add(1)
	go func() {
		// Wait for interrupt signal
		defer wg.Done()
		<-signalChan
		log.Info("Received interrupt signal, shutting down gracefully...")
		joinOperator.Stop()
	}()

	errCh := make(chan error, 1)
	wg.Add(1)
	go func() {
		// Run the JOIN operator
		defer wg.Done()
		joinOperator.Start(ctx, errCh)
	}()

	wg.Wait()

	errs := func() []error {
		errors := make([]error, 0)

		select {
		case err, ok := <-errCh:
			if ok {
				errors = append(errors, fmt.Errorf("error from operator: %w", err))
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

	log.Info("Stand alone join operator stopped")
}
