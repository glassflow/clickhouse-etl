package steps

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"strings"
	"sync"
	"time"

	"github.com/avast/retry-go/v4"
	"github.com/cucumber/godog"
	"github.com/google/uuid"
	"github.com/nats-io/nats.go/jetstream"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/client"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/component"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/schema"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/stream"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/tests/testutils"
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

	consumerCfg jetstream.ConsumerConfig
	streamCfg   jetstream.StreamConfig

	dlqStreamCfg   jetstream.StreamConfig
	dlqConsumerCfg jetstream.ConsumerConfig

	schemaConfig models.MapperConfig

	schemaMapper schema.Mapper

	ingestorCfg models.IngestorComponentConfig

	filterCfg models.FilterComponentConfig

	ingestor component.Component

	topicName string

	cGroupName string

	logger *slog.Logger
}

func NewIngestorTestSuite() *IngestorTestSuite {
	return &IngestorTestSuite{
		BaseTestSuite: BaseTestSuite{ //nolint:exhaustruct // optional config
			wg:             sync.WaitGroup{},
			kafkaContainer: nil,
			natsContainer:  nil,
		},
		logger: testutils.NewTestLogger(),
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
	var tempCfg natsStreamConfig
	err := json.Unmarshal([]byte(cfg.Content), &tempCfg)
	if err != nil {
		return fmt.Errorf("failed to unmarshal NATS stream config: %w", err)
	}

	// Convert to jetstream configs
	s.streamCfg = jetstream.StreamConfig{
		Name:     tempCfg.Stream,
		Subjects: []string{tempCfg.Subject},
	}
	s.consumerCfg = jetstream.ConsumerConfig{
		Name:          tempCfg.Consumer,
		Durable:       tempCfg.Consumer,
		FilterSubject: tempCfg.Subject,
	}

	return nil
}

func (s *IngestorTestSuite) runNatsStreams(deduplicationWindow time.Duration) error {
	err := s.createStream(s.streamCfg, deduplicationWindow)
	if err != nil {
		return fmt.Errorf("create nats stream: %w", err)
	}

	pipelineID := uuid.New().String()

	// create DLQ nats stream
	s.dlqStreamCfg = jetstream.StreamConfig{
		Name:     models.GetDLQStreamName(pipelineID),
		Subjects: []string{"failed"},
	}
	s.dlqConsumerCfg = jetstream.ConsumerConfig{
		Name:          "dlq-consumer",
		Durable:       "dlq-consumer",
		FilterSubject: "failed",
	}

	err = s.createStream(s.dlqStreamCfg, deduplicationWindow)
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

func (s *IngestorTestSuite) aSchemaConfigWithMapping(cfg *godog.DocString) error {
	schemaCfg, err := s.getMappingConfig(cfg)
	if err != nil {
		return fmt.Errorf("unmarshal schema config: %w", err)
	}

	s.schemaConfig = schemaCfg

	s.schemaMapper, err = schema.NewMapper(s.schemaConfig)
	if err != nil {
		return fmt.Errorf("create schema mapper: %w", err)
	}

	return nil
}

func (s *IngestorTestSuite) anIngestorComponentConfig(config string) error {
	var ingCgf models.IngestorComponentConfig
	err := json.Unmarshal([]byte(config), &ingCgf)
	if err != nil {
		return fmt.Errorf("failed to unmarshal ingestor component config: %w", err)
	}

	ingCgf.KafkaConnectionParams.Brokers = []string{s.kafkaContainer.GetURI()}

	s.ingestorCfg, err = models.NewIngestorComponentConfig(ingCgf.Provider, ingCgf.KafkaConnectionParams, ingCgf.KafkaTopics)
	if err != nil {
		return fmt.Errorf("create ingestor component config: %w", err)
	}

	return nil
}

func (s *IngestorTestSuite) aFilterComponentConfig(config string) error {
	var filterCfg models.FilterComponentConfig
	err := json.Unmarshal([]byte(config), &filterCfg)
	if err != nil {
		return fmt.Errorf("failed to unmarshal filter component config: %w", err)
	}

	s.filterCfg = filterCfg

	return nil
}

func (s *IngestorTestSuite) iRunningIngestorComponent() error {
	var duration time.Duration

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

	streamConsumer := stream.NewNATSPublisher(
		nc.JetStream(),
		stream.PublisherConfig{
			Subject: s.streamCfg.Subjects[0],
		},
	)

	dlqStreamPublisher := stream.NewNATSPublisher(
		nc.JetStream(),
		stream.PublisherConfig{
			Subject: s.dlqStreamCfg.Subjects[0],
		},
	)
	ingestor, err := component.NewIngestorComponent(
		models.PipelineConfig{
			Ingestor: s.ingestorCfg,
			Filter:   s.filterCfg,
		},
		s.topicName,
		streamConsumer,
		dlqStreamPublisher,
		s.schemaMapper,
		make(chan struct{}),
		s.logger,
		nil, // nil meter for e2e tests
	)
	if err != nil {
		return fmt.Errorf("create ingestor component: %w", err)
	}

	for _, cfgTopic := range s.ingestorCfg.KafkaTopics {
		if cfgTopic.Name == s.topicName {
			s.cGroupName = cfgTopic.ConsumerGroupName
			break
		}
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

func (s *IngestorTestSuite) createNatsConsumer(
	streamConfig jetstream.StreamConfig,
	consumerConfig jetstream.ConsumerConfig,
) (zero jetstream.Consumer, _ error) {
	if s.natsContainer == nil {
		return zero, fmt.Errorf("nats container is not initialized")
	}

	js := s.natsClient.JetStream()
	consumer, err := js.CreateOrUpdateConsumer(context.Background(), streamConfig.Name, consumerConfig)
	if err != nil {
		return zero, fmt.Errorf("create or update nats consumer: %w", err)
	}

	return consumer, nil
}

func (s *IngestorTestSuite) checkResultsFromNatsStream(
	streamConfig jetstream.StreamConfig,
	consumerConfig jetstream.ConsumerConfig,
	dataTable *godog.Table,
) error {
	consumer, err := s.createNatsConsumer(streamConfig, consumerConfig)
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
		return fmt.Errorf(
			"not equal number of events: expected %d, got %d from stream %s, subject %s",
			expectedCount,
			receivedCount,
			streamConfig.Name,
			streamConfig.Subjects[0],
		)
	}

	return nil
}

func (s *IngestorTestSuite) checkResultsStream(dataTable *godog.Table) error {
	err := s.waitForEventsProcessed()
	if err != nil {
		return fmt.Errorf("wait for events processed: %w", err)
	}

	err = s.checkResultsFromNatsStream(s.streamCfg, s.consumerCfg, dataTable)
	if err != nil {
		return fmt.Errorf("check results stream: %w", err)
	}

	return nil
}

func (s *IngestorTestSuite) checkDLQStream(dataTable *godog.Table) error {
	err := s.checkResultsFromNatsStream(s.dlqStreamCfg, s.dlqConsumerCfg, dataTable)
	if err != nil {
		return fmt.Errorf("check DLQ stream: %w", err)
	}

	return nil
}

func (s *IngestorTestSuite) waitForEventsProcessed() error {
	s.logger.Info("waiting for kafka consumer to process events",
		"topic", s.topicName,
		"consumerGroup", s.cGroupName)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := retry.Do(
		func() error {
			lag, err := s.kWriter.GetLag(ctx, s.topicName, s.cGroupName)
			if err != nil {
				return fmt.Errorf("failed to get kafka lag: %w", err)
			}

			if lag > 0 {
				return fmt.Errorf("consumer lag not zero: %d messages pending", lag)
			}

			s.logger.Info("all kafka events processed", "topic", s.topicName)
			return nil
		},
		retry.Context(ctx),
		retry.UntilSucceeded(),
		retry.Delay(50*time.Millisecond),
		retry.MaxDelay(500*time.Millisecond),
		retry.DelayType(retry.BackOffDelay),
		retry.LastErrorOnly(true),
	); err != nil {
		return fmt.Errorf("failed to wait util' events would be processed: %w", err)
	}

	return nil
}

func (s *IngestorTestSuite) stopIngestor() {
	if s.ingestor != nil {
		s.ingestor.Stop(component.WithNoWait(true))
		s.ingestor = nil
	}
}

func (s *IngestorTestSuite) fastCleanUp() error {
	var errs []error

	s.logger.Info("Starting fast cleanup of ingestor test suite resources")

	if s.ingestor != nil {
		s.stopIngestor()
		s.wg.Wait()
	}

	if s.topicName != "" {
		err := s.deleteKafkaTopic(s.topicName)
		if err != nil {
			errs = append(errs, fmt.Errorf("delete kafka topic %s: %w", s.topicName, err))
		}
		s.kWriter.Reset()
		s.topicName = ""
		s.cGroupName = ""
	}

	err := s.cleanNatsStreams()
	if err != nil {
		errs = append(errs, fmt.Errorf("clean nats streams: %w", err))
	}

	err = testutils.CombineErrors(errs)
	if err != nil {
		return fmt.Errorf("cleanup resources: %w", err)
	}

	return nil
}

func (s *IngestorTestSuite) iWaitForSeconds(seconds int) error {
	time.Sleep(time.Duration(seconds) * time.Second)
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
	logElapsedTime(sc)
	sc.Step(`^the NATS stream config:$`, s.theNatsStreamConfig)
	sc.Step(`^a schema mapper with config:$`, s.aSchemaConfigWithMapping)
	sc.Step(`^an ingestor component config:$`, s.anIngestorComponentConfig)
	sc.Step(`^an filter component config:$`, s.aFilterComponentConfig)
	sc.Step(`a Kafka topic "([^"]*)" with (\d+) partition`, s.aKafkaTopicWithPartitions)

	sc.Step(`^I run the ingestor component$`, s.iRunningIngestorComponent)
	sc.Step(`^I stop the ingestor component$`, s.stopIngestor)
	sc.Step(`^I write these events to Kafka topic "([^"]*)":$`, s.publishEventsToKafka)
	sc.Step(`^I check results stream with content$`, s.checkResultsStream)
	sc.Step(`^I check DLQ stream with content$`, s.checkDLQStream)
	sc.Step(`^I flush all NATS streams$`, s.cleanNatsStreams)
	sc.Step(`^I wait for (\d+) second`, s.iWaitForSeconds)

	sc.After(func(ctx context.Context, _ *godog.Scenario, _ error) (context.Context, error) {
		cleanupErr := s.fastCleanUp()
		if cleanupErr != nil {
			return ctx, cleanupErr
		}
		return ctx, nil
	})
}
