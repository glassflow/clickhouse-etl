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
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/component"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/schema"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/sink"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/stream"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/tests/testutils"
)

type SinkTestSuite struct {
	BaseTestSuite

	streamName string
	tablename  string

	dlqStreamCfg *stream.ConsumerConfig
	streamConfig *stream.ConsumerConfig
	schemaConfig models.MapperConfig
	sinkConfig   models.SinkComponentConfig
	CHSink       Component
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

	ackWaitDuration, err := time.ParseDuration(cfg.AckWait)
	if err != nil {
		return fmt.Errorf("parse ack time: %w", err)
	}

	s.streamConfig = &stream.ConsumerConfig{
		NatsStream:    cfg.StreamName,
		NatsConsumer:  cfg.ConsumerName,
		NatsSubject:   cfg.SubjectName,
		AckWait:       ackWaitDuration,
		ExpireTimeout: streamConsumerExpireTimeout,
	}
	return nil
}

func (s *SinkTestSuite) aRunningNATSJetStream(streamName, subjectName string) error {
	err := s.createStream(streamName, subjectName, 0)
	if err != nil {
		return fmt.Errorf("create nats stream: %w", err)
	}

	s.streamName = streamName

	s.dlqStreamCfg = &stream.ConsumerConfig{
		NatsStream:  streamName + "_dlq",
		NatsSubject: subjectName + ".failed",
	}

	err = s.createStream(
		s.dlqStreamCfg.NatsStream,
		s.dlqStreamCfg.NatsSubject,
		0,
	)
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

	s.sinkConfig.ClickHouseConnectionParams = models.ClickHouseConnectionParamsConfig{
		Host:     "localhost",
		Port:     chPort,
		Username: "default",
		Password: base64.StdEncoding.EncodeToString([]byte("default")),
		Database: dbName,
		Table:    tableName,
		Secure:   false,
	}

	s.sinkConfig.Type = internal.ClickHouseSinkType

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

func (s *SinkTestSuite) aBatchConfigWithMaxSize(maxSize int) error {
	batchCfg := models.BatchConfig{
		MaxBatchSize: maxSize,
	}
	s.sinkConfig.Batch = batchCfg
	return nil
}

func (s *SinkTestSuite) aBatchConfigWithMaxSizeAndDelay(maxSize int, duration string) error {
	maxDelayTime, err := time.ParseDuration(duration)
	if err != nil {
		return fmt.Errorf("parse duration: %w", err)
	}

	batchCfg := models.BatchConfig{
		MaxBatchSize: maxSize,
		MaxDelayTime: *models.NewJSONDuration(maxDelayTime),
	}
	s.sinkConfig.Batch = batchCfg
	return nil
}

func (s *SinkTestSuite) aSchemaConfigWithMapping(cfg *godog.DocString) error {
	err := s.getMappingConfig(cfg, &s.schemaConfig)
	if err != nil {
		return fmt.Errorf("unmarshal schema config: %w", err)
	}

	return nil
}

func (s *SinkTestSuite) iPublishEventsToTheStream(count int, data *godog.DocString) error {
	js := s.natsClient.JetStream()

	var events []map[string]any
	if err := json.Unmarshal([]byte(data.Content), &events); err != nil {
		return fmt.Errorf("unmarshal JSON events: %w", err)
	}

	if len(events) != count {
		return fmt.Errorf("wrong number of events in JSON data: expected %d, got %d", count, len(events))
	}

	for i := range count {
		eventBytes, err := json.Marshal(events[i])
		if err != nil {
			return fmt.Errorf("marshal event: %w", err)
		}

		_, err = js.Publish(context.Background(), s.streamConfig.NatsSubject, eventBytes)
		if err != nil {
			return fmt.Errorf("publish event: %w", err)
		}
	}

	return nil
}

func (s *SinkTestSuite) iRunClickHouseSink() error {
	streamConsumer, err := stream.NewNATSConsumer(context.Background(), s.natsClient.JetStream(), *s.streamConfig)
	if err != nil {
		return fmt.Errorf("create stream consumer: %w", err)
	}

	schemaMapper, err := schema.NewJSONToClickHouseMapper(s.schemaConfig.Streams, s.schemaConfig.SinkMapping)
	if err != nil {
		return fmt.Errorf("create schema mapper: %w", err)
	}

	logger := testutils.NewTestLogger()

	dlqStreamPublisher := stream.NewNATSPublisher(
		s.natsClient.JetStream(),
		stream.PublisherConfig{
			Subject: s.dlqStreamCfg.NatsSubject,
		},
	)

	chSink, err := sink.NewClickHouseSink(
		s.sinkConfig,
		streamConsumer,
		schemaMapper,
		logger,
		nil, // nil meter for e2e tests
		dlqStreamPublisher,
		models.ClickhouseQueryConfig{
			WaitForAsyncInsert: true,
		},
	)
	if err != nil {
		return fmt.Errorf("create sink: %w", err)
	}

	s.CHSink = chSink

	s.errCh = make(chan error, 1)

	s.wg.Add(1)
	go func() {
		defer s.wg.Done()
		err = s.CHSink.Start(context.Background())
		if err != nil {
			s.errCh <- fmt.Errorf("start ClickHouse sink: %w", err)
		}
	}()

	return nil
}

func (s *SinkTestSuite) iStopClickHouseSinkGracefully() error {
	s.stopComponent(s.CHSink.Stop, true)
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

	s.stopComponent(s.CHSink.Stop, false, dur)

	err = s.checkComponentErrors()
	if err != nil {
		return fmt.Errorf("error from sink: %w", err)
	}

	s.CHSink = nil

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

	if s.CHSink != nil {
		s.CHSink.Stop(component.WithNoWait(true))
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

	err := testutils.CombineErrors(errs)
	if err != nil {
		return fmt.Errorf("cleanup errors: %w", err)
	}
	return nil
}

func (s *SinkTestSuite) CleanupResources() error {
	var errs []error

	// Close ClickHouse sink
	if s.CHSink != nil {
		s.stopComponent(s.CHSink.Stop, false)
		err := s.checkComponentErrors()
		if err != nil {
			errs = append(errs, fmt.Errorf("error from sink: %w", err))
		}

		s.CHSink = nil
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

	err = testutils.CombineErrors(errs)
	if err != nil {
		return fmt.Errorf("cleanup errors: %w", err)
	}

	return nil
}

func (s *SinkTestSuite) dlqHasNEvents(expectedCount int) error {
	return s.natsStreamSubjectHasNEvents(s.dlqStreamCfg.NatsStream, s.dlqStreamCfg.NatsSubject, expectedCount)
}

func (s *SinkTestSuite) allMessagesAreProcessed() error {
	consumerName := s.streamConfig.NatsConsumer
	streamName := s.streamConfig.NatsStream

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
			return fmt.Errorf("timeout waiting for messages to be processed, NumPending: %d", consumerInfo.NumPending)
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
	sc.Step(`^a batch config with max size (\d+)$`, s.aBatchConfigWithMaxSize)
	sc.Step(`^a schema config with mapping$`, s.aSchemaConfigWithMapping)
	sc.Step(`^I publish (\d+) events to the stream with data$`, s.iPublishEventsToTheStream)
	sc.Step(`^I run ClickHouse sink`, s.iRunClickHouseSink)
	sc.Step(`^I stop ClickHouse sink after "([^"]*)"$`, s.iStopClickHouseSinkAfterDelay)
	sc.Step(`^I gracefully stop ClickHouse sink$`, s.iStopClickHouseSinkGracefully)
	sc.Step(`^the ClickHouse table "([^"]*)" should contain (\d+) rows$`, s.theClickHouseTableShouldContainRows)
	sc.Step(`^a batch config with max size (\d+) and delay "([^"]*)"$`, s.aBatchConfigWithMaxSizeAndDelay)
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
