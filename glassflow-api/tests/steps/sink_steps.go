package steps

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/cucumber/godog"
	"github.com/nats-io/nats.go/jetstream"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/component"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/configs"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/mapper"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/service"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/storage"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/stream"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/tests/testutils"
)

type SinkTestSuite struct {
	BaseTestSuite

	streamName string
	tablename  string

	dlqStreamCfg jetstream.StreamConfig

	streamConfig   jetstream.StreamConfig
	consumerConfig jetstream.ConsumerConfig

	pipelineConfig *models.PipelineConfig
	pipelineStore  service.PipelineStore
	configStore    configs.ConfigStoreInterface

	clickhouseConn models.ClickHouseConnectionParamsConfig

	chSink component.Component
}

func NewSinkTestSuite() *SinkTestSuite {
	return &SinkTestSuite{ //nolint:exhaustruct // optional config
		BaseTestSuite: BaseTestSuite{ //nolint:exhaustruct // optional config
			wg: sync.WaitGroup{},
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

	s.consumerConfig = jetstream.ConsumerConfig{
		Name:          cfg.ConsumerName,
		Durable:       cfg.ConsumerName,
		FilterSubject: cfg.SubjectName,
		AckWait:       internal.NatsDefaultAckWait,
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

	s.tablename = dbName + "." + tableName

	s.clickhouseConn = models.ClickHouseConnectionParamsConfig{
		Host:     "localhost",
		Port:     chPort,
		Username: "default",
		Password: base64.StdEncoding.EncodeToString([]byte("default")),
		Database: dbName,
		Table:    tableName,
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

	query := fmt.Sprintf(
		"CREATE TABLE IF NOT EXISTS %s (%s %s) ENGINE = Memory",
		tableName,
		strings.Join(columns, ", "),
		constraints.string(),
	)
	err = conn.Exec(context.Background(), query)
	if err != nil {
		return fmt.Errorf("create table: %w", err)
	}

	return nil
}

func (s *SinkTestSuite) aPipelineConfig(cfg *godog.DocString) error {
	var pc models.PipelineConfig

	err := json.Unmarshal([]byte(cfg.Content), &pc)
	if err != nil {
		return fmt.Errorf("unmarshal pipeline config: %w", err)
	}

	// Store pipeline config in database to create schema versions and sink configs
	err = s.pipelineStore.InsertPipeline(context.Background(), pc)
	if err != nil {
		return fmt.Errorf("insert pipeline: %w", err)
	}

	// Set sink config from pipeline
	s.pipelineConfig = &pc
	s.pipelineConfig.Sink.ClickHouseConnectionParams = s.clickhouseConn

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

	kafkaMapper := mapper.NewKafkaToClickHouseMapper(s.pipelineConfig.Sink.Config)
	cfgStore := s.configStore.(*configs.ConfigStore)
	sink, err := component.NewSinkComponent(
		s.pipelineConfig.Sink,
		streamConsumer,
		kafkaMapper,
		cfgStore,
		make(chan struct{}),
		logger,
		nil, // nil meter for e2e tests
		dlqStreamPublisher,
		"",
	)
	if err != nil {
		return fmt.Errorf("create ClickHouse sink: %w", err)
	}
	s.chSink = sink

	s.errCh = make(chan error, 1)

	s.wg.Add(1)
	go func() {
		defer s.wg.Done()
		s.chSink.Start(context.Background(), s.errCh)
	}()

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

	return nil
}

func (s *SinkTestSuite) cleanClickHouseTable() error {
	conn, err := s.chContainer.GetConnection()
	if err != nil {
		return fmt.Errorf("get clickhouse connection: %w", err)
	}
	defer conn.Close()

	tableName := "default.events_test"

	query := "DROP TABLE IF EXISTS " + tableName
	err = conn.Exec(context.Background(), query)
	if err != nil {
		return fmt.Errorf("drop table %s: %w", tableName, err)
	}
	return nil
}

func (s *SinkTestSuite) fastCleanUp() error {
	var errs []error

	if s.chSink != nil {
		s.chSink.Stop(component.WithNoWait(true))
	}

	if s.chContainer != nil && s.tablename != "" {
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

	// Clean up pipeline from database
	if s.pipelineConfig != nil {
		err := s.pipelineStore.DeletePipeline(context.Background(), s.pipelineConfig.ID)
		if err != nil {
			errs = append(errs, fmt.Errorf("delete pipeline: %w", err))
		}
	}

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
	sc.Step(`^Wait until all messages are processed`, s.allMessagesAreProcessed)
	sc.After(func(ctx context.Context, _ *godog.Scenario, _ error) (context.Context, error) {
		cleanupErr := s.fastCleanUp()
		if cleanupErr != nil {
			return ctx, cleanupErr
		}
		return ctx, nil
	})
}
