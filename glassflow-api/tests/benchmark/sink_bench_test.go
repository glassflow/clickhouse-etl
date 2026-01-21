package benchmark

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/nats-io/nats.go"
	"golang.org/x/time/rate"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/schema"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/sink"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/stream"
)

// TestSinkBenchmark is the main benchmark test that reproduces the sink performance issue.
// It creates a high-throughput producer publishing at a target RPS while the sink consumes.
//
// Run with:
//
//	BENCH_NATS_URL=localhost:4222 BENCH_CH_HOST=localhost go test -v -timeout 5m -run TestSinkBenchmark ./tests/benchmark/
//
// With CPU profiling:
//
//	BENCH_NATS_URL=localhost:4222 BENCH_CH_HOST=localhost go test -v -timeout 5m -run TestSinkBenchmark -cpuprofile=cpu.prof ./tests/benchmark/
func TestSinkBenchmark(t *testing.T) {
	// 1. Load configuration from environment
	cfg := LoadConfig(t)

	t.Logf("Starting sink benchmark with configuration:")
	t.Logf("  NATS URL:    %s", cfg.NATSUrl)
	t.Logf("  CH Host:     %s:%s", cfg.CHHost, cfg.CHPort)
	t.Logf("  Batch Size:  %d", cfg.BatchSize)
	t.Logf("  Target RPS:  %d", cfg.TargetRPS)
	t.Logf("  Duration:    %s", cfg.Duration)

	// 2. Setup resources
	resources := SetupResources(t, cfg)
	defer resources.Cleanup(t)

	// 3. Create NATS stream and consumer
	resources.CreateNATSStream(t)
	resources.CreateDLQStream(t)
	consumer := resources.CreateNATSConsumer(t)

	// 4. Create ClickHouse table
	resources.CreateClickHouseTable(t)

	// 5. Create schema mapper
	mapperCfg := GetMapperConfig()
	schemaMapper, err := schema.NewJSONToClickHouseMapper(mapperCfg.Streams, mapperCfg.SinkMapping)
	if err != nil {
		t.Fatalf("Failed to create schema mapper: %v", err)
	}

	// 6. Create DLQ publisher
	dlqPublisher := stream.NewNATSPublisher(
		resources.NATSClient.JetStream(),
		stream.PublisherConfig{Subject: GetDLQSubject()},
	)

	// 7. Create sink
	sinkConfig := resources.GetSinkConfig()
	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))

	chSink, err := sink.NewClickHouseSink(
		sinkConfig,
		consumer,
		resources.NATSClient.JetStream(),
		schemaMapper,
		logger,
		nil, // No observability meter for benchmark
		dlqPublisher,
		models.ClickhouseQueryConfig{},
		GetStreamName(),
	)
	if err != nil {
		t.Fatalf("Failed to create ClickHouse sink: %v", err)
	}

	// 8. Start metrics collector
	metrics := NewMetricsCollector()

	// 9. Create context with timeout
	ctx, cancel := context.WithTimeout(context.Background(), cfg.Duration)
	defer cancel()

	var wg sync.WaitGroup

	// 10. Start sink in background
	sinkErrCh := make(chan error, 1)
	wg.Add(1)
	go func() {
		defer wg.Done()
		t.Log("Starting sink consumer...")
		if err := chSink.Start(ctx); err != nil {
			if ctx.Err() == nil {
				sinkErrCh <- err
			}
		}
		t.Log("Sink consumer stopped")
	}()

	// 11. Start consumer metrics tracking
	wg.Add(1)
	go func() {
		defer wg.Done()
		trackConsumerMetrics(ctx, t, consumer, metrics)
	}()

	// Give the sink a moment to start
	time.Sleep(500 * time.Millisecond)

	// 12. Start producer
	t.Log("Starting producer...")
	wg.Add(1)
	go func() {
		defer wg.Done()
		runProducer(ctx, t, resources, cfg.TargetRPS, metrics)
		t.Log("Producer stopped")
	}()

	// 13. Wait for context to expire
	<-ctx.Done()

	// 14. Stop sink gracefully
	t.Log("Stopping sink...")
	chSink.Stop(false)

	// Wait for all goroutines
	wg.Wait()

	// Check for sink errors
	select {
	case err := <-sinkErrCh:
		t.Errorf("Sink error: %v", err)
	default:
	}

	// 15. Report results
	metrics.Report(t)

	// 16. Verify data in ClickHouse
	verifyClickHouseData(t, resources)
}

// runProducer publishes messages at the target RPS using async publishing
func runProducer(ctx context.Context, t *testing.T, resources *BenchResources, targetRPS int, metrics *MetricsCollector) {
	t.Helper()

	js := resources.NATSClient.JetStream()
	subject := GetSubject()

	// Use rate limiter to control publish rate
	limiter := rate.NewLimiter(rate.Limit(targetRPS), targetRPS/10)

	seq := int64(0)
	batchSize := 100 // Publish in small batches for efficiency
	pendingLimit := internal.PublisherMaxPendingAcks

	for {
		select {
		case <-ctx.Done():
			// Wait for pending acks before returning
			select {
			case <-js.PublishAsyncComplete():
			case <-time.After(5 * time.Second):
				t.Log("Timeout waiting for async acks")
			}
			return
		default:
		}

		// Wait for rate limiter
		if err := limiter.WaitN(ctx, batchSize); err != nil {
			return
		}

		// Check pending acks to avoid overwhelming NATS
		for js.PublishAsyncPending() >= pendingLimit {
			select {
			case <-ctx.Done():
				return
			case <-time.After(10 * time.Millisecond):
			}
		}

		// Publish batch of messages
		for i := 0; i < batchSize; i++ {
			msg := generateMessage(seq)
			seq++

			start := time.Now()
			_, err := js.PublishMsgAsync(&nats.Msg{
				Subject: subject,
				Data:    msg,
			})
			metrics.RecordPublish(time.Since(start), err)

			if err != nil {
				t.Logf("Publish error: %v", err)
			}
		}
	}
}

// generateMessage creates a benchmark message
func generateMessage(seq int64) []byte {
	msg := map[string]any{
		"event_id":  fmt.Sprintf("evt-%d", seq),
		"timestamp": time.Now().UnixMilli(),
		"user_id":   fmt.Sprintf("user-%d", seq%10000),
		"value":     float64(seq) * 0.01,
	}
	data, _ := json.Marshal(msg)
	return data
}

// trackConsumerMetrics periodically checks consumer info to track consumption
func trackConsumerMetrics(ctx context.Context, t *testing.T, consumer any, metrics *MetricsCollector) {
	t.Helper()

	type consumerInfoProvider interface {
		Info(context.Context) (*any, error)
	}

	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	var lastDelivered uint64

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			// Try to get consumer info
			if c, ok := consumer.(interface {
				Info(context.Context) (any, error)
			}); ok {
				info, err := c.Info(ctx)
				if err != nil {
					continue
				}
				// Extract NumDelivered from info
				if infoMap, ok := info.(map[string]any); ok {
					if delivered, ok := infoMap["num_delivered"].(uint64); ok {
						if delivered > lastDelivered {
							metrics.RecordConsume(int(delivered - lastDelivered))
							lastDelivered = delivered
						}
					}
				}
			}
		}
	}
}

// verifyClickHouseData verifies that data was written to ClickHouse
func verifyClickHouseData(t *testing.T, resources *BenchResources) {
	t.Helper()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var count uint64
	query := fmt.Sprintf("SELECT count() FROM %s.%s", resources.Config.CHDatabase, benchTableName)
	if err := resources.CHConn.QueryRow(ctx, query).Scan(&count); err != nil {
		t.Errorf("Failed to query ClickHouse: %v", err)
		return
	}

	t.Logf("ClickHouse table contains %d rows", count)
}

// TestSinkBenchmarkWithDifferentBatchSizes runs benchmarks with various batch sizes
func TestSinkBenchmarkWithDifferentBatchSizes(t *testing.T) {
	cfg := LoadConfig(t)

	batchSizes := []int{10000, 50000, 100000, 250000}

	for _, batchSize := range batchSizes {
		t.Run(fmt.Sprintf("BatchSize_%d", batchSize), func(t *testing.T) {
			testCfg := *cfg
			testCfg.BatchSize = batchSize
			testCfg.Duration = 30 * time.Second // Shorter duration for comparison

			runBenchmarkWithConfig(t, &testCfg)
		})
	}
}

// runBenchmarkWithConfig runs a benchmark with the given configuration
func runBenchmarkWithConfig(t *testing.T, cfg *BenchConfig) {
	t.Helper()

	t.Logf("Running benchmark with batch size: %d", cfg.BatchSize)

	resources := SetupResources(t, cfg)
	defer resources.Cleanup(t)

	resources.CreateNATSStream(t)
	resources.CreateDLQStream(t)
	consumer := resources.CreateNATSConsumer(t)
	resources.CreateClickHouseTable(t)

	mapperCfg := GetMapperConfig()
	schemaMapper, err := schema.NewJSONToClickHouseMapper(mapperCfg.Streams, mapperCfg.SinkMapping)
	if err != nil {
		t.Fatalf("Failed to create schema mapper: %v", err)
	}

	dlqPublisher := stream.NewNATSPublisher(
		resources.NATSClient.JetStream(),
		stream.PublisherConfig{Subject: GetDLQSubject()},
	)

	sinkConfig := resources.GetSinkConfig()
	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelWarn}))

	chSink, err := sink.NewClickHouseSink(
		sinkConfig,
		consumer,
		resources.NATSClient.JetStream(),
		schemaMapper,
		logger,
		nil,
		dlqPublisher,
		models.ClickhouseQueryConfig{WaitForAsyncInsert: true},
		GetStreamName(),
	)
	if err != nil {
		t.Fatalf("Failed to create ClickHouse sink: %v", err)
	}

	metrics := NewMetricsCollector()
	ctx, cancel := context.WithTimeout(context.Background(), cfg.Duration)
	defer cancel()

	var wg sync.WaitGroup

	wg.Add(1)
	go func() {
		defer wg.Done()
		_ = chSink.Start(ctx)
	}()

	time.Sleep(500 * time.Millisecond)

	wg.Add(1)
	go func() {
		defer wg.Done()
		runProducer(ctx, t, resources, cfg.TargetRPS, metrics)
	}()

	<-ctx.Done()
	chSink.Stop(false)
	wg.Wait()

	metrics.Report(t)
	verifyClickHouseData(t, resources)
}
