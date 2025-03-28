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

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/schema"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/sink"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/stream"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/tests/testutils"
)

type SinkTestSuite struct {
	natsContainer *testutils.NATSContainer
	chContainer   *testutils.ClickHouseContainer

	StreamConfig *stream.ConsumerConfig
	SinkSonfig   *sink.ConnectorConfig
	SchemaConfig *schema.SchemaConfig
	BatchConfig  *sink.BatchConfig
	CHSink       *sink.ClickHouseSink
}

func NewSinkTestSuite() *SinkTestSuite {
	return &SinkTestSuite{} //nolint:exhaustruct // optional config
}

func (s *SinkTestSuite) aRunningNATSInstance() error {
	natsContainer, err := testutils.StartNATSContainer(context.Background())
	if err != nil {
		return fmt.Errorf("start nats container: %w", err)
	}

	s.natsContainer = natsContainer

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

func (s *SinkTestSuite) aStreamConsumerConfig(streamName, subjectName, consumerName string) error {
	s.StreamConfig = &stream.ConsumerConfig{
		NatsURL:        s.natsContainer.GetURI(),
		NatsStream:     streamName,
		NatsConsumer:   consumerName,
		NatsSubject:    subjectName,
		AckWaitSeconds: 5,
	}
	return nil
}

func (s *SinkTestSuite) aRunningNATSJetStream(streamName, subjectName string) error {
	natsWrap, err := stream.NewNATSWrapper(s.StreamConfig.NatsURL)
	if err != nil {
		return fmt.Errorf("create nats wrapper: %w", err)
	}
	defer natsWrap.Close()

	js := natsWrap.JetStream()

	// Create stream if not exists
	_, err = js.Stream(context.Background(), s.StreamConfig.NatsStream)
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

func (s *SinkTestSuite) aClickHouseSinkConfig(dbName, tableName string) error {
	chPort, err := s.chContainer.GetPort()
	if err != nil {
		return fmt.Errorf("get clickhouse port: %w", err)
	}
	s.SinkSonfig = &sink.ConnectorConfig{ //nolint:exhaustruct // optional config
		Port:      chPort,
		Username:  "default",
		Password:  base64.StdEncoding.EncodeToString([]byte("default")),
		Database:  dbName,
		TableName: tableName,
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
	s.BatchConfig = &sink.BatchConfig{
		MaxBatchSize: maxSize,
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
	natsWrap, err := stream.NewNATSWrapper(s.StreamConfig.NatsURL)
	if err != nil {
		return fmt.Errorf("create nats wrapper: %w", err)
	}
	defer natsWrap.Close()

	js := natsWrap.JetStream()

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

func (s *SinkTestSuite) iRunClickHouseSink(timeoutSeconds int) error {
	natsWrapper, err := stream.NewNATSWrapper(s.StreamConfig.NatsURL)
	if err != nil {
		return fmt.Errorf("create nats wrapper: %w", err)
	}

	defer natsWrapper.Close()

	streamConsumer, err := stream.NewConsumer(context.Background(), natsWrapper.JetStream(), *s.StreamConfig)
	if err != nil {
		return fmt.Errorf("create stream consumer: %w", err)
	}

	schemaMapper, err := schema.NewSchemaMapper(*s.SchemaConfig)
	if err != nil {
		return fmt.Errorf("create schema mapper: %w", err)
	}

	logger := testutils.NewTestLogger()

	sink, err := sink.NewClickHouseSink(*s.SinkSonfig, *s.BatchConfig, streamConsumer, schemaMapper, logger)
	if err != nil {
		return fmt.Errorf("create ClickHouse sink: %w", err)
	}
	s.CHSink = sink

	errCh := make(chan error, 1)

	wg := sync.WaitGroup{}

	wg.Add(1)
	go func() {
		defer wg.Done()
		s.CHSink.Start(context.Background(), errCh)
	}()

	// Wait for the sink to finish or timeout
	wg.Add(1)
	go func() {
		defer wg.Done()
		time.Sleep(time.Duration(timeoutSeconds) * time.Second)
		s.CHSink.Stop()
	}()

	wg.Wait()

	select {
	case err, ok := <-errCh:
		if ok {
			return fmt.Errorf("error from sink: %w", err)
		}
	default:
		// No error from sink
	}
	close(errCh)

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

func (s *SinkTestSuite) theDataInClickhouseShouldMatchTheSchema(tableName string, schema *godog.Table) error {
	conn, err := s.chContainer.GetConnection()
	if err != nil {
		return fmt.Errorf("get clickhouse connection: %w", err)
	}
	defer conn.Close()

	if len(schema.Rows) < 2 {
		return fmt.Errorf("invalid schema table")
	}

	headers := schema.Rows[0].Cells
	columns := make([]string, 0, len(headers))
	for _, cell := range headers {
		columns = append(columns, cell.Value)
	}

	query := fmt.Sprintf("SELECT %s FROM %s", strings.Join(columns, ", "), tableName)
	rows, err := conn.Query(context.Background(), query)
	if err != nil {
		return fmt.Errorf("query table: %w", err)
	}
	defer rows.Close()

	rowIdx := 1 // Skip header
	for rows.Next() {
		if rowIdx >= len(schema.Rows) {
			return fmt.Errorf("more rows in database than expected")
		}

		// Create a slice to scan the row values into
		values := make([]any, len(columns))
		valuePointers := make([]any, len(columns))
		for i := range values {
			valuePointers[i] = &values[i]
		}

		err := rows.Scan(valuePointers...)
		if err != nil {
			return fmt.Errorf("scan row: %w", err)
		}

		// Compare with expected values
		expectedRow := schema.Rows[rowIdx]
		for i, expected := range expectedRow.Cells {
			// Convert the scanned value to string for comparison
			var actual string
			switch v := values[i].(type) {
			case string:
				actual = v
			case []byte:
				actual = string(v)
			default:
				actual = fmt.Sprintf("%v", v)
			}

			if actual != expected.Value {
				return fmt.Errorf("row %d, column %s: expected '%s', got '%s'",
					rowIdx, columns[i], expected.Value, actual)
			}
		}

		rowIdx++
	}

	if rowIdx < len(schema.Rows) {
		return fmt.Errorf("more rows in database than expected")
	}

	return nil
}

func (s *SinkTestSuite) iDropTheClickHouseTable(tableName string) error {
	if s.chContainer == nil {
		return nil // Nothing to drop
	}

	conn, err := s.chContainer.GetConnection()
	if err != nil {
		return fmt.Errorf("get clickhouse connection: %w", err)
	}
	defer conn.Close()

	err = conn.Exec(context.Background(), "DROP TABLE IF EXISTS %s"+tableName)
	if err != nil {
		return fmt.Errorf("drop table: %w", err)
	}

	return nil
}

// CleanupResources handles all resource cleanup
func (s *SinkTestSuite) CleanupResources() error {
	var errs []error

	// Drop all tables that might have been created
	if s.SinkSonfig != nil {
		err := s.iDropTheClickHouseTable(s.SinkSonfig.TableName)
		if err == nil {
			return fmt.Errorf("clean clickhouse: %w", err)
		}
	}

	// Close ClickHouse sink
	if s.CHSink != nil {
		s.CHSink.Stop()
	}

	// Stop ClickHouse container
	if s.chContainer != nil {
		err := s.chContainer.Stop(context.Background())
		if err != nil {
			errs = append(errs, fmt.Errorf("terminate ClickHouse container: %w", err))
		}
		s.chContainer = nil
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
	sc.Step(`^a stream consumer config with stream "([^"]*)" and subject "([^"]*)" and consumer "([^"]*)"$`, s.aStreamConsumerConfig)
	sc.Step(`^a ClickHouse sink config with db "([^"]*)" and table "([^"]*)"$`, s.aClickHouseSinkConfig)
	sc.Step(`^the ClickHouse table "([^"]*)" already exists with schema$`, s.theClickHouseTableAlreadyExistsWithSchema)
	sc.Step(`^a batch config with max size (\d+)$`, s.aBatchConfigWithMaxSize)
	sc.Step(`^a schema config with mapping$`, s.aSchemaConfigWithMapping)
	sc.Step(`^I publish (\d+) events to the stream with data$`, s.iPublishEventsToTheStream)
	sc.Step(`^I run ClickHouse sink for the (\d+) seconds$`, s.iRunClickHouseSink)
	sc.Step(`^the ClickHouse table "([^"]*)" should contain (\d+) rows$`, s.theClickHouseTableShouldContainRows)
	sc.Step(`^the data in Clickhouse should match the schema "([^"]*)"$`, s.theDataInClickhouseShouldMatchTheSchema)
}
