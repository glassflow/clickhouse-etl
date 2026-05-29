package steps

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/cucumber/godog"
	"github.com/nats-io/nats.go/jetstream"
	sdkmetric "go.opentelemetry.io/otel/sdk/metric"
	"go.opentelemetry.io/otel/sdk/metric/metricdata"

	"github.com/glassflow/clickhouse-etl/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl/glassflow-api/internal/component"
	"github.com/glassflow/clickhouse-etl/glassflow-api/internal/configs"
	"github.com/glassflow/clickhouse-etl/glassflow-api/internal/mapper"
	"github.com/glassflow/clickhouse-etl/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl/glassflow-api/internal/service"
	"github.com/glassflow/clickhouse-etl/glassflow-api/internal/storage"
	"github.com/glassflow/clickhouse-etl/glassflow-api/internal/stream"
	"github.com/glassflow/clickhouse-etl/glassflow-api/pkg/observability"
	"github.com/glassflow/clickhouse-etl/glassflow-api/tests/testutils"
)

type SinkTestSuite struct {
	BaseTestSuite

	streamName string
	tableName  string

	dlqStreamCfg jetstream.StreamConfig

	streamConfig   jetstream.StreamConfig
	consumerConfig jetstream.ConsumerConfig

	pipelineConfig *models.PipelineConfig
	pipelineStore  service.PipelineStore
	configStore    configs.ConfigStoreInterface

	clickhouseConn models.ClickHouseConnectionParamsConfig

	chSink component.Component

	// second sink for mixed-batch scenario
	chSinkB         component.Component
	streamConfigB   jetstream.StreamConfig
	dlqStreamCfgB   jetstream.StreamConfig
	consumerConfigB jetstream.ConsumerConfig
	pipelineConfigB *models.PipelineConfig
	configStoreB    configs.ConfigStoreInterface
	errChB          chan error
	wgB             sync.WaitGroup

	metricsReader *sdkmetric.ManualReader

	// chProxy is an optional TCP gate proxy that sits between the sink and CH.
	// Set up by iSetUpMetricsCollection for retryable scenarios.
	chProxy  *testutils.CHGateProxy
	chProxyB *testutils.CHGateProxy
}

func NewSinkTestSuite() *SinkTestSuite {
	return &SinkTestSuite{ //nolint:exhaustruct // optional config
		BaseTestSuite: BaseTestSuite{ //nolint:exhaustruct // optional config
			suiteName: "sink",
			wg:        sync.WaitGroup{},
		},
	}
}

func (s *SinkTestSuite) SetupResources() error {
	var errs []error
	err := s.setupNATS()
	if err != nil {
		errs = append(errs, fmt.Errorf("setup NATS: %w", err))
	}
	err = s.setupCH()
	if err != nil {
		errs = append(errs, fmt.Errorf("setup ClickHouse container: %w", err))
	}

	// Setup Postgres for storing pipeline configs
	if s.postgresContainer == nil {
		err := s.setupPostgres()
		if err != nil {
			errs = append(errs, fmt.Errorf("setup postgres: %w", err))
		}
	}

	// Create pipeline store
	if s.pipelineStore == nil {
		db, err := storage.NewPipelineStore(context.Background(), s.postgresContainer.GetDSN(), testutils.NewTestLogger(), nil, internal.RoleSink)
		if err != nil {
			errs = append(errs, fmt.Errorf("create pipeline store: %w", err))
		}
		s.pipelineStore = db
	}

	err = testutils.CombineErrors(errs)
	if err != nil {
		return fmt.Errorf("setup errors: %w", err)
	}

	return nil
}

func (s *SinkTestSuite) aStreamConsumerConfig(data *godog.DocString) error {
	type config struct {
		StreamName   string `json:"stream"`
		SubjectName  string `json:"subject"`
		ConsumerName string `json:"consumer"`
		AckWait      string `json:"ack_wait"`
		MaxDeliver   int    `json:"max_deliver"`
	}
	var cfg config
	err := json.Unmarshal([]byte(data.Content), &cfg)
	if err != nil {
		return fmt.Errorf("unmarshal stream consumer config: %w", err)
	}

	s.streamConfig = jetstream.StreamConfig{
		Name:     cfg.StreamName,
		Subjects: []string{cfg.SubjectName},
	}

	ackWait := internal.NatsDefaultAckWait
	if cfg.AckWait != "" {
		ackWait, err = time.ParseDuration(cfg.AckWait)
		if err != nil {
			return fmt.Errorf("parse ack_wait: %w", err)
		}
	}

	maxDeliver := internal.NatsConsumerMaxDeliver
	if cfg.MaxDeliver > 0 {
		maxDeliver = cfg.MaxDeliver
	}

	s.consumerConfig = jetstream.ConsumerConfig{
		Name:          cfg.ConsumerName,
		Durable:       cfg.ConsumerName,
		FilterSubject: cfg.SubjectName,
		AckWait:       ackWait,
		MaxDeliver:    maxDeliver,
		AckPolicy:     jetstream.AckExplicitPolicy,
	}

	return nil
}

func (s *SinkTestSuite) aRunningNATSJetStream(streamName, subjectName string) error {
	streamConfig := jetstream.StreamConfig{Name: streamName, Subjects: []string{subjectName}}
	err := s.createStream(streamConfig, 0)
	if err != nil {
		return fmt.Errorf("create nats stream: %w", err)
	}

	s.streamName = streamName
	s.streamConfig = streamConfig

	// Create DLQ stream with different name and subject
	s.dlqStreamCfg = jetstream.StreamConfig{
		Name:     streamName + "_dlq",
		Subjects: []string{"failed"},
	}

	err = s.createStream(s.dlqStreamCfg, 0)
	if err != nil {
		return fmt.Errorf("create nats DLQ stream: %w", err)
	}

	return nil
}

func (s *SinkTestSuite) aClickHouseClientWithConfig(dbName, tableName string) error {
	chPort, err := s.chContainer.GetPort()
	if err != nil {
		return fmt.Errorf("get clickhouse port: %w", err)
	}

	s.clickhouseConn = models.ClickHouseConnectionParamsConfig{
		Host:     "localhost",
		Port:     chPort,
		Username: "default",
		Password: "default",
		Database: dbName,
		Secure:   false,
	}

	return nil
}

type clickhouseConstraint struct {
	columnName string
	expression string
}

type clickhouseConstraints []clickhouseConstraint

func (constraints clickhouseConstraints) string() string {
	if len(constraints) == 0 {
		return ""
	}

	result := ""
	for _, constraint := range constraints {
		if constraint.expression != "" {
			result += fmt.Sprintf(", CONSTRAINT constraint_%s CHECK %s", constraint.columnName, constraint.expression)
		}
	}

	return result
}

func (s *SinkTestSuite) theClickHouseTableAlreadyExistsWithSchema(tableName string, schema *godog.Table) error {
	conn, err := s.chContainer.GetConnection()
	if err != nil {
		return fmt.Errorf("get clickhouse connection: %w", err)
	}

	defer conn.Close()

	constraints := clickhouseConstraints{}
	columns := make([]string, 0, len(schema.Rows)-1)
	for i, row := range schema.Rows {
		if i == 0 {
			continue
		}

		if len(row.Cells) < 2 {
			return fmt.Errorf("invalid schema row: %v", row)
		}

		columns = append(columns, fmt.Sprintf("%s %s", row.Cells[0].Value, row.Cells[1].Value))

		if len(row.Cells) >= 3 {
			constraints = append(constraints, clickhouseConstraint{
				columnName: row.Cells[0].Value,
				expression: row.Cells[2].Value,
			})
		}
	}

	dropQuery := fmt.Sprintf("DROP TABLE IF EXISTS %s", tableName)
	if err = conn.Exec(context.Background(), dropQuery); err != nil {
		return fmt.Errorf("drop table: %w", err)
	}

	query := fmt.Sprintf(
		"CREATE TABLE %s (%s %s) ENGINE = Memory",
		tableName,
		strings.Join(columns, ", "),
		constraints.string(),
	)
	err = conn.Exec(context.Background(), query)
	if err != nil {
		return fmt.Errorf("create table: %w", err)
	}

	s.tableName = tableName

	return nil
}

func (s *SinkTestSuite) aPipelineConfig(cfg *godog.DocString) error {
	var pc models.PipelineConfig

	err := json.Unmarshal([]byte(cfg.Content), &pc)
	if err != nil {
		return fmt.Errorf("unmarshal pipeline config: %w", err)
	}

	// Delete any leftover pipeline from a previous run (container reuse).
	_ = s.pipelineStore.DeletePipeline(context.Background(), pc.ID)

	// Store pipeline config in database to create schema versions and sink configs
	err = s.pipelineStore.InsertPipeline(context.Background(), pc)
	if err != nil {
		return fmt.Errorf("insert pipeline: %w", err)
	}

	// Set sink config from pipeline, merging only runtime-only connection
	// fields from the testcontainer. Database and Table come from the JSON
	// so scenarios can point at non-existent tables explicitly.
	s.pipelineConfig = &pc
	host, port := s.clickhouseConn.Host, s.clickhouseConn.Port
	if s.chProxy != nil {
		host, port = "127.0.0.1", s.chProxy.Port()
	}
	s.pipelineConfig.Sink.ClickHouseConnectionParams.Host = host
	s.pipelineConfig.Sink.ClickHouseConnectionParams.Port = port
	s.pipelineConfig.Sink.ClickHouseConnectionParams.Username = s.clickhouseConn.Username
	s.pipelineConfig.Sink.ClickHouseConnectionParams.Password = s.clickhouseConn.Password

	// Create config store for retrieving sink configs by schema version
	s.configStore = configs.NewConfigStore(s.pipelineStore, pc.ID, pc.Sink.SourceID)

	return nil
}

func (s *SinkTestSuite) iPublishEventsToTheStream(count int, data *godog.Table) error {
	return s.publishEvents(count, data, s.streamConfig.Subjects[0])
}

func (s *SinkTestSuite) iRunClickHouseSink() error {
	streamConsumer, err := stream.NewNATSConsumer(context.Background(), s.natsClient.JetStream(), s.consumerConfig, s.streamConfig.Name)
	if err != nil {
		return fmt.Errorf("create stream consumer: %w", err)
	}

	logger := testutils.NewTestLogger()

	dlqStreamPublisher := stream.NewNATSPublisher(
		s.natsClient.JetStream(),
		stream.PublisherConfig{
			Subject: s.dlqStreamCfg.Subjects[0],
		},
	)

	kafkaMapper := mapper.NewKafkaToClickHouseMapper()
	cfgStore := s.configStore.(*configs.ConfigStore)
	sink, err := component.NewSinkComponent(
		s.pipelineConfig.Sink,
		streamConsumer,
		kafkaMapper,
		cfgStore,
		make(chan struct{}),
		logger,
		dlqStreamPublisher,
		"",
	)
	if err != nil {
		return fmt.Errorf("create ClickHouse sink: %w", err)
	}
	s.chSink = sink

	s.errCh = make(chan error, 1)

	s.wg.Go(func() {
		s.chSink.Start(context.Background(), s.errCh)
	})

	return nil
}

func (s *SinkTestSuite) iStopClickHouseSinkGracefully() error {
	s.stopComponent(s.chSink.Stop, true)
	err := s.checkComponentErrors()
	if err != nil {
		return fmt.Errorf("error from sink: %w", err)
	}

	return nil
}

func (s *SinkTestSuite) iStopClickHouseSinkAfterDelay(delay string) error {
	dur, err := time.ParseDuration(delay)
	if err != nil {
		return fmt.Errorf("parse duration: %w", err)
	}

	s.stopComponent(s.chSink.Stop, false, dur)

	err = s.checkComponentErrors()
	if err != nil {
		return fmt.Errorf("error from sink: %w", err)
	}

	s.chSink = nil

	return nil
}

func (s *SinkTestSuite) theClickHouseTableShouldContainRows(tableName string, count int) error {
	err := s.clickhouseShouldContainNumberOfRows(tableName, count)
	if err != nil {
		return fmt.Errorf("check clickhouse table %s: %w", tableName, err)
	}

	return nil
}

func (s *SinkTestSuite) cleanNatsStream() error {
	err := s.deleteStream(s.streamName)
	if err != nil {
		return fmt.Errorf("delete nats stream: %w", err)
	}

	if s.dlqStreamCfg.Name != "" {
		err = s.deleteStream(s.dlqStreamCfg.Name)
		if err != nil {
			return fmt.Errorf("delete nats DLQ stream: %w", err)
		}
	}

	return nil
}

func (s *SinkTestSuite) cleanClickHouseTable() error {
	conn, err := s.chContainer.GetConnection()
	if err != nil {
		return fmt.Errorf("get clickhouse connection: %w", err)
	}
	defer conn.Close()

	query := "DROP TABLE IF EXISTS " + s.tableName
	err = conn.Exec(context.Background(), query)
	if err != nil {
		return fmt.Errorf("drop table %s: %w", s.tableName, err)
	}
	return nil
}

func (s *SinkTestSuite) fastCleanUp() error {
	var errs []error

	// Ensure CH writes are restored so it can accept connections for table cleanup.
	_ = s.chContainer.Unpause(context.Background())
	_ = s.chContainer.RestoreWrites(context.Background())

	// Unblock and stop proxies if active.
	if s.chProxy != nil {
		s.chProxy.Unblock()
		s.chProxy.Stop()
		s.chProxy = nil
	}
	if s.chProxyB != nil {
		s.chProxyB.Unblock()
		s.chProxyB.Stop()
		s.chProxyB = nil
	}

	if s.chSink != nil {
		s.chSink.Stop(component.WithNoWait(true))
		s.chSink = nil
	}

	if s.chSinkB != nil {
		s.chSinkB.Stop(component.WithNoWait(true))
		s.wgB.Wait()
		s.chSinkB = nil
	}

	if s.chContainer != nil && s.tableName != "" {
		err := s.cleanClickHouseTable()
		if err != nil {
			errs = append(errs, fmt.Errorf("close ClickHouse client: %w", err))
		}
	}

	if s.natsContainer != nil && s.streamName != "" {
		err := s.cleanNatsStream()
		if err != nil {
			errs = append(errs, fmt.Errorf("close NATS client: %w", err))
		}
	}

	if s.natsContainer != nil && s.streamConfigB.Name != "" {
		if err := s.deleteStream(s.streamConfigB.Name); err != nil {
			errs = append(errs, fmt.Errorf("delete second nats stream: %w", err))
		}
		if s.dlqStreamCfgB.Name != "" {
			if err := s.deleteStream(s.dlqStreamCfgB.Name); err != nil {
				errs = append(errs, fmt.Errorf("delete second nats DLQ stream: %w", err))
			}
		}
		s.streamConfigB = jetstream.StreamConfig{}
		s.dlqStreamCfgB = jetstream.StreamConfig{}
	}

	// Clean up pipelines from database
	if s.pipelineConfig != nil {
		if err := s.pipelineStore.DeletePipeline(context.Background(), s.pipelineConfig.ID); err != nil {
			errs = append(errs, fmt.Errorf("delete pipeline: %w", err))
		}
		s.pipelineConfig = nil
	}
	if s.pipelineConfigB != nil {
		if err := s.pipelineStore.DeletePipeline(context.Background(), s.pipelineConfigB.ID); err != nil {
			errs = append(errs, fmt.Errorf("delete second pipeline: %w", err))
		}
		s.pipelineConfigB = nil
	}

	// Reset metrics reader so each scenario gets a fresh slate.
	s.metricsReader = nil

	err := testutils.CombineErrors(errs)
	if err != nil {
		return fmt.Errorf("cleanup errors: %w", err)
	}
	return nil
}

func (s *SinkTestSuite) CleanupResources() error {
	var errs []error

	// Close ClickHouse sink
	if s.chSink != nil {
		s.stopComponent(s.chSink.Stop, false)
		err := s.checkComponentErrors()
		if err != nil {
			errs = append(errs, fmt.Errorf("error from sink: %w", err))
		}

		s.chSink = nil
	}

	// Stop ClickHouse container
	err := s.cleanupCH()
	if err != nil {
		errs = append(errs, fmt.Errorf("cleanup ClickHouse: %w", err))
	}

	// Close NATS client
	err = s.cleanupNATS()
	if err != nil {
		errs = append(errs, fmt.Errorf("cleanup NATS: %w", err))
	}

	// Cleanup Postgres
	if err := s.cleanupPostgres(); err != nil {
		errs = append(errs, fmt.Errorf("cleanup postgres: %w", err))
	}

	err = testutils.CombineErrors(errs)
	if err != nil {
		return fmt.Errorf("cleanup errors: %w", err)
	}

	return nil
}

func (s *SinkTestSuite) dlqHasNEvents(expectedCount int) error {
	return s.natsStreamSubjectHasNEvents(s.dlqStreamCfg.Name, s.dlqStreamCfg.Subjects[0], expectedCount)
}

// --- fault injection ---

func (s *SinkTestSuite) iDisruptClickHouseWrites() error {
	if s.chProxy != nil {
		s.chProxy.Block()
		return nil
	}
	if err := s.chContainer.DisruptWrites(context.Background()); err != nil {
		return fmt.Errorf("disrupt clickhouse writes: %w", err)
	}
	return nil
}

func (s *SinkTestSuite) iRestoreClickHouseWrites() error {
	if s.chProxy != nil {
		s.chProxy.Unblock()
		return nil
	}
	if err := s.chContainer.RestoreWrites(context.Background()); err != nil {
		return fmt.Errorf("restore clickhouse writes: %w", err)
	}
	return nil
}

func (s *SinkTestSuite) iDisruptClickHouseWritesFor(duration string) error {
	dur, err := time.ParseDuration(duration)
	if err != nil {
		return fmt.Errorf("parse duration: %w", err)
	}
	if err := s.iDisruptClickHouseWrites(); err != nil {
		return err
	}
	time.Sleep(dur)
	return s.iRestoreClickHouseWrites()
}

// iDisruptAndScheduleRestore blocks the CH proxy immediately and spawns a goroutine to
// unblock after the given duration. The step returns immediately so the test can
// continue publishing events while CH writes are being rejected.
func (s *SinkTestSuite) iDisruptAndScheduleRestore(duration string) error {
	dur, err := time.ParseDuration(duration)
	if err != nil {
		return fmt.Errorf("parse duration: %w", err)
	}
	if err := s.iDisruptClickHouseWrites(); err != nil {
		return err
	}
	s.wg.Go(func() {
		time.Sleep(dur)
		_ = s.iRestoreClickHouseWrites()
	})
	return nil
}

// --- metrics setup & assertions ---

func (s *SinkTestSuite) iSetUpMetricsCollection() error {
	s.metricsReader = observability.InitMetricsForTesting()

	// Start a TCP gate proxy so retryable scenarios can disrupt the sink's
	// CH connection without needing admin privileges inside the CH container.
	proxy, err := testutils.NewCHGateProxy(s.clickhouseConn.Host, s.clickhouseConn.Port)
	if err != nil {
		return fmt.Errorf("start ch proxy: %w", err)
	}
	s.chProxy = proxy

	proxyB, err := testutils.NewCHGateProxy(s.clickhouseConn.Host, s.clickhouseConn.Port)
	if err != nil {
		return fmt.Errorf("start ch proxy B: %w", err)
	}
	s.chProxyB = proxyB

	return nil
}

func (s *SinkTestSuite) collectMetricSum(metricName string) (int64, error) {
	var rm metricdata.ResourceMetrics
	if err := s.metricsReader.Collect(context.Background(), &rm); err != nil {
		return 0, fmt.Errorf("collect metrics: %w", err)
	}
	for _, sm := range rm.ScopeMetrics {
		for _, m := range sm.Metrics {
			if m.Name != metricName {
				continue
			}
			switch data := m.Data.(type) {
			case metricdata.Sum[int64]:
				var total int64
				for _, dp := range data.DataPoints {
					total += dp.Value
				}
				return total, nil
			}
		}
	}
	return 0, nil
}

func (s *SinkTestSuite) collectMetricSumByLabel(metricName, labelKey, labelVal string) (int64, error) {
	var rm metricdata.ResourceMetrics
	if err := s.metricsReader.Collect(context.Background(), &rm); err != nil {
		return 0, fmt.Errorf("collect metrics: %w", err)
	}
	for _, sm := range rm.ScopeMetrics {
		for _, m := range sm.Metrics {
			if m.Name != metricName {
				continue
			}
			switch data := m.Data.(type) {
			case metricdata.Sum[int64]:
				var total int64
				for _, dp := range data.DataPoints {
					for _, attr := range dp.Attributes.ToSlice() {
						if string(attr.Key) == labelKey && attr.Value.AsString() == labelVal {
							total += dp.Value
							break
						}
					}
				}
				return total, nil
			}
		}
	}
	return 0, nil
}

func (s *SinkTestSuite) theSinkNackMetricShouldBeGreaterThanZero() error {
	val, err := s.collectMetricSum(observability.GfMetricPrefix + "_sink_nack_messages_total")
	if err != nil {
		return err
	}
	if val <= 0 {
		return fmt.Errorf("expected gfm_sink_nack_messages_total > 0, got %d", val)
	}
	return nil
}

func (s *SinkTestSuite) theSinkNackMetricShouldBeZero() error {
	val, err := s.collectMetricSum(observability.GfMetricPrefix + "_sink_nack_messages_total")
	if err != nil {
		return err
	}
	if val != 0 {
		return fmt.Errorf("expected gfm_sink_nack_messages_total == 0, got %d", val)
	}
	return nil
}

func (s *SinkTestSuite) theSinkRetryableErrorMetricShouldBeGreaterThanZero() error {
	val, err := s.collectMetricSumByLabel(
		observability.GfMetricPrefix+"_sink_errors_by_classification_total",
		"classification", "retryable",
	)
	if err != nil {
		return err
	}
	if val <= 0 {
		return fmt.Errorf("expected gfm_sink_errors_by_classification_total{classification=retryable} > 0, got %d", val)
	}
	return nil
}

// --- NATS stream state assertions ---

func (s *SinkTestSuite) theNATSStreamShouldStillContainMessages(expected int) error {
	info, err := s.natsClient.JetStream().Stream(context.Background(), s.streamConfig.Name)
	if err != nil {
		return fmt.Errorf("get stream info: %w", err)
	}
	si, err := info.Info(context.Background())
	if err != nil {
		return fmt.Errorf("stream info: %w", err)
	}
	if si.State.Msgs != uint64(expected) {
		return fmt.Errorf("expected %d messages in stream, got %d", expected, si.State.Msgs)
	}
	return nil
}

func (s *SinkTestSuite) waitUntilAllMessagesProcessedWithTimeout(timeoutStr string) error {
	dur, err := time.ParseDuration(timeoutStr)
	if err != nil {
		return fmt.Errorf("parse timeout: %w", err)
	}
	return s.waitForConsumerIdle(s.consumerConfig.Name, s.streamConfig.Name, dur)
}

func (s *SinkTestSuite) waitForConsumerIdle(consumerName, streamName string, timeout time.Duration) error {
	consumer, err := s.natsClient.JetStream().Consumer(context.Background(), streamName, consumerName)
	if err != nil {
		return fmt.Errorf("get consumer: %w", err)
	}

	ticker := time.NewTicker(100 * time.Millisecond)
	defer ticker.Stop()
	deadline := time.After(timeout)

	// NakWithDelay puts messages in a transient limbo where NumPending and
	// NumAckPending are both 0 even though redelivery is pending. We require the
	// idle condition to hold for longer than NatsConsumerNakDelay (5s) to avoid
	// a false positive during the redelivery window.
	const stabilisationWindow = 6 * time.Second
	var idleSince time.Time

	for {
		select {
		case <-deadline:
			info, _ := consumer.Info(context.Background())
			return fmt.Errorf("timeout waiting for consumer to go idle (timeout=%s), NumPending=%d NumAckPending=%d",
				timeout, info.NumPending, info.NumAckPending)
		case <-ticker.C:
			info, err := consumer.Info(context.Background())
			if err != nil {
				return fmt.Errorf("get consumer info: %w", err)
			}
			if info.NumPending == 0 && info.NumAckPending == 0 {
				if idleSince.IsZero() {
					idleSince = time.Now()
				} else if time.Since(idleSince) >= stabilisationWindow {
					return nil
				}
			} else {
				idleSince = time.Time{} // reset
			}
		}
	}
}

// waitUntilCHTableHasRows polls ClickHouse until the given table reaches expectedCount rows
// or the timeout expires. This is more reliable than NATS consumer-info polling for retryable
// scenarios where NakWithDelay puts messages in a transient limbo that looks idle.
func (s *SinkTestSuite) waitUntilCHTableHasRows(tableNameWithDB string, expectedCount int, timeoutStr string) error {
	dur, err := time.ParseDuration(timeoutStr)
	if err != nil {
		return fmt.Errorf("parse timeout: %w", err)
	}
	conn, err := s.chContainer.GetConnection()
	if err != nil {
		return fmt.Errorf("get ch connection: %w", err)
	}
	defer conn.Close()

	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()
	deadline := time.After(dur)

	for {
		select {
		case <-deadline:
			return fmt.Errorf("timeout waiting for %s to have %d rows", tableNameWithDB, expectedCount)
		case <-ticker.C:
			var count uint64
			if err := conn.QueryRow(context.Background(),
				fmt.Sprintf("SELECT count() FROM %s", tableNameWithDB),
			).Scan(&count); err != nil {
				continue // CH might be temporarily unavailable
			}
			if int(count) >= expectedCount {
				return nil
			}
		}
	}
}

// --- second sink for mixed-batch scenario ---

func (s *SinkTestSuite) aSecondRunningNATSStream(streamName, subjectName string) error {
	streamConfig := jetstream.StreamConfig{Name: streamName, Subjects: []string{subjectName}}
	if err := s.createStream(streamConfig, 0); err != nil {
		return fmt.Errorf("create second nats stream: %w", err)
	}
	s.streamConfigB = streamConfig
	s.dlqStreamCfgB = jetstream.StreamConfig{
		Name:     streamName + "_dlq",
		Subjects: []string{"failed_b"},
	}
	if err := s.createStream(s.dlqStreamCfgB, 0); err != nil {
		return fmt.Errorf("create second nats DLQ stream: %w", err)
	}
	return nil
}

func (s *SinkTestSuite) aSecondStreamConsumerConfig(consumerName string) error {
	s.consumerConfigB = jetstream.ConsumerConfig{
		Name:          consumerName,
		Durable:       consumerName,
		FilterSubject: s.streamConfigB.Subjects[0],
		AckWait:       internal.NatsDefaultAckWait,
		AckPolicy:     jetstream.AckExplicitPolicy,
	}
	return nil
}

func (s *SinkTestSuite) aSecondPipelineConfig(cfg *godog.DocString) error {
	var pc models.PipelineConfig
	if err := json.Unmarshal([]byte(cfg.Content), &pc); err != nil {
		return fmt.Errorf("unmarshal second pipeline config: %w", err)
	}
	_ = s.pipelineStore.DeletePipeline(context.Background(), pc.ID)
	if err := s.pipelineStore.InsertPipeline(context.Background(), pc); err != nil {
		return fmt.Errorf("insert second pipeline: %w", err)
	}
	s.pipelineConfigB = &pc
	hostB, portB := s.clickhouseConn.Host, s.clickhouseConn.Port
	if s.chProxyB != nil {
		hostB, portB = "127.0.0.1", s.chProxyB.Port()
	}
	s.pipelineConfigB.Sink.ClickHouseConnectionParams.Host = hostB
	s.pipelineConfigB.Sink.ClickHouseConnectionParams.Port = portB
	s.pipelineConfigB.Sink.ClickHouseConnectionParams.Username = s.clickhouseConn.Username
	s.pipelineConfigB.Sink.ClickHouseConnectionParams.Password = s.clickhouseConn.Password
	s.configStoreB = configs.NewConfigStore(s.pipelineStore, pc.ID, pc.Sink.SourceID)
	return nil
}

func (s *SinkTestSuite) iPublishEventsToSecondStream(count int, data *godog.Table) error {
	return s.publishEvents(count, data, s.streamConfigB.Subjects[0])
}

func (s *SinkTestSuite) iRunSecondClickHouseSink() error {
	streamConsumer, err := stream.NewNATSConsumer(context.Background(), s.natsClient.JetStream(), s.consumerConfigB, s.streamConfigB.Name)
	if err != nil {
		return fmt.Errorf("create second stream consumer: %w", err)
	}
	logger := testutils.NewTestLogger()
	dlqPublisher := stream.NewNATSPublisher(s.natsClient.JetStream(), stream.PublisherConfig{
		Subject: s.dlqStreamCfgB.Subjects[0],
	})
	cfgStore := s.configStoreB.(*configs.ConfigStore)
	sink, err := component.NewSinkComponent(
		s.pipelineConfigB.Sink,
		streamConsumer,
		mapper.NewKafkaToClickHouseMapper(),
		cfgStore,
		make(chan struct{}),
		logger,
		dlqPublisher,
		"",
	)
	if err != nil {
		return fmt.Errorf("create second ClickHouse sink: %w", err)
	}
	s.chSinkB = sink
	s.errChB = make(chan error, 1)
	s.wgB.Go(func() {
		s.chSinkB.Start(context.Background(), s.errChB)
	})
	return nil
}

func (s *SinkTestSuite) iGracefullyStopSecondClickHouseSink() error {
	s.chSinkB.Stop()
	s.wgB.Wait()
	if len(s.errChB) > 0 {
		return fmt.Errorf("error from second sink: %w", <-s.errChB)
	}
	return nil
}

func (s *SinkTestSuite) waitUntilAllMessagesOnSecondSinkProcessed() error {
	return s.waitForConsumerIdle(s.consumerConfigB.Name, s.streamConfigB.Name, 30*time.Second)
}

func (s *SinkTestSuite) dlqBHasNEvents(expectedCount int) error {
	return s.natsStreamSubjectHasNEvents(s.dlqStreamCfgB.Name, s.dlqStreamCfgB.Subjects[0], expectedCount)
}

func (s *SinkTestSuite) allMessagesAreProcessed() error {
	consumerName := s.consumerConfig.Name
	streamName := s.streamConfig.Name

	consumer, err := s.natsClient.JetStream().Consumer(context.Background(), streamName, consumerName)
	if err != nil {
		return fmt.Errorf("get consumer: %w", err)
	}

	ticker := time.NewTicker(10 * time.Millisecond)
	defer ticker.Stop()

	timeout := time.After(30 * time.Second)

	for {
		select {
		case <-timeout:
			consumerInfo, _ := consumer.Info(context.Background())
			return fmt.Errorf("timeout waiting for messages to be processed, NumPending: %d, NumAckPending: %d", consumerInfo.NumPending, consumerInfo.NumAckPending)
		case <-ticker.C:
			consumerInfo, err := consumer.Info(context.Background())
			if err != nil {
				return fmt.Errorf("get consumer info: %w", err)
			}

			// Check if all messages have been processed
			if consumerInfo.NumPending == 0 && consumerInfo.NumAckPending == 0 {
				return nil
			}
		}
	}
}

func (s *SinkTestSuite) RegisterSteps(sc *godog.ScenarioContext) {
	logElapsedTime(sc)
	sc.Step(`^a running NATS stream "([^"]*)" with subject "([^"]*)"$`, s.aRunningNATSJetStream)
	sc.Step(`^a stream consumer with config$`, s.aStreamConsumerConfig)
	sc.Step(`^a ClickHouse client with db "([^"]*)" and table "([^"]*)"$`, s.aClickHouseClientWithConfig)
	sc.Step(`^the ClickHouse table "([^"]*)" already exists with schema$`, s.theClickHouseTableAlreadyExistsWithSchema)
	sc.Step(`^a pipeline with configuration$`, s.aPipelineConfig)
	sc.Step(`^I publish (\d+) events to the stream$`, s.iPublishEventsToTheStream)
	sc.Step(`^I run ClickHouse sink`, s.iRunClickHouseSink)
	sc.Step(`^I stop ClickHouse sink after "([^"]*)"$`, s.iStopClickHouseSinkAfterDelay)
	sc.Step(`^I gracefully stop ClickHouse sink$`, s.iStopClickHouseSinkGracefully)
	sc.Step(`^the ClickHouse table "([^"]*)" should contain (\d+) rows$`, s.theClickHouseTableShouldContainRows)
	sc.Step(`^dlq should contain (\d+) events$`, s.dlqHasNEvents)
	sc.Step(`^Wait until all messages are processed$`, s.allMessagesAreProcessed)

	// fault injection — quota-based write disruption (immediate error, no TCP freeze)
	sc.Step(`^I disrupt ClickHouse writes$`, s.iDisruptClickHouseWrites)
	sc.Step(`^I restore ClickHouse writes$`, s.iRestoreClickHouseWrites)
	sc.Step(`^I disrupt ClickHouse writes for "([^"]*)"$`, s.iDisruptClickHouseWritesFor)
	sc.Step(`^I disrupt ClickHouse writes and schedule restore after "([^"]*)"$`, s.iDisruptAndScheduleRestore)
	// legacy docker-pause steps kept for backward compatibility
	sc.Step(`^I pause the ClickHouse container$`, s.iDisruptClickHouseWrites)
	sc.Step(`^I unpause the ClickHouse container$`, s.iRestoreClickHouseWrites)
	sc.Step(`^I pause the ClickHouse container and schedule unpause after "([^"]*)"$`, s.iDisruptAndScheduleRestore)

	// metrics
	sc.Step(`^I set up metrics collection$`, s.iSetUpMetricsCollection)
	sc.Step(`^the sink nack metric should be greater than 0$`, s.theSinkNackMetricShouldBeGreaterThanZero)
	sc.Step(`^the sink nack metric should be 0$`, s.theSinkNackMetricShouldBeZero)
	sc.Step(`^the sink retryable error metric should be greater than 0$`, s.theSinkRetryableErrorMetricShouldBeGreaterThanZero)

	// NATS stream state
	sc.Step(`^the NATS stream should still contain (\d+) messages$`, s.theNATSStreamShouldStillContainMessages)
	sc.Step(`^Wait until all messages are processed with timeout "([^"]*)"$`, s.waitUntilAllMessagesProcessedWithTimeout)
	sc.Step(`^Wait until ClickHouse table "([^"]*)" has (\d+) rows with timeout "([^"]*)"$`, s.waitUntilCHTableHasRows)

	// second sink (mixed-batch scenario)
	sc.Step(`^a second running NATS stream "([^"]*)" with subject "([^"]*)"$`, s.aSecondRunningNATSStream)
	sc.Step(`^a second stream consumer "([^"]*)"$`, s.aSecondStreamConsumerConfig)
	sc.Step(`^a second pipeline with configuration$`, s.aSecondPipelineConfig)
	sc.Step(`^I publish (\d+) events to the second stream$`, s.iPublishEventsToSecondStream)
	sc.Step(`^I run second ClickHouse sink$`, s.iRunSecondClickHouseSink)
	sc.Step(`^I gracefully stop second ClickHouse sink$`, s.iGracefullyStopSecondClickHouseSink)
	sc.Step(`^Wait until all messages on second sink are processed$`, s.waitUntilAllMessagesOnSecondSinkProcessed)
	sc.Step(`^second dlq should contain (\d+) events$`, s.dlqBHasNEvents)

	sc.After(func(ctx context.Context, _ *godog.Scenario, _ error) (context.Context, error) {
		cleanupErr := s.fastCleanUp()
		if cleanupErr != nil {
			return ctx, cleanupErr
		}
		return ctx, nil
	})
}
