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

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/client"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/operator"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/schema"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/sink"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/stream"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/tests/testutils"
)

type SinkTestSuite struct {
	natsContainer *testutils.NATSContainer
	chContainer   *testutils.ClickHouseContainer
	natsClient    *client.NATSClient

	StreamConfig *stream.ConsumerConfig
	SchemaConfig *schema.Config
	SinkConfig   sink.ClickHouseSinkConfig
	CHClient     *client.ClickHouseClient
	CHSink       *operator.SinkOperator
	wg           sync.WaitGroup
	errCh        chan error
}

func NewSinkTestSuite() *SinkTestSuite {
	return &SinkTestSuite{ //nolint:exhaustruct // optional config
		wg: sync.WaitGroup{},
	}
}

func (s *SinkTestSuite) aRunningNATSInstance() error {
	natsContainer, err := testutils.StartNATSContainer(context.Background())
	if err != nil {
		return fmt.Errorf("start nats container: %w", err)
	}

	s.natsContainer = natsContainer
	natsWrap, err := client.NewNATSWrapper(s.natsContainer.GetURI(), time.Hour)
	if err != nil {
		return fmt.Errorf("create nats wrapper: %w", err)
	}

	s.natsClient = natsWrap

	return nil
}

func (s *SinkTestSuite) aRunningCHInstance() error {
	chContainer, err := testutils.StartClickHouseContainer(context.Background())
	if err != nil {
		return fmt.Errorf("start clickhouse container: %w", err)
	}

	s.chContainer = chContainer
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

	s.StreamConfig = &stream.ConsumerConfig{
		NatsStream:   cfg.StreamName,
		NatsConsumer: cfg.ConsumerName,
		NatsSubject:  cfg.SubjectName,
		AckWait:      ackWaitDuration,
	}
	return nil
}

func (s *SinkTestSuite) aRunningNATSJetStream(streamName, subjectName string) error {
	js := s.natsClient.JetStream()

	// Create stream if not exists
	_, err := js.Stream(context.Background(), streamName)
	if err != nil {
		_, err = js.CreateOrUpdateStream(context.Background(), jetstream.StreamConfig{ //nolint:exhaustruct // optional config
			Name:     streamName,
			Subjects: []string{subjectName},
		})
		if err != nil {
			return fmt.Errorf("create stream: %w", err)
		}
	}

	return nil
}

func (s *SinkTestSuite) aClickHouseClientWithConfig(dbName, tableName string) error {
	chPort, err := s.chContainer.GetPort()
	if err != nil {
		return fmt.Errorf("get clickhouse port: %w", err)
	}
	s.CHClient, err = client.NewClickHouseClient(context.Background(), client.ClickHouseClientConfig{ //nolint:exhaustruct // optional config
		Port:      chPort,
		Username:  "default",
		Password:  base64.StdEncoding.EncodeToString([]byte("default")),
		Database:  dbName,
		TableName: tableName,
	})
	if err != nil {
		return fmt.Errorf("create clickhouse client: %w", err)
	}
	return nil
}

func (s *SinkTestSuite) theClickHouseTableAlreadyExistsWithSchema(tableName string, schema *godog.Table) error {
	conn, err := s.chContainer.GetConnection()
	if err != nil {
		return fmt.Errorf("get clickhouse connection: %w", err)
	}

	defer conn.Close()

	columns := make([]string, 0, len(schema.Rows)-1)
	for i, row := range schema.Rows {
		if i == 0 {
			continue
		}

		if len(row.Cells) < 2 {
			return fmt.Errorf("invalid schema row: %v", row)
		}

		columns = append(columns, fmt.Sprintf("%s %s", row.Cells[0].Value, row.Cells[1].Value))
	}

	query := fmt.Sprintf("CREATE TABLE IF NOT EXISTS %s (%s) ENGINE = Memory", tableName, strings.Join(columns, ", "))
	err = conn.Exec(context.Background(), query)
	if err != nil {
		return fmt.Errorf("create table: %w", err)
	}

	return nil
}

func (s *SinkTestSuite) aBatchConfigWithMaxSize(maxSize int) error {
	s.SinkConfig = sink.ClickHouseSinkConfig{ //nolint:exhaustruct // optional config
		MaxBatchSize: maxSize,
	}
	return nil
}

func (s *SinkTestSuite) aBatchConfigWithMaxSizeAndDelay(maxSize int, duration string) error {
	maxDelayTime, err := time.ParseDuration(duration)
	if err != nil {
		return fmt.Errorf("parse duration: %w", err)
	}
	s.SinkConfig = sink.ClickHouseSinkConfig{
		MaxBatchSize: maxSize,
		MaxDelayTime: maxDelayTime,
	}
	return nil
}

func (s *SinkTestSuite) aSchemaConfigWithMapping(cfg *godog.DocString) error {
	err := json.Unmarshal([]byte(cfg.Content), &s.SchemaConfig)
	if err != nil {
		return fmt.Errorf("unmarshal schema config: %w", err)
	}

	return nil
}

func (s *SinkTestSuite) iPublishEventsToTheStream(count int, dataTable *godog.Table) error {
	js := s.natsClient.JetStream()

	if len(dataTable.Rows) < count {
		return fmt.Errorf("not enough rows in the table")
	}

	headers := dataTable.Rows[0].Cells

	for i := 1; i <= count; i++ {
		row := dataTable.Rows[i]
		event := make(map[string]any)
		for j, cell := range row.Cells {
			if j < len(headers) {
				event[headers[j].Value] = cell.Value
			}
		}

		eventBytes, err := json.Marshal(event)
		if err != nil {
			return fmt.Errorf("marshal event: %w", err)
		}

		_, err = js.Publish(context.Background(), s.StreamConfig.NatsSubject, eventBytes)
		if err != nil {
			return fmt.Errorf("publish event: %w", err)
		}
	}

	return nil
}

func (s *SinkTestSuite) iRunClickHouseSink() error {
	streamConsumer, err := stream.NewConsumer(context.Background(), s.natsClient.JetStream(), *s.StreamConfig)
	if err != nil {
		return fmt.Errorf("create stream consumer: %w", err)
	}

	schemaMapper, err := schema.NewMapper(s.SchemaConfig.Streams, s.SchemaConfig.SinkMapping)
	if err != nil {
		return fmt.Errorf("create schema mapper: %w", err)
	}

	logger := testutils.NewTestLogger()

	sink, err := operator.NewSinkOperator(
		s.CHClient,
		s.SinkConfig,
		streamConsumer,
		schemaMapper,
		logger,
	)
	if err != nil {
		return fmt.Errorf("create ClickHouse sink: %w", err)
	}
	s.CHSink = sink

	s.errCh = make(chan error, 1)

	s.wg.Add(1)
	go func() {
		defer s.wg.Done()
		s.CHSink.Start(context.Background(), s.errCh)
	}()

	return nil
}

func (s *SinkTestSuite) iStopClickHouseSinkGracefully() error {
	s.wg.Add(1)
	go func() {
		defer s.wg.Done()
		s.CHSink.Stop()
	}()

	s.wg.Wait()

	select {
	case err, ok := <-s.errCh:
		if ok {
			return fmt.Errorf("error from sink: %w", err)
		}
	default:
		// No error from sink
	}
	close(s.errCh)

	return nil
}

func (s *SinkTestSuite) iStopClickHouseSinkAfterDelay(sleepSeconds int) error {
	s.wg.Add(1)
	go func() {
		defer s.wg.Done()
		time.Sleep(time.Duration(sleepSeconds) * time.Second)
		s.CHSink.Stop(operator.WithNoWait(true))
	}()

	s.wg.Wait()

	select {
	case err, ok := <-s.errCh:
		if ok {
			return fmt.Errorf("error from sink: %w", err)
		}
	default:
		// No error from sink
	}
	close(s.errCh)

	return nil
}

func (s *SinkTestSuite) theClickHouseTableShouldContainRows(tableName string, count int) error {
	conn, err := s.chContainer.GetConnection()
	if err != nil {
		return fmt.Errorf("get clickhouse connection: %w", err)
	}

	defer conn.Close()

	query := "SELECT count() FROM " + tableName
	row := conn.QueryRow(context.Background(), query)

	var rowCount uint64
	err = row.Scan(&rowCount)
	if err != nil {
		return fmt.Errorf("scan row count: %w", err)
	}

	if count < 0 {
		return fmt.Errorf("count cannot be negative: %d", count)
	}
	if rowCount != uint64(count) {
		return fmt.Errorf("unexpected row count: expected %d, got %d", count, rowCount)
	}

	return nil
}

// CleanupResources handles all resource cleanup
func (s *SinkTestSuite) CleanupResources() error {
	var errs []error

	// Close ClickHouse sink
	if s.CHSink != nil {
		s.CHSink.Stop()
		s.wg.Wait()
		select {
		case err, ok := <-s.errCh:
			if ok {
				errs = append(errs, fmt.Errorf("error from sink: %w", err))
				close(s.errCh)
			}
		default:
			// No error from sink
		}

		s.CHSink = nil
	}

	// Close ClickHouse client
	if s.CHClient != nil {
		err := s.CHClient.Close()
		if err != nil {
			errs = append(errs, fmt.Errorf("close ClickHouse client: %w", err))
		}
		s.CHClient = nil
	}

	// Stop ClickHouse container
	if s.chContainer != nil {
		err := s.chContainer.Stop(context.Background())
		if err != nil {
			errs = append(errs, fmt.Errorf("terminate ClickHouse container: %w", err))
		}
		s.chContainer = nil
	}

	// Close NATS client
	if s.natsClient != nil {
		err := s.natsClient.Close()
		if err != nil {
			errs = append(errs, fmt.Errorf("close NATS client: %w", err))
		}
		s.natsClient = nil
	}

	// Stop NATS container
	if s.natsContainer != nil {
		err := s.natsContainer.Stop(context.Background())
		if err != nil {
			errs = append(errs, fmt.Errorf("terminate NATS container: %w", err))
		}
		s.natsContainer = nil
	}

	if len(errs) > 0 {
		var errStr strings.Builder
		errStr.WriteString("cleanup errors: ")
		for i, err := range errs {
			if i > 0 {
				errStr.WriteString("; ")
			}
			errStr.WriteString(err.Error())
		}
		return fmt.Errorf("errors occurred: %s", errStr.String())
	}

	return nil
}

func (s *SinkTestSuite) RegisterSteps(sc *godog.ScenarioContext) {
	sc.Step(`^a running NATS instance$`, s.aRunningNATSInstance)
	sc.Step(`^a running ClickHouse instance$`, s.aRunningCHInstance)
	sc.Step(`^a running NATS stream "([^"]*)" with subject "([^"]*)"$`, s.aRunningNATSJetStream)
	sc.Step(`^a stream consumer with config$`, s.aStreamConsumerConfig)
	sc.Step(`^a ClickHouse client with db "([^"]*)" and table "([^"]*)"$`, s.aClickHouseClientWithConfig)
	sc.Step(`^the ClickHouse table "([^"]*)" already exists with schema$`, s.theClickHouseTableAlreadyExistsWithSchema)
	sc.Step(`^a batch config with max size (\d+)$`, s.aBatchConfigWithMaxSize)
	sc.Step(`^a schema config with mapping$`, s.aSchemaConfigWithMapping)
	sc.Step(`^I publish (\d+) events to the stream with data$`, s.iPublishEventsToTheStream)
	sc.Step(`^I run ClickHouse sink`, s.iRunClickHouseSink)
	sc.Step(`^I stop ClickHouse sink after (\d+) seconds$`, s.iStopClickHouseSinkAfterDelay)
	sc.Step(`^I gracefully stop ClickHouse sink$`, s.iStopClickHouseSinkGracefully)
	sc.Step(`^the ClickHouse table "([^"]*)" should contain (\d+) rows$`, s.theClickHouseTableShouldContainRows)
	sc.Step(`^a batch config with max size (\d+) and delay "([^"]*)"$`, s.aBatchConfigWithMaxSizeAndDelay)
	sc.After(func(ctx context.Context, _ *godog.Scenario, _ error) (context.Context, error) {
		cleanupErr := s.CleanupResources()
		if cleanupErr != nil {
			return ctx, cleanupErr
		}
		return ctx, nil
	})
}
