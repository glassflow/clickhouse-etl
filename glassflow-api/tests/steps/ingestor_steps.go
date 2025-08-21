package steps

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/client"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/operator"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/schema"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/tests/testutils"
	"github.com/google/uuid"
	"github.com/nats-io/nats.go/jetstream"

	"github.com/cucumber/godog"
)

const (
	timeoutDuration = 1 * time.Minute
)

type natsStreamConfig struct {
	Stream   string `json:"stream"`
	Subject  string `json:"subject"`
	Consumer string `json:"consumer"`
}

type IngestorTestSuite struct {
	BaseTestSuite

	streamCfg natsStreamConfig

	dlqStreamCfg natsStreamConfig

	schemaConfig models.MapperConfig

	schemaMapper schema.Mapper

	ingestorCfg models.IngestorOperatorConfig

	ingestor operator.Operator

	topicName string
}

func NewIngestorTestSuite() *IngestorTestSuite {
	return &IngestorTestSuite{
		BaseTestSuite: BaseTestSuite{ //nolint:exhaustruct // optional config
			wg:             sync.WaitGroup{},
			kafkaContainer: nil,
			natsContainer:  nil,
		},
	}
}

func (s *IngestorTestSuite) SetupResources() error {
	var errs []error

	if s.kafkaContainer == nil {
		err := s.setupKafka()
		if err != nil {
			errs = append(errs, err)
		}
	}

	if s.natsContainer == nil {
		err := s.setupNATS()
		if err != nil {
			errs = append(errs, err)
		}
	}

	err := testutils.CombineErrors(errs)
	if err != nil {
		return fmt.Errorf("setup resources: %w", err)
	}

	return nil
}

func (s *IngestorTestSuite) theNatsStreamConfig(cfg *godog.DocString) error {
	err := json.Unmarshal([]byte(cfg.Content), &s.streamCfg)
	if err != nil {
		return fmt.Errorf("failed to unmarshal NATS stream config: %w", err)
	}

	return nil
}

func (s *IngestorTestSuite) runNatsStreams(deduplicationWindow time.Duration) error {
	if s.streamCfg.Stream == "" || s.streamCfg.Subject == "" || s.streamCfg.Consumer == "" {
		return fmt.Errorf("nats stream config is not set properly")
	}

	err := s.createStream(s.streamCfg.Stream, s.streamCfg.Subject, deduplicationWindow)
	if err != nil {
		return fmt.Errorf("create nats stream: %w", err)
	}

	pipelineID := uuid.New().String()

	// create DLQ nats stream
	s.dlqStreamCfg = natsStreamConfig{
		Stream:   models.GetDLQStreamName(pipelineID),
		Subject:  "failed",
		Consumer: "dlq-consumer",
	}

	err = s.createStream(s.dlqStreamCfg.Stream, s.dlqStreamCfg.Subject, deduplicationWindow)
	if err != nil {
		return fmt.Errorf("create nats DLQ stream: %w", err)
	}

	return nil
}

func (s *IngestorTestSuite) cleanNatsStreams() error {
	if s.natsContainer == nil {
		return fmt.Errorf("nats container is not initialized")
	}

	err := s.deleteAllStreams()
	if err != nil {
		return fmt.Errorf("delete nats stream: %w", err)
	}

	return nil
}

func (s *IngestorTestSuite) aKafkaTopicWithPartitions(topicName string, partitions int) error {
	err := s.createKafkaTopic(topicName, partitions)
	if err != nil {
		return fmt.Errorf("create kafka topic: %w", err)
	}

	s.topicName = topicName

	return nil
}

func (s *IngestorTestSuite) iPublishEventsToKafka(topicName string, table *godog.Table) error {
	if len(table.Rows) < 2 {
		return fmt.Errorf("invalid table format, expected at least 2 rows")
	}

	events := make([]testutils.KafkaEvent, 0, len(table.Rows)-1)

	headers := make([]string, len(table.Rows[0].Cells))
	for i, cell := range table.Rows[0].Cells {
		headers[i] = cell.Value
	}

	// Skip the header row
	for i := 1; i < len(table.Rows); i++ {
		row := table.Rows[i]
		if len(row.Cells) < 2 {
			return fmt.Errorf("invalid event row format, expected at least key and value columns")
		}

		event := testutils.KafkaEvent{}

		for i, cell := range row.Cells {
			if i < len(headers) {
				switch headers[i] {
				case "partition":
					event.Partition = cell.Value
				case "key":
					event.Key = cell.Value
				case "value":
					event.Value = []byte(cell.Value)
				default:
					return fmt.Errorf("unknown field %s", headers[i])
				}
			}
		}

		events = append(events, event)
	}

	err := s.createKafkaWriter()
	if err != nil {
		return fmt.Errorf("create kafka writer: %w", err)
	}

	err = s.kWriter.WriteJSONEvents(topicName, events)
	if err != nil {
		return fmt.Errorf("write events to kafka: %w", err)
	}

	return nil
}

func (s *IngestorTestSuite) aSchemaConfigWithMapping(cfg *godog.DocString) error {
	err := s.getMappingConfig(cfg, &s.schemaConfig)
	if err != nil {
		return fmt.Errorf("unmarshal schema config: %w", err)
	}

	s.schemaMapper, err = schema.NewMapper(s.schemaConfig)
	if err != nil {
		return fmt.Errorf("create schema mapper: %w", err)
	}

	return nil
}

func (s *IngestorTestSuite) anIngestorOperatorConfig(config string) error {
	var ingCgf models.IngestorOperatorConfig
	err := json.Unmarshal([]byte(config), &ingCgf)
	if err != nil {
		return fmt.Errorf("failed to unmarshal ingestor operator config: %w", err)
	}

	ingCgf.KafkaConnectionParams.Brokers = []string{s.kafkaContainer.GetURI()}

	s.ingestorCfg, err = models.NewIngestorOperatorConfig(ingCgf.Provider, ingCgf.KafkaConnectionParams, ingCgf.KafkaTopics)
	if err != nil {
		return fmt.Errorf("create ingestor operator config: %w", err)
	}

	return nil
}

func (s *IngestorTestSuite) aRunningIngestorOperator() error {
	var duration time.Duration
	logger := testutils.NewTestLogger()

	if s.natsContainer == nil {
		return fmt.Errorf("nats container is not initialized")
	}

	if s.schemaMapper == nil {
		return fmt.Errorf("schema mapper is not initialized")
	}

	if s.ingestorCfg.KafkaTopics != nil || len(s.ingestorCfg.KafkaTopics) == 1 {
		if s.ingestorCfg.KafkaTopics[0].Deduplication.Enabled {
			duration = s.ingestorCfg.KafkaTopics[0].Deduplication.Window.Duration()
		}
	}

	err := s.runNatsStreams(duration)
	if err != nil {
		return fmt.Errorf("run nats stream: %w", err)
	}

	nc, err := client.NewNATSClient(context.Background(), s.natsContainer.GetURI(), client.WithMaxAge(timeoutDuration))
	if err != nil {
		return fmt.Errorf("create nats client: %w", err)
	}

	ingestor, err := operator.NewIngestorOperator(
		s.ingestorCfg,
		s.topicName,
		s.streamCfg.Stream,
		s.streamCfg.Subject,
		s.dlqStreamCfg.Subject,
		nc,
		s.schemaMapper,
		logger,
	)
	if err != nil {
		return fmt.Errorf("create ingestor operator: %w", err)
	}
	s.ingestor = ingestor

	s.errCh = make(chan error, 1)

	s.wg.Add(1)
	go func() {
		defer s.wg.Done()

		ingestor.Start(context.Background(), s.errCh)
	}()

	return nil
}

func (s *IngestorTestSuite) createNatsConsumer(streamCfg natsStreamConfig) (zero jetstream.Consumer, _ error) {
	if s.natsContainer == nil {
		return zero, fmt.Errorf("nats container is not initialized")
	}

	js := s.natsClient.JetStream()
	consumer, err := js.CreateOrUpdateConsumer(context.Background(), streamCfg.Stream, jetstream.ConsumerConfig{
		Name:          streamCfg.Consumer,
		Durable:       streamCfg.Consumer,
		FilterSubject: streamCfg.Subject,
	})
	if err != nil {
		return zero, fmt.Errorf("create or update nats consumer: %w", err)
	}

	return consumer, nil
}

func (s *IngestorTestSuite) checkResultsFromNatsStream(streamConfig natsStreamConfig, dataTable *godog.Table) error {
	time.Sleep(1 * time.Second) // Give some time for the ingestor to process events
	consumer, err := s.createNatsConsumer(streamConfig)
	if err != nil {
		return fmt.Errorf("create nats consumer: %w", err)
	}

	expectedCount := len(dataTable.Rows) - 1
	if expectedCount < 1 {
		return fmt.Errorf("no expected events in data table")
	}

	// Get headers from first row
	headers := make([]string, len(dataTable.Rows[0].Cells))
	for i, cell := range dataTable.Rows[0].Cells {
		headers[i] = cell.Value
	}

	expectedEvents := make(map[string]map[string]any)
	for i := 1; i < len(dataTable.Rows); i++ {
		row := dataTable.Rows[i]
		event := make(map[string]any)
		sign := make([]string, 0, len(row.Cells))

		for j, cell := range row.Cells {
			if j < len(headers) {
				event[headers[j]] = cell.Value
				sign = append(sign, cell.Value)
			}
		}

		expectedEvents[strings.Join(sign, "")] = event
	}

	msgs, err := consumer.Fetch(2*expectedCount, jetstream.FetchMaxWait(fetchTimeout))
	if err != nil {
		return fmt.Errorf("fetch messages: %w", err)
	}

	receivedCount := 0

	for msg := range msgs.Messages() {
		if msg == nil {
			break
		}

		if receivedCount > len(expectedEvents) {
			return fmt.Errorf("too much events: actual %d, expected %d", receivedCount, len(expectedEvents))
		}

		var actual map[string]any

		err := json.Unmarshal(msg.Data(), &actual)
		if err != nil {
			return fmt.Errorf("failed unmarshal message data: %w", err)
		}

		sign := make([]string, 0)

		for _, header := range headers {
			sign = append(sign, fmt.Sprint(actual[header]))
		}

		expected, exists := expectedEvents[strings.Join(sign, "")]
		if !exists {
			return fmt.Errorf("not expected event %v", actual)
		}

		if len(expected) != len(actual) {
			return fmt.Errorf("events have differenet numer of keys: %v and actual: %v", expected, actual)
		}

		for k, v := range expected {
			if v != actual[k] {
				return fmt.Errorf("events are different: %v and actual: %v", expected, actual)
			}
		}

		receivedCount++
	}

	if receivedCount != expectedCount {
		return fmt.Errorf("not equal number of events: expected %d, got %d from stream %s, subject %s", expectedCount, receivedCount, streamConfig.Stream, streamConfig.Subject)
	}

	return nil
}

func (s *IngestorTestSuite) checkResultsStream(dataTable *godog.Table) error {
	err := s.checkResultsFromNatsStream(s.streamCfg, dataTable)
	if err != nil {
		return fmt.Errorf("check results stream: %w", err)
	}

	return nil
}

func (s *IngestorTestSuite) checkDLQStream(dataTable *godog.Table) error {
	err := s.checkResultsFromNatsStream(s.dlqStreamCfg, dataTable)

	if err != nil {
		return fmt.Errorf("check DLQ stream: %w", err)
	}

	return nil
}

func (s *IngestorTestSuite) fastJoinCleanUp() error {
	var errs []error

	if s.topicName != "" {
		err := s.deleteKafkaTopic(s.topicName)
		if err != nil {
			errs = append(errs, fmt.Errorf("delete kafka topic %s: %w", s.topicName, err))
		}
	}

	err := s.cleanNatsStreams()
	if err != nil {
		errs = append(errs, fmt.Errorf("clean nats streams: %w", err))
	}

	if s.ingestor != nil {
		s.ingestor.Stop(operator.WithNoWait(true))
		s.ingestor = nil
	}

	err = testutils.CombineErrors(errs)
	if err != nil {
		return fmt.Errorf("cleanup resources: %w", err)
	}

	return nil
}

func (s *IngestorTestSuite) CleanupResources() error {
	var errs []error

	if s.kafkaContainer != nil {
		err := s.cleanupKafka()
		if err != nil {
			errs = append(errs, fmt.Errorf("cleanup kafka: %w", err))
		}
	}

	if s.natsContainer != nil {
		err := s.cleanupNATS()
		if err != nil {
			errs = append(errs, fmt.Errorf("cleanup nats: %w", err))
		}
	}

	err := testutils.CombineErrors(errs)
	if err != nil {
		return fmt.Errorf("cleanup resources: %w", err)
	}

	return nil
}

func (s *IngestorTestSuite) RegisterSteps(sc *godog.ScenarioContext) {
	sc.Step(`^the NATS stream config:$`, s.theNatsStreamConfig)
	sc.Step(`^a schema mapper with config:$`, s.aSchemaConfigWithMapping)
	sc.Step(`^an ingestor operator config:$`, s.anIngestorOperatorConfig)
	sc.Step(`a Kafka topic "([^"]*)" with (\d+) partition`, s.aKafkaTopicWithPartitions)
	sc.Step(`^a running ingestor operator$`, s.aRunningIngestorOperator)

	sc.Step(`^I write these events to Kafka topic "([^"]*)":$`, s.iPublishEventsToKafka)
	sc.Step(`^I check results stream with content$`, s.checkResultsStream)
	sc.Step(`^I check DLQ stream with content$`, s.checkDLQStream)

	sc.After(func(ctx context.Context, _ *godog.Scenario, _ error) (context.Context, error) {
		cleanupErr := s.fastJoinCleanUp()
		if cleanupErr != nil {
			return ctx, cleanupErr
		}
		return ctx, nil
	})
}
