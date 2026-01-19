package benchmark

import (
	"context"
	"encoding/base64"
	"fmt"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/ClickHouse/clickhouse-go/v2"
	"github.com/nats-io/nats.go"
	"github.com/nats-io/nats.go/jetstream"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/client"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

// Environment variable names for benchmark configuration
const (
	envNATSURL    = "localhost:4222"
	envCHHost     = "clickhouse.staging-cluster.glassflow.xyz"
	envCHPort     = "9000"
	envCHDatabase = "default"
	envCHUsername = "glassflow"
	envCHPassword = "-"
	envBatchSize  = 100000
	envTargetRPS  = 100000
	envDuration   = time.Minute * 5
)

// Default values
const (
	// Stream and consumer names for benchmark
	benchStreamName   = "benchmark-stream"
	benchSubjectName  = "benchmark.events"
	benchConsumerName = "benchmark-consumer"
	benchTableName    = "benchmark_test_nnaumov"
	benchDLQStream    = "benchmark-dlq"
	benchDLQSubject   = "benchmark.failed"
)

// BenchConfig holds the benchmark configuration loaded from environment
type BenchConfig struct {
	NATSUrl    string
	CHHost     string
	CHPort     string
	CHDatabase string
	CHUsername string
	CHPassword string
	BatchSize  int
	TargetRPS  int
	Duration   time.Duration
}

// LoadConfig loads benchmark configuration from environment variables
func LoadConfig(t *testing.T) *BenchConfig {
	t.Helper()

	natsURL := envNATSURL

	chHost := envCHHost

	cfg := &BenchConfig{
		NATSUrl:    natsURL,
		CHHost:     chHost,
		CHPort:     envCHPort,
		CHDatabase: envCHDatabase,
		CHUsername: envCHUsername,
		CHPassword: envCHPassword,
		BatchSize:  envBatchSize,
		TargetRPS:  envTargetRPS,
		Duration:   envDuration,
	}

	return cfg
}

// BenchResources holds all resources needed for the benchmark
type BenchResources struct {
	NATSClient *client.NATSClient
	CHConn     clickhouse.Conn
	Config     *BenchConfig
}

// SetupResources initializes all benchmark resources
func SetupResources(t *testing.T, cfg *BenchConfig) *BenchResources {
	t.Helper()

	// Connect to NATS
	natsClient, err := client.NewNATSClient(context.Background(), cfg.NATSUrl)
	if err != nil {
		t.Fatalf("Failed to connect to NATS: %v", err)
	}

	// Connect to ClickHouse
	chConn, err := clickhouse.Open(&clickhouse.Options{
		Addr: []string{cfg.CHHost + ":" + cfg.CHPort},
		Auth: clickhouse.Auth{
			Database: cfg.CHDatabase,
			Username: cfg.CHUsername,
			Password: cfg.CHPassword,
		},
	})
	if err != nil {
		natsClient.Close()
		t.Fatalf("Failed to connect to ClickHouse: %v", err)
	}

	// Verify connections
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := chConn.Ping(ctx); err != nil {
		natsClient.Close()
		chConn.Close()
		t.Fatalf("Failed to ping ClickHouse: %v", err)
	}

	return &BenchResources{
		NATSClient: natsClient,
		CHConn:     chConn,
		Config:     cfg,
	}
}

// Cleanup releases all benchmark resources
func (r *BenchResources) Cleanup(t *testing.T) {
	t.Helper()

	ctx := context.Background()

	// Delete NATS streams
	if r.NATSClient != nil {
		_ = r.NATSClient.DeleteStream(ctx, benchStreamName)
		_ = r.NATSClient.DeleteStream(ctx, benchDLQStream)
		_ = r.NATSClient.Close()
	}

	// Drop ClickHouse table
	if r.CHConn != nil {
		//_ = r.CHConn.Exec(ctx, fmt.Sprintf("DROP TABLE IF EXISTS %s.%s", r.Config.CHDatabase, benchTableName))
		_ = r.CHConn.Close()
	}
}

// CreateNATSStream creates the benchmark NATS stream
func (r *BenchResources) CreateNATSStream(t *testing.T) {
	t.Helper()

	ctx := context.Background()

	// Delete existing stream if any
	_ = r.NATSClient.DeleteStream(ctx, benchStreamName)

	// Create stream with high limits for benchmark
	err := r.NATSClient.CreateOrUpdateStream(ctx, benchStreamName, benchSubjectName, 0)
	if err != nil {
		t.Fatalf("Failed to create NATS stream: %v", err)
	}

	t.Logf("Created NATS stream: %s with subject: %s", benchStreamName, benchSubjectName)
}

// CreateNATSConsumer creates the benchmark NATS consumer
func (r *BenchResources) CreateNATSConsumer(t *testing.T) jetstream.Consumer {
	t.Helper()

	ctx := context.Background()
	js := r.NATSClient.JetStream()

	stream, err := js.Stream(ctx, benchStreamName)
	if err != nil {
		t.Fatalf("Failed to get stream: %v", err)
	}

	consumerCfg := jetstream.ConsumerConfig{
		Name:          benchConsumerName,
		Durable:       benchConsumerName,
		FilterSubject: benchSubjectName,
		AckWait:       internal.NatsDefaultAckWait,
		AckPolicy:     jetstream.AckAllPolicy,
		MaxAckPending: -1, // Unlimited for benchmark
	}

	consumer, err := stream.CreateOrUpdateConsumer(ctx, consumerCfg)
	if err != nil {
		t.Fatalf("Failed to create consumer: %v", err)
	}

	t.Logf("Created NATS consumer: %s", benchConsumerName)
	return consumer
}

// CreateDLQStream creates the DLQ stream for benchmark
func (r *BenchResources) CreateDLQStream(t *testing.T) {
	t.Helper()

	ctx := context.Background()

	// Delete existing stream if any
	_ = r.NATSClient.DeleteStream(ctx, benchDLQStream)

	err := r.NATSClient.CreateOrUpdateStream(ctx, benchDLQStream, benchDLQSubject, 0)
	if err != nil {
		t.Fatalf("Failed to create DLQ stream: %v", err)
	}

	t.Logf("Created DLQ stream: %s", benchDLQStream)
}

// CreateClickHouseTable creates the benchmark table
func (r *BenchResources) CreateClickHouseTable(t *testing.T) {
	t.Helper()

	ctx := context.Background()

	// Drop existing table
	dropQuery := fmt.Sprintf("DROP TABLE IF EXISTS %s.%s", r.Config.CHDatabase, benchTableName)
	if err := r.CHConn.Exec(ctx, dropQuery); err != nil {
		t.Fatalf("Failed to drop existing table: %v", err)
	}

	// Create table with simple schema for benchmark
	createQuery := fmt.Sprintf(`
		CREATE TABLE %s.%s (
			_gf_seq_num UInt64,
			event_id    String,
			timestamp   DateTime64(3),
			user_id     String,
			value       Float64
		) ENGINE = MergeTree()
		ORDER BY (_gf_seq_num, timestamp)
	`, r.Config.CHDatabase, benchTableName)

	if err := r.CHConn.Exec(ctx, createQuery); err != nil {
		t.Fatalf("Failed to create benchmark table: %v", err)
	}

	t.Logf("Created ClickHouse table: %s.%s", r.Config.CHDatabase, benchTableName)
}

// GetSinkConfig returns the sink configuration for benchmark
func (r *BenchResources) GetSinkConfig() models.SinkComponentConfig {
	return models.SinkComponentConfig{
		Type:     internal.ClickHouseSinkType,
		StreamID: benchStreamName,
		Batch: models.BatchConfig{
			MaxBatchSize: r.Config.BatchSize,
			MaxDelayTime: *models.NewJSONDuration(60 * time.Second),
		},
		NATSConsumerName: benchConsumerName,
		ClickHouseConnectionParams: models.ClickHouseConnectionParamsConfig{
			Host:     r.Config.CHHost,
			Port:     r.Config.CHPort,
			Database: r.Config.CHDatabase,
			Username: r.Config.CHUsername,
			Password: base64.StdEncoding.EncodeToString([]byte(r.Config.CHPassword)),
			Table:    benchTableName,
			Secure:   false,
		},
	}
}

// GetMapperConfig returns the schema mapper configuration for benchmark
func GetMapperConfig() models.MapperConfig {
	return models.MapperConfig{
		Type: internal.SchemaMapperJSONToCHType,
		Streams: map[string]models.StreamSchemaConfig{
			benchStreamName: {
				Fields: []models.StreamDataField{
					{FieldName: "event_id", FieldType: "string"},
					{FieldName: "timestamp", FieldType: "int64"},
					{FieldName: "user_id", FieldType: "string"},
					{FieldName: "value", FieldType: "float64"},
				},
			},
		},
		SinkMapping: []models.SinkMappingConfig{
			{ColumnName: "event_id", StreamName: benchStreamName, FieldName: "event_id", ColumnType: "String"},
			{ColumnName: "timestamp", StreamName: benchStreamName, FieldName: "timestamp", ColumnType: "DateTime64(3)"},
			{ColumnName: "user_id", StreamName: benchStreamName, FieldName: "user_id", ColumnType: "String"},
			{ColumnName: "value", StreamName: benchStreamName, FieldName: "value", ColumnType: "Float64"},
		},
	}
}

// MetricsCollector collects benchmark metrics
type MetricsCollector struct {
	mu sync.Mutex

	// Producer metrics
	publishedCount int64
	publishErrors  int64
	publishLatency []time.Duration

	// Consumer metrics
	consumedCount int64
	batchCount    int64

	// Timing
	startTime time.Time
}

// NewMetricsCollector creates a new metrics collector
func NewMetricsCollector() *MetricsCollector {
	return &MetricsCollector{
		startTime:      time.Now(),
		publishLatency: make([]time.Duration, 0, 10000),
	}
}

// RecordPublish records a publish operation
func (m *MetricsCollector) RecordPublish(latency time.Duration, err error) {
	if err != nil {
		atomic.AddInt64(&m.publishErrors, 1)
		return
	}
	atomic.AddInt64(&m.publishedCount, 1)
}

// RecordConsume records consumed messages
func (m *MetricsCollector) RecordConsume(count int) {
	atomic.AddInt64(&m.consumedCount, int64(count))
	atomic.AddInt64(&m.batchCount, 1)
}

// GetPublishedCount returns the number of published messages
func (m *MetricsCollector) GetPublishedCount() int64 {
	return atomic.LoadInt64(&m.publishedCount)
}

// GetConsumedCount returns the number of consumed messages
func (m *MetricsCollector) GetConsumedCount() int64 {
	return atomic.LoadInt64(&m.consumedCount)
}

// Report prints the benchmark results
func (m *MetricsCollector) Report(t *testing.T) {
	duration := time.Since(m.startTime).Seconds()

	publishedCount := atomic.LoadInt64(&m.publishedCount)
	publishErrors := atomic.LoadInt64(&m.publishErrors)
	consumedCount := atomic.LoadInt64(&m.consumedCount)
	batchCount := atomic.LoadInt64(&m.batchCount)

	avgBatchSize := float64(0)
	if batchCount > 0 {
		avgBatchSize = float64(consumedCount) / float64(batchCount)
	}

	t.Logf("")
	t.Logf("========== BENCHMARK RESULTS ==========")
	t.Logf("Duration: %.1fs", duration)
	t.Logf("")
	t.Logf("THROUGHPUT:")
	t.Logf("  Published:     %d messages", publishedCount)
	t.Logf("  Publish Errors:%d", publishErrors)
	t.Logf("  Consumed:      %d messages", consumedCount)
	t.Logf("  Publish Rate:  %.0f msg/sec", float64(publishedCount)/duration)
	t.Logf("  Consume Rate:  %.0f msg/sec", float64(consumedCount)/duration)
	t.Logf("")
	t.Logf("BATCHES:")
	t.Logf("  Total:         %d", batchCount)
	t.Logf("  Avg Size:      %.0f", avgBatchSize)
	t.Logf("========================================")
}

// GetDLQSubject returns the DLQ subject
func GetDLQSubject() string {
	return benchDLQSubject
}

// GetSubject returns the benchmark subject
func GetSubject() string {
	return benchSubjectName
}

// GetStreamName returns the benchmark stream name
func GetStreamName() string {
	return benchStreamName
}

// Publisher is an interface for publishing messages
type Publisher interface {
	Publish(ctx context.Context, data []byte) error
	PublishAsync(msg *nats.Msg) error
	WaitForAcks() <-chan struct{}
}

// NATSBenchPublisher wraps NATS JetStream for benchmark publishing
type NATSBenchPublisher struct {
	js      jetstream.JetStream
	subject string
}

// NewNATSBenchPublisher creates a new benchmark publisher
func NewNATSBenchPublisher(js jetstream.JetStream, subject string) *NATSBenchPublisher {
	return &NATSBenchPublisher{
		js:      js,
		subject: subject,
	}
}

// Publish publishes a message synchronously
func (p *NATSBenchPublisher) Publish(ctx context.Context, data []byte) error {
	_, err := p.js.Publish(ctx, p.subject, data)
	return err
}

// PublishAsync publishes a message asynchronously
func (p *NATSBenchPublisher) PublishAsync(msg *nats.Msg) error {
	_, err := p.js.PublishMsgAsync(msg)
	return err
}

// WaitForAcks waits for all async publish acks
func (p *NATSBenchPublisher) WaitForAcks() <-chan struct{} {
	return p.js.PublishAsyncComplete()
}
