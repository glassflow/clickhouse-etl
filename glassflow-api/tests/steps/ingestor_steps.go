package steps

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/operator"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/schema"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/tests/testutils"
	"github.com/nats-io/nats.go/jetstream"

	"github.com/cucumber/godog"
)

type natsStreamConfig struct {
	Stream   string `json:"stream"`
	Subject  string `json:"subject"`
	Consumer string `json:"consumer"`
}

type IngestorTestSuite struct {
	BaseTestSuite

	streamCfg natsStreamConfig

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

func (s *IngestorTestSuite) runNatsStream() error {
	fmt.Println("Running NATS stream with config:", s.streamCfg)
	if s.streamCfg.Stream == "" || s.streamCfg.Subject == "" || s.streamCfg.Consumer == "" {
		return fmt.Errorf("nats stream config is not set properly")
	}

	err := s.createStream(s.streamCfg.Stream, s.streamCfg.Subject)
	if err != nil {
		return fmt.Errorf("create nats stream: %w", err)
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

	// Skip the header row
	for i := 1; i < len(table.Rows); i++ {
		row := table.Rows[i]
		if len(row.Cells) < 2 {
			return fmt.Errorf("invalid event row format, expected at least key and value columns")
		}

		key := row.Cells[0].Value
		jsonData := row.Cells[1].Value

		events = append(events, testutils.KafkaEvent{
			Key:   key,
			Value: []byte(jsonData),
		})
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
	err := json.Unmarshal([]byte(config), &s.ingestorCfg)
	if err != nil {
		return fmt.Errorf("failed to unmarshal ingestor operator config: %w", err)
	}

	s.ingestorCfg.KafkaConnectionParams.Brokers = []string{s.kafkaContainer.GetURI()}

	return nil
}

func (s *IngestorTestSuite) aRunningIngestorOperator() error {
	logger := testutils.NewTestLogger()
	dur := 1 * time.Hour
	ingestor, err := operator.NewIngestorOperator(
		s.ingestorCfg,
		s.topicName,
		s.natsContainer.GetURI(),
		s.streamCfg.Subject,
		dur,
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

func (s *IngestorTestSuite) createNatsConsumer() (zero jetstream.Consumer, _ error) {
	if s.natsContainer == nil {
		return zero, fmt.Errorf("nats container is not initialized")
	}

	js := s.natsClient.JetStream()
	consumer, err := js.CreateOrUpdateConsumer(context.Background(), s.streamCfg.Stream, jetstream.ConsumerConfig{
		Name:          s.streamCfg.Consumer,
		Durable:       s.streamCfg.Consumer,
		FilterSubject: s.streamCfg.Subject,
	})

	if err != nil {
		return zero, fmt.Errorf("create or update nats consumer: %w", err)
	}

	return consumer, nil
}

func (s *IngestorTestSuite) checkResultsFromNatsStream(dataTable *godog.Table) error {
	time.Sleep(1 * time.Second) // Give some time for the ingestor to process events
	consumer, err := s.createNatsConsumer()
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

	expectedEventsMap := make(map[[sha256.Size]byte]string)

	for i := 1; i < len(dataTable.Rows); i++ {
		row := dataTable.Rows[i]
		event := make(map[string]any)

		rowStr := make([]string, 0, len(row.Cells))

		for j, cell := range row.Cells {
			if j < len(headers) {
				event[headers[j]] = cell.Value
				rowStr = append(rowStr, cell.Value)
			}
		}

		eventBytes, err := json.Marshal(event)
		if err != nil {
			return fmt.Errorf("marshal event %s: %w", event, err)
		}

		// Calculate SHA-256 hash of the event
		hash := sha256.Sum256(eventBytes)
		expectedEventsMap[hash] = strings.Join(rowStr, " | ")
	}

	// Fetch messages with a timeout
	msgs, err := consumer.Fetch(2*expectedCount, jetstream.FetchMaxWait(fetchTimeout))
	if err != nil {
		return fmt.Errorf("fetch messages: %w", err)
	}

	receivedCount := 0

	for msg := range msgs.Messages() {
		if msg == nil {
			break
		}

		var event map[string]any
		if err := json.Unmarshal(msg.Data(), &event); err != nil {
			return fmt.Errorf("unmarshal message data: %w", err)
		}

		// Calculate SHA-256 hash of the event
		hash := sha256.Sum256(msg.Data())

		if _, exists := expectedEventsMap[hash]; !exists {
			return fmt.Errorf("unexpected event: %v", event)
		}

		delete(expectedEventsMap, hash)

		receivedCount++

		if err := msg.Ack(); err != nil {
			return fmt.Errorf("ack message: %w", err)
		}
	}

	if receivedCount < expectedCount {
		events := "\n"
		for k := range expectedEventsMap {
			events += expectedEventsMap[k] + "\n"
		}
		return fmt.Errorf("expected %d events, but received only %d, missed events: %s", expectedCount, receivedCount, events)
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
	sc.Step(`^run the NATS stream$`, s.runNatsStream)
	sc.Step(`^a schema mapper with config:$`, s.aSchemaConfigWithMapping)
	sc.Step(`^an ingestor operator config:$`, s.anIngestorOperatorConfig)
	sc.Step(`a Kafka topic "([^"]*)" with (\d+) partition`, s.aKafkaTopicWithPartitions)
	sc.Step(`^a running ingestor operator$`, s.aRunningIngestorOperator)

	sc.Step(`^I write these events to Kafka topic "([^"]*)":$`, s.iPublishEventsToKafka)
	sc.Step(`^I check results with content$`, s.checkResultsFromNatsStream)
	sc.After(func(ctx context.Context, _ *godog.Scenario, _ error) (context.Context, error) {
		cleanupErr := s.fastJoinCleanUp()
		if cleanupErr != nil {
			return ctx, cleanupErr
		}
		return ctx, nil
	})
}
