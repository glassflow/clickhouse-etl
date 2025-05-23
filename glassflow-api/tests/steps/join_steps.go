package steps

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/cucumber/godog"
	"github.com/nats-io/nats.go/jetstream"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/kv"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/operator"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/schema"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/stream"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/tests/testutils"
)

const (
	streamConsumerAckWaitDuration = time.Duration(5) * time.Second
	streamConsumerExpireTimeout   = time.Duration(1) * time.Second
	fetchTimeout                  = time.Duration(1) * time.Second
)

type JoinTestSuite struct {
	BaseTestSuite
	leftStreamConfig      *stream.ConsumerConfig
	rightStreamConfig     *stream.ConsumerConfig
	resultsConsumerConfig *stream.ConsumerConfig
	schemaConfig          *schema.Config
	joinOperator          *operator.JoinOperator
}

func NewJoinTestSuite() *JoinTestSuite {
	return &JoinTestSuite{} //nolint:exhaustruct // basic struct
}

func (j *JoinTestSuite) SetupResources() error {
	if j.natsContainer == nil {
		err := j.setupNATS()
		if err != nil {
			return fmt.Errorf("setup nats: %w", err)
		}
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

	streamConfig := stream.ConsumerConfig{
		NatsStream:    cfg.StreamName,
		NatsConsumer:  cfg.ConsumerName,
		NatsSubject:   cfg.SubjectName,
		AckWait:       streamConsumerAckWaitDuration,
		ExpireTimeout: streamConsumerExpireTimeout,
	}
	switch position {
	case "left":
		j.leftStreamConfig = &streamConfig
		return nil
	case "right":
		j.rightStreamConfig = &streamConfig
		return nil
	case "results":
		j.resultsConsumerConfig = &streamConfig
		return nil
	default:
		return fmt.Errorf("unknown stream position: %s", position)
	}
}

func (j *JoinTestSuite) aRunningStream(stream string) error {
	switch stream {
	case "left":
		return j.createStream(j.leftStreamConfig.NatsStream, j.leftStreamConfig.NatsSubject)
	case "right":
		return j.createStream(j.rightStreamConfig.NatsStream, j.rightStreamConfig.NatsSubject)
	case "results":
		return j.createStream(j.resultsConsumerConfig.NatsStream, j.resultsConsumerConfig.NatsSubject)
	default:
		return fmt.Errorf("unknown stream: %s", stream)
	}
}

func (j *JoinTestSuite) aSchemaConfigWithMapping(cfg *godog.DocString) error {
	err := j.getMappingConfig(cfg, &j.schemaConfig)
	if err != nil {
		return fmt.Errorf("unmarshal schema config: %w", err)
	}

	return nil
}

func (j *JoinTestSuite) iRunJoinOperator(leftTTL, rightTTL string) error {
	if j.natsContainer == nil {
		return fmt.Errorf("nats container is not running")
	}

	if j.leftStreamConfig == nil || j.rightStreamConfig == nil || j.resultsConsumerConfig == nil {
		return fmt.Errorf("stream consumer configs are not set")
	}

	if j.schemaConfig == nil {
		return fmt.Errorf("schema config is not set")
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
		StoreName: j.leftStreamConfig.NatsStream,
		TTL:       lTTL,
	})
	if err != nil {
		return fmt.Errorf("create left kv store: %w", err)
	}

	rightKVStore, err := kv.NewNATSKeyValueStore(ctx, j.natsClient.JetStream(), kv.KeyValueStoreConfig{
		StoreName: j.rightStreamConfig.NatsStream,
		TTL:       rTTL,
	})
	if err != nil {
		return fmt.Errorf("create right kv store: %w", err)
	}

	leftStreamConsumer, err := stream.NewConsumer(ctx, j.natsClient.JetStream(), *j.leftStreamConfig)
	if err != nil {
		return fmt.Errorf("create left stream consumer: %w", err)
	}

	rightStreamConsumer, err := stream.NewConsumer(ctx, j.natsClient.JetStream(), *j.rightStreamConfig)
	if err != nil {
		return fmt.Errorf("create right stream consumer: %w", err)
	}

	resultsPublisher := stream.NewPublisher(j.natsClient.JetStream(), stream.PublisherConfig{
		Subject: j.resultsConsumerConfig.NatsSubject,
	})

	schemaMapper, err := schema.NewMapper(j.schemaConfig.Streams, j.schemaConfig.SinkMapping)
	if err != nil {
		return fmt.Errorf("create schema mapper: %w", err)
	}

	logger := testutils.NewTestLogger()

	operator := operator.NewJoinOperator(
		leftStreamConsumer,
		rightStreamConsumer,
		resultsPublisher,
		schemaMapper,
		leftKVStore,
		rightKVStore,
		j.leftStreamConfig.NatsStream,
		j.rightStreamConfig.NatsStream,
		logger,
	)

	j.joinOperator = operator

	j.errCh = make(chan error, 1)

	j.wg.Add(1)
	go func() {
		defer j.wg.Done()
		operator.Start(ctx, j.errCh)
	}()

	return nil
}

func (j *JoinTestSuite) iStopJoinOperatorNoWait(delay string) error {
	dur, err := time.ParseDuration(delay)
	if err != nil {
		return fmt.Errorf("parse duration: %w", err)
	}

	j.stopOperator(j.joinOperator.Stop, false, dur)

	return j.checkOperatorErrors()
}

func (j *JoinTestSuite) iStopJoinOperatorGracefullyAfterDelay(delay string) error {
	dur, err := time.ParseDuration(delay)
	if err != nil {
		return fmt.Errorf("parse duration: %w", err)
	}

	j.stopOperator(j.joinOperator.Stop, true, dur)

	return j.checkOperatorErrors()
}

func (j *JoinTestSuite) iPublishEventsToTheLeftStream(count int, dataTable *godog.Table) error {
	return j.publishEvents(count, dataTable, j.leftStreamConfig.NatsSubject)
}

func (j *JoinTestSuite) iPublishEventsToTheRightStream(count int, dataTable *godog.Table) error {
	return j.publishEvents(count, dataTable, j.rightStreamConfig.NatsSubject)
}

// Generic helper function for publishing events
func (j *JoinTestSuite) publishEvents(count int, dataTable *godog.Table, subject string) error {
	js := j.natsClient.JetStream()

	if len(dataTable.Rows) <= count {
		return fmt.Errorf("not enough rows in the table: got %d, need %d+1 (including headers)",
			len(dataTable.Rows), count)
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
			return fmt.Errorf("marshal event for row %d: %w", i, err)
		}

		_, err = js.Publish(context.Background(), subject, eventBytes)
		if err != nil {
			return fmt.Errorf("publish event for row %d to subject %s: %w", i, subject, err)
		}
	}

	return nil
}

func (j *JoinTestSuite) createResultsConsumer() (zero jetstream.Consumer, _ error) {
	js := j.natsClient.JetStream()

	consumer, err := js.CreateOrUpdateConsumer(context.Background(), j.resultsConsumerConfig.NatsStream, jetstream.ConsumerConfig{ //nolint:exhaustruct // optional config
		Name:          j.resultsConsumerConfig.NatsConsumer,
		Durable:       j.resultsConsumerConfig.NatsConsumer,
		AckWait:       j.resultsConsumerConfig.AckWait,
		FilterSubject: j.resultsConsumerConfig.NatsSubject,
	})
	if err != nil {
		return zero, fmt.Errorf("subscribe to results stream: %w", err)
	}

	return consumer, nil
}

func (j *JoinTestSuite) iCheckResults(count int) error {
	var resultsCount, toFetch int

	consumer, err := j.createResultsConsumer()
	if err != nil {
		return fmt.Errorf("create results consumer: %w", err)
	}

	// consumer all messages
	toFetch = max(count*2, 1)
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

	// Expected number of events is (rows - 1) because first row is headers
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

func (j *JoinTestSuite) fastJoinCleanUp() error {
	var errs []error

	if j.joinOperator != nil {
		j.joinOperator.Stop(operator.WithNoWait(true))
		j.joinOperator = nil
	}

	for _, streamCfg := range []*stream.ConsumerConfig{j.leftStreamConfig, j.rightStreamConfig, j.resultsConsumerConfig} {
		if streamCfg != nil {
			err := j.deleteStream(streamCfg.NatsStream)
			if err != nil {
				errs = append(errs, fmt.Errorf("clean stream %s: %w", streamCfg.NatsStream, err))
			}
		}
	}

	err := testutils.CombineErrors(errs)
	if err != nil {
		return fmt.Errorf("cleanup errors: %w", err)
	}

	return nil
}

func (j *JoinTestSuite) CleanupResources() error {
	if j.joinOperator != nil {
		j.joinOperator.Stop(operator.WithNoWait(true))
		j.joinOperator = nil
	}

	return j.cleanupNATS()
}

func (j *JoinTestSuite) RegisterSteps(sc *godog.ScenarioContext) {
	sc.Step(`a "([^"]*)" stream consumer with config$`, j.aStreamConsumerConfig)

	sc.Step(`^a running "([^"]*)" stream$`, j.aRunningStream)
	sc.Step(`^an operator schema config with mapping$`, j.aSchemaConfigWithMapping)
	sc.Step(`^I run join operator with left TTL "([^"]*)" right TTL "([^"]*)"$`, j.iRunJoinOperator)
	sc.Step(`^I gracefully stop join operator after "([^"]*)"$`, j.iStopJoinOperatorGracefullyAfterDelay)
	sc.Step(`^I stop join operator after "([^"]*)"$`, j.iStopJoinOperatorNoWait)

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
