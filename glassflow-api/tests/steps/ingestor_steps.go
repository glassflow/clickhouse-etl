package steps

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/avast/retry-go/v4"
	"github.com/cucumber/godog"
	"github.com/google/uuid"
	"github.com/nats-io/nats.go/jetstream"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/client"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/component"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/componentsignals"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	schemav2 "github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/schema_v2"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/service"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/storage"
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

	dlqStreamCfg      jetstream.StreamConfig
	dlqConsumerCfg    jetstream.ConsumerConfig
	signalStreamCfg   jetstream.StreamConfig
	signalConsumerCfg jetstream.ConsumerConfig

	pipelineConfig *models.PipelineConfig
	pipelineStore  service.PipelineStore
	mockSRClient   *testutils.MockSchemaRegistryClient

	ingestor component.Component

	topicName string

	cGroupName string

	logger *slog.Logger
}

func NewIngestorTestSuite() *IngestorTestSuite {
	return &IngestorTestSuite{
		BaseTestSuite: BaseTestSuite{ //nolint:exhaustruct // optional config
			wg:                sync.WaitGroup{},
			kafkaContainer:    nil,
			natsContainer:     nil,
			postgresContainer: nil,
		},
		mockSRClient: nil,
		logger:       testutils.NewTestLogger(),
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

	// Setup Postgres for storing pipeline configs and schema versions
	if s.postgresContainer == nil {
		err := s.setupPostgres()
		if err != nil {
			errs = append(errs, fmt.Errorf("setup postgres: %w", err))
		}
	}

	// Create pipeline store
	if s.pipelineStore == nil {
		s.logger.Debug("Pipeline store DSN", slog.String("dsn", s.postgresContainer.GetDSN()))
		db, err := storage.NewPipelineStore(context.Background(), s.postgresContainer.GetDSN(), testutils.NewTestLogger(), nil)
		if err != nil {
			errs = append(errs, fmt.Errorf("create pipeline store: %w", err))
		}
		s.pipelineStore = db
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

	s.signalStreamCfg = jetstream.StreamConfig{
		Name:     models.ComponentSignalsStream,
		Subjects: []string{models.GetComponentSignalsSubject()},
	}

	s.signalConsumerCfg = jetstream.ConsumerConfig{
		Name:          "component-signals-consumer",
		Durable:       "component-signals-consumer",
		FilterSubject: models.GetComponentSignalsSubject(),
	}

	err = s.createStream(s.signalStreamCfg, deduplicationWindow)
	if err != nil {
		return fmt.Errorf("create component signals nats stream: %w", err)
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

func (s *IngestorTestSuite) aSchemaRegistryContainsSchemaWithIDAndFields(schemaID int, fields *godog.Table) error {
	var schemaFields []models.Field

	s.mockSRClient = testutils.NewMockSchemaRegistryClient(s.logger)
	for _, row := range fields.Rows[1:] {
		if len(row.Cells) < 2 {
			return fmt.Errorf("each field row must have at least 2 columns (name, type)")
		}
		schemaFields = append(schemaFields, models.Field{
			Name: row.Cells[0].Value,
			Type: row.Cells[1].Value,
		})
	}
	// Add schema to the mock registry client
	s.mockSRClient.AddSchema(schemaID, schemaFields)
	return nil
}

func (s *IngestorTestSuite) aPipelineConfig(cfg *godog.DocString) error {
	var pc models.PipelineConfig

	err := json.Unmarshal([]byte(cfg.Content), &pc)
	if err != nil {
		return fmt.Errorf("unmarshal pipeline config: %w", err)
	}

	// Extract ingestor config from pipeline config and set Kafka broker
	if len(pc.Ingestor.KafkaTopics) > 0 {
		pc.Ingestor.KafkaConnectionParams.Brokers = []string{s.kafkaContainer.GetURI()}
		s.topicName = pc.Ingestor.KafkaTopics[0].Name
	}

	// Validate ingestor config to set defaults (like consumer_group_initial_offset)
	validatedCfg, err := models.NewIngestorComponentConfig(
		pc.Ingestor.Provider,
		pc.Ingestor.KafkaConnectionParams,
		pc.Ingestor.KafkaTopics,
	)
	if err != nil {
		return fmt.Errorf("validate ingestor config: %w", err)
	}
	pc.Ingestor = validatedCfg

	// Store pipeline config in database to create schema versions and component configs
	err = s.pipelineStore.InsertPipeline(context.Background(), pc)
	if err != nil {
		return fmt.Errorf("insert pipeline: %w", err)
	}

	// Set ingestor config and pipeline config AFTER insertion (which may modify them)
	s.pipelineConfig = &pc

	return nil
}

func (s *IngestorTestSuite) iRunningIngestorComponent() error {
	var duration time.Duration

	if s.natsContainer == nil {
		return fmt.Errorf("nats container is not initialized")
	}

	if s.pipelineConfig == nil {
		return fmt.Errorf("pipeline config not set")
	}

	if len(s.pipelineConfig.Ingestor.KafkaTopics) == 1 {
		if s.pipelineConfig.Ingestor.KafkaTopics[0].Deduplication.Enabled {
			duration = s.pipelineConfig.Ingestor.KafkaTopics[0].Deduplication.Window.Duration()
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

	signalPublisher, err := componentsignals.NewPublisher(nc)
	if err != nil {
		return fmt.Errorf("create component signal publisher: %w", err)
	}

	var srClient schemav2.SchemaRegistryClient
	if s.mockSRClient != nil {
		srClient = s.mockSRClient
		s.logger.Debug("using mock schema registry client for ingestor")
	}

	schema, err := schemav2.NewSchema(
		s.pipelineConfig.ID,
		s.topicName,
		s.pipelineStore,
		srClient,
	)
	if err != nil {
		return fmt.Errorf("create schema: %w", err)
	}

	ingestor, err := component.NewIngestorComponent(
		*s.pipelineConfig,
		s.topicName,
		streamConsumer,
		dlqStreamPublisher,
		schema,
		signalPublisher,
		make(chan struct{}),
		s.logger,
		nil, // nil meter for e2e tests
	)
	if err != nil {
		return fmt.Errorf("create ingestor component: %w", err)
	}

	for _, cfgTopic := range s.pipelineConfig.Ingestor.KafkaTopics {
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

	return s.ValidateEventsFromStream(
		consumer,
		dataTable,
		streamConfig.Name,
		streamConfig.Subjects[0],
	)
}

func (s *IngestorTestSuite) checkResultsStream(expectedLag int, dataTable *godog.Table) error {
	err := s.waitForEventsProcessed(expectedLag)
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

func (s *IngestorTestSuite) checkSignalStream(dataTable *godog.Table) error {
	err := s.checkResultsFromNatsStream(s.signalStreamCfg, s.signalConsumerCfg, dataTable)
	if err != nil {
		return fmt.Errorf("check DLQ stream: %w", err)
	}

	return nil
}

func (s *IngestorTestSuite) waitForEventsProcessed(expectedLag int) error {
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
				if expectedLag > 0 && lag == int64(expectedLag) {
					s.logger.Info("kafka consumer reached expected lag",
						"topic", s.topicName,
						"consumerGroup", s.cGroupName,
						"lag", lag)
					return nil
				}
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

	// Clean up pipeline from database
	if s.pipelineConfig != nil {
		err = s.pipelineStore.DeletePipeline(context.Background(), s.pipelineConfig.ID)
		if err != nil {
			errs = append(errs, fmt.Errorf("delete pipeline: %w", err))
		}
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

	if err := s.cleanupPostgres(); err != nil {
		errs = append(errs, fmt.Errorf("cleanup postgres: %w", err))
	}

	if err := testutils.CombineErrors(errs); err != nil {
		return fmt.Errorf("cleanup resources: %w", err)
	}

	return nil
}

func (s *IngestorTestSuite) RegisterSteps(sc *godog.ScenarioContext) {
	logElapsedTime(sc)
	sc.Step(`^the NATS stream config:$`, s.theNatsStreamConfig)
	sc.Step(`^pipeline config with configuration$`, s.aPipelineConfig)
	sc.Step(`^a schema registry contains schema with id (\d+) and fields:$`, s.aSchemaRegistryContainsSchemaWithIDAndFields)
	sc.Step(`a Kafka topic "([^"]*)" with (\d+) partition`, s.aKafkaTopicWithPartitions)

	sc.Step(`^I run the ingestor component$`, s.iRunningIngestorComponent)
	sc.Step(`^I stop the ingestor component$`, s.stopIngestor)
	sc.Step(`^I write these events to Kafka topic "([^"]*)":$`, s.publishEventsToKafka)
	sc.Step(`^I check results stream with lag (\d+) and content$`, s.checkResultsStream)
	sc.Step(`^I check DLQ stream with content$`, s.checkDLQStream)
	sc.Step(`^I check signal stream with content$`, s.checkSignalStream)
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
