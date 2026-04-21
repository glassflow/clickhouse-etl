package steps

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"github.com/cucumber/godog"
	"github.com/nats-io/nats.go/jetstream"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/component"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/configs"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/kv"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	schemav2 "github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/schema_v2"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/service"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/storage"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/stream"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/tests/testutils"
)

const (
	streamConsumerAckWaitDuration = time.Duration(5) * time.Second
	streamConsumerExpireTimeout   = time.Duration(1) * time.Second
	fetchTimeout                  = time.Duration(1) * time.Second
)

type JoinTestSuite struct {
	BaseTestSuite
	leftStreamConfig      jetstream.StreamConfig
	leftConsumerConfig    jetstream.ConsumerConfig
	rightStreamConfig     jetstream.StreamConfig
	rightConsumerConfig   jetstream.ConsumerConfig
	resultsStreamConfig   jetstream.StreamConfig
	resultsConsumerConfig jetstream.ConsumerConfig
	streamConsumerAckWait time.Duration
	streamConsumerExpire  time.Duration
	pipelineConfig        *models.PipelineConfig
	pipelineStore         service.PipelineStore
	JoinComponent         component.Component
	logger                *slog.Logger
}

func NewJoinTestSuite() *JoinTestSuite {
	return &JoinTestSuite{
		logger: testutils.NewTestLogger(),
	}
}

func (j *JoinTestSuite) SetupResources() error {
	if j.natsContainer == nil {
		err := j.setupNATS()
		if err != nil {
			return fmt.Errorf("setup nats: %w", err)
		}
	}

	// Setup Postgres for storing pipeline configs and schema versions
	if j.postgresContainer == nil {
		err := j.setupPostgres()
		if err != nil {
			return fmt.Errorf("setup postgres: %w", err)
		}
	}

	// Create pipeline store
	if j.pipelineStore == nil {
		j.logger.Debug("Pipeline store DSN", slog.String("dsn", j.postgresContainer.GetDSN()))
		db, err := storage.NewPipelineStore(context.Background(), j.postgresContainer.GetDSN(), testutils.NewTestLogger(), nil, internal.RoleJoin)
		if err != nil {
			return fmt.Errorf("create pipeline store: %w", err)
		}
		j.pipelineStore = db
	}

	return nil
}

func (j *JoinTestSuite) aStreamConsumerConfig(position string, data *godog.DocString) error {
	type config struct {
		StreamName   string `json:"stream"`
		SubjectName  string `json:"subject"`
		ConsumerName string `json:"consumer"`
	}

	var cfg config
	err := json.Unmarshal([]byte(data.Content), &cfg)
	if err != nil {
		return fmt.Errorf("unmarshal stream consumer config: %w", err)
	}

	streamCfg := jetstream.StreamConfig{
		Name:     cfg.StreamName,
		Subjects: []string{cfg.SubjectName},
	}

	consumerCfg := jetstream.ConsumerConfig{
		Name:          cfg.ConsumerName,
		Durable:       cfg.ConsumerName,
		FilterSubject: cfg.SubjectName,
		AckWait:       streamConsumerAckWaitDuration,
		AckPolicy:     jetstream.AckExplicitPolicy,
	}

	// Store ack wait and expire timeout for later use
	if j.streamConsumerAckWait == 0 {
		j.streamConsumerAckWait = streamConsumerAckWaitDuration
	}
	if j.streamConsumerExpire == 0 {
		j.streamConsumerExpire = streamConsumerExpireTimeout
	}

	switch position {
	case "left":
		j.leftStreamConfig = streamCfg
		j.leftConsumerConfig = consumerCfg
		return nil
	case "right":
		j.rightStreamConfig = streamCfg
		j.rightConsumerConfig = consumerCfg
		return nil
	case "results":
		j.resultsStreamConfig = streamCfg
		j.resultsConsumerConfig = consumerCfg
		return nil
	default:
		return fmt.Errorf("unknown stream position: %s", position)
	}
}

func (j *JoinTestSuite) aRunningStream(stream string) error {
	switch stream {
	case "left":
		return j.createStream(j.leftStreamConfig, 0)
	case "right":
		return j.createStream(j.rightStreamConfig, 0)
	case "results":
		return j.createStream(j.resultsStreamConfig, 0)
	default:
		return fmt.Errorf("unknown stream: %s", stream)
	}
}

func (j *JoinTestSuite) aPipelineConfig(cfg *godog.DocString) error {
	var pc models.PipelineConfig

	err := json.Unmarshal([]byte(cfg.Content), &pc)
	if err != nil {
		return fmt.Errorf("unmarshal pipeline config: %w", err)
	}

	// Store pipeline config in database to create schema versions and component configs
	err = j.pipelineStore.InsertPipeline(context.Background(), pc)
	if err != nil {
		return fmt.Errorf("insert pipeline to database: %w", err)
	}

	j.pipelineConfig = &pc

	return nil
}

func (j *JoinTestSuite) iRunJoinComponent(leftTTL, rightTTL string) error {
	if j.natsContainer == nil {
		return fmt.Errorf("nats container is not running")
	}

	if j.leftStreamConfig.Name == "" || j.rightStreamConfig.Name == "" || j.resultsConsumerConfig.Name == "" {
		return fmt.Errorf("stream consumer configs are not set")
	}

	if j.pipelineConfig == nil {
		return fmt.Errorf("pipeline config is not set")
	}

	lTTL, err := time.ParseDuration(leftTTL)
	if err != nil {
		return fmt.Errorf("parse left TTL: %w", err)
	}

	rTTL, err := time.ParseDuration(rightTTL)
	if err != nil {
		return fmt.Errorf("parse right TTL: %w", err)
	}

	ctx := context.Background()

	leftKVStore, err := kv.NewNATSKeyValueStore(ctx, j.natsClient.JetStream(), kv.KeyValueStoreConfig{
		StoreName: j.leftStreamConfig.Name,
		TTL:       lTTL,
	})
	if err != nil {
		return fmt.Errorf("create left kv store: %w", err)
	}

	rightKVStore, err := kv.NewNATSKeyValueStore(
		ctx,
		j.natsClient.JetStream(),
		kv.KeyValueStoreConfig{
			StoreName: j.rightStreamConfig.Name,
			TTL:       rTTL,
		},
	)
	if err != nil {
		return fmt.Errorf("create right kv store: %w", err)
	}

	leftStreamConsumer, err := stream.NewNATSConsumer(ctx, j.natsClient.JetStream(), j.leftConsumerConfig, j.leftStreamConfig.Name)
	if err != nil {
		return fmt.Errorf("create left stream consumer: %w", err)
	}

	rightStreamConsumer, err := stream.NewNATSConsumer(ctx, j.natsClient.JetStream(), j.rightConsumerConfig, j.rightStreamConfig.Name)
	if err != nil {
		return fmt.Errorf("create right stream consumer: %w", err)
	}

	resultsPublisher := stream.NewNATSPublisher(
		j.natsClient.JetStream(),
		stream.PublisherConfig{
			Subject: j.resultsConsumerConfig.FilterSubject,
		},
	)

	logger := testutils.NewTestLogger()

	// Create schema_v2 instances for left and right sources using DB
	var leftSource, rightSource models.JoinSourceConfig
	for _, src := range j.pipelineConfig.Join.Sources {
		if src.Orientation == "left" {
			leftSource = src
		} else {
			rightSource = src
		}
	}

	leftSchema, err := schemav2.NewSchema(j.pipelineConfig.ID, leftSource.SourceID, j.pipelineStore, nil)
	if err != nil {
		return fmt.Errorf("create left schema: %w", err)
	}

	rightSchema, err := schemav2.NewSchema(j.pipelineConfig.ID, rightSource.SourceID, j.pipelineStore, nil)
	if err != nil {
		return fmt.Errorf("create right schema: %w", err)
	}

	// Create config store for accessing join configs from DB
	configStore := configs.NewConfigStore(j.pipelineStore, j.pipelineConfig.ID, "")

	joinComponent, err := component.NewJoinComponent(
		j.pipelineConfig.Join,
		leftStreamConsumer,
		rightStreamConsumer,
		resultsPublisher,
		leftSchema,
		rightSchema,
		configStore,
		leftKVStore,
		rightKVStore,
		leftSource.SourceID,
		rightSource.SourceID,
		leftSource.JoinKey,
		rightSource.JoinKey,
		make(chan struct{}),
		logger,
	)

	if err != nil {
		return fmt.Errorf("create join component: %w", err)
	}

	j.JoinComponent = joinComponent

	j.errCh = make(chan error, 1)

	j.wg.Add(1)
	go func() {
		defer j.wg.Done()
		joinComponent.Start(ctx, j.errCh)
	}()

	return nil
}

func (j *JoinTestSuite) iStopJoinComponentNoWait(delay string) error {
	dur, err := time.ParseDuration(delay)
	if err != nil {
		return fmt.Errorf("parse duration: %w", err)
	}

	j.stopComponent(j.JoinComponent.Stop, false, dur)

	return j.checkComponentErrors()
}

func (j *JoinTestSuite) iStopJoinComponentGracefullyAfterDelay(delay string) error {
	dur, err := time.ParseDuration(delay)
	if err != nil {
		return fmt.Errorf("parse duration: %w", err)
	}

	j.stopComponent(j.JoinComponent.Stop, true, dur)

	return j.checkComponentErrors()
}

func (j *JoinTestSuite) iPublishEventsToTheLeftStream(count int, dataTable *godog.Table) error {
	return j.publishEvents(count, dataTable, j.leftConsumerConfig.FilterSubject)
}

func (j *JoinTestSuite) iPublishEventsToTheRightStream(count int, dataTable *godog.Table) error {
	return j.publishEvents(count, dataTable, j.rightConsumerConfig.FilterSubject)
}

func (j *JoinTestSuite) createResultsConsumer() (zero jetstream.Consumer, _ error) {
	js := j.natsClient.JetStream()

	consumer, err := js.CreateOrUpdateConsumer(
		context.Background(),
		j.resultsStreamConfig.Name,
		j.resultsConsumerConfig,
	)
	if err != nil {
		return zero, fmt.Errorf("subscribe to results stream: %w", err)
	}

	return consumer, nil
}

func (j *JoinTestSuite) iCheckResults(count int) error {
	consumer, err := j.createResultsConsumer()
	if err != nil {
		return fmt.Errorf("create results consumer: %w", err)
	}

	// consumer all messages
	toFetch := max(count*2, 1)
	resultsCount := 0
	msgs, err := consumer.Fetch(toFetch, jetstream.FetchMaxWait(fetchTimeout))
	if err != nil {
		return fmt.Errorf("fetch messages: %w", err)
	}

	for msg := range msgs.Messages() {
		if msg == nil {
			break
		}

		err = msg.Ack()
		if err != nil {
			return fmt.Errorf("ack message: %w", err)
		}

		resultsCount++
	}

	if resultsCount != count {
		return fmt.Errorf("expected %d results, got %d", count, resultsCount)
	}

	return nil
}

func (j *JoinTestSuite) iCheckResultsWithContent(dataTable *godog.Table) error {
	consumer, err := j.createResultsConsumer()
	if err != nil {
		return fmt.Errorf("create results consumer: %w", err)
	}

	return j.ValidateEventsFromStream(
		consumer,
		dataTable,
		j.resultsStreamConfig.Name,
		j.resultsConsumerConfig.FilterSubject,
	)
}

func (j *JoinTestSuite) fastJoinCleanUp() error {
	var errs []error

	if j.JoinComponent != nil {
		j.JoinComponent.Stop(component.WithNoWait(true))
		j.JoinComponent = nil
	}

	for _, streamName := range []string{
		j.leftStreamConfig.Name,
		j.rightStreamConfig.Name,
		j.resultsStreamConfig.Name,
	} {
		if streamName != "" {
			err := j.deleteStream(streamName)
			if err != nil {
				errs = append(errs, fmt.Errorf("clean stream %s: %w", streamName, err))
			}
		}
	}

	// Clean up pipeline from database
	if j.pipelineConfig != nil {
		err := j.pipelineStore.DeletePipeline(context.Background(), j.pipelineConfig.ID)
		if err != nil {
			errs = append(errs, fmt.Errorf("delete pipeline from database: %w", err))
		}
		j.pipelineConfig = nil
	}

	err := testutils.CombineErrors(errs)
	if err != nil {
		return fmt.Errorf("cleanup errors: %w", err)
	}

	return nil
}

func (j *JoinTestSuite) CleanupResources() error {
	if j.JoinComponent != nil {
		j.JoinComponent.Stop(component.WithNoWait(true))
		j.JoinComponent = nil
	}

	var errs []error

	err := j.cleanupNATS()
	if err != nil {
		errs = append(errs, err)
	}

	err = j.cleanupPostgres()
	if err != nil {
		errs = append(errs, err)
	}

	return testutils.CombineErrors(errs)
}

func (j *JoinTestSuite) RegisterSteps(sc *godog.ScenarioContext) {
	logElapsedTime(sc)
	sc.Step(`a "([^"]*)" stream consumer with config$`, j.aStreamConsumerConfig)

	sc.Step(`^a running "([^"]*)" stream$`, j.aRunningStream)
	sc.Step(`^a join pipeline with configuration$`, j.aPipelineConfig)
	sc.Step(`^I run join component with left TTL "([^"]*)" right TTL "([^"]*)"$`, j.iRunJoinComponent)
	sc.Step(`^I gracefully stop join component after "([^"]*)"$`, j.iStopJoinComponentGracefullyAfterDelay)
	sc.Step(`^I stop join component after "([^"]*)"$`, j.iStopJoinComponentNoWait)

	sc.Step(`^I publish (\d+) events to the left stream$`, j.iPublishEventsToTheLeftStream)
	sc.Step(`^I publish (\d+) events to the right stream$`, j.iPublishEventsToTheRightStream)
	sc.Step(`^I check results count is (\d+)$`, j.iCheckResults)
	sc.Step(`^I check results with content$`, j.iCheckResultsWithContent)
	sc.After(func(ctx context.Context, _ *godog.Scenario, _ error) (context.Context, error) {
		cleanupErr := j.fastJoinCleanUp()
		if cleanupErr != nil {
			return ctx, cleanupErr
		}
		return ctx, nil
	})
}
