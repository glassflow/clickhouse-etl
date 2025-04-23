package steps

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/cucumber/godog"
	"github.com/nats-io/nats.go/jetstream"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/client"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/kv"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/operator"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/schema"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/stream"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/tests/testutils"
)

type JoinOperatorTestSuite struct {
	natsContainer         *testutils.NATSContainer
	leftStreamConfig      *stream.ConsumerConfig
	rightStreamConfig     *stream.ConsumerConfig
	resultsConsumerConfig *stream.ConsumerConfig
	schemaConfig          *schema.Config
	joinOperator          *operator.JoinOperator
	wg                    sync.WaitGroup
	errCh                 chan error
}

func NewJoinOperatorTestSuite() *JoinOperatorTestSuite {
	return &JoinOperatorTestSuite{} //nolint:exhaustruct // basic struct
}

func (j *JoinOperatorTestSuite) aRunningNATSInstance() error {
	natsContainer, err := testutils.StartNATSContainer(context.Background())
	if err != nil {
		return fmt.Errorf("start nats container: %w", err)
	}

	j.natsContainer = natsContainer

	return nil
}

func (j *JoinOperatorTestSuite) aLeftStreamConsumerConfig(streamName, subjectName, consumerName string) error {
	j.leftStreamConfig = &stream.ConsumerConfig{
		NatsStream:   streamName,
		NatsConsumer: consumerName,
		NatsSubject:  subjectName,
		AckWait:      time.Duration(5) * time.Second,
	}
	return nil
}

func (j *JoinOperatorTestSuite) aRightStreamConsumerConfig(streamName, subjectName, consumerName string) error {
	j.rightStreamConfig = &stream.ConsumerConfig{
		NatsStream:   streamName,
		NatsConsumer: consumerName,
		NatsSubject:  subjectName,
		AckWait:      time.Duration(5) * time.Second,
	}
	return nil
}

func (j *JoinOperatorTestSuite) aResultsConsumerConfig(streamName, subjectName, consumerName string) error {
	j.resultsConsumerConfig = &stream.ConsumerConfig{
		NatsStream:   streamName,
		NatsConsumer: consumerName,
		NatsSubject:  subjectName,
		AckWait:      time.Duration(5) * time.Second,
	}
	return nil
}

func (j *JoinOperatorTestSuite) runningStream(streamName, subjectName string) error {
	natsWrap, err := stream.NewNATSWrapper(j.natsContainer.GetURI())
	if err != nil {
		return fmt.Errorf("create nats wrapper: %w", err)
	}
	defer natsWrap.Close()

	js := natsWrap.JetStream()

	// Create stream if not exists
	_, err = js.Stream(context.Background(), streamName)
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

func (j *JoinOperatorTestSuite) aRunningLeftStream() error {
	return j.runningStream(j.leftStreamConfig.NatsStream, j.leftStreamConfig.NatsSubject)
}

func (j *JoinOperatorTestSuite) aRunningRightStream() error {
	return j.runningStream(j.rightStreamConfig.NatsStream, j.rightStreamConfig.NatsSubject)
}

func (j *JoinOperatorTestSuite) aRunningResultsStream() error {
	return j.runningStream(j.resultsConsumerConfig.NatsStream, j.resultsConsumerConfig.NatsSubject)
}

func (j *JoinOperatorTestSuite) aSchemaConfigWithMapping(cfg *godog.DocString) error {
	err := json.Unmarshal([]byte(cfg.Content), &j.schemaConfig)
	if err != nil {
		return fmt.Errorf("unmarshal schema config: %w", err)
	}

	return nil
}

func (j *JoinOperatorTestSuite) iRunJoinOperator(leftTTL, rightTTL string) error {
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

	natsWrapper, err := client.NewNATSWrapper(j.natsContainer.GetURI(), 24*time.Hour)
	if err != nil {
		return fmt.Errorf("create nats wrapper: %w", err)
	}

	ctx := context.Background()

	leftKVStore, err := kv.NewNATSKeyValueStore(ctx, natsWrapper.JetStream(), kv.KeyValueStoreConfig{
		StoreName: j.leftStreamConfig.NatsStream,
		TTL:       lTTL,
	})
	if err != nil {
		return fmt.Errorf("create left kv store: %w", err)
	}

	rightKVStore, err := kv.NewNATSKeyValueStore(ctx, natsWrapper.JetStream(), kv.KeyValueStoreConfig{
		StoreName: j.rightStreamConfig.NatsStream,
		TTL:       rTTL,
	})
	if err != nil {
		return fmt.Errorf("create right kv store: %w", err)
	}

	leftStreamConsumer, err := stream.NewConsumer(ctx, natsWrapper.JetStream(), *j.leftStreamConfig)
	if err != nil {
		return fmt.Errorf("create left stream consumer: %w", err)
	}

	rightStreamConsumer, err := stream.NewConsumer(ctx, natsWrapper.JetStream(), *j.rightStreamConfig)
	if err != nil {
		return fmt.Errorf("create right stream consumer: %w", err)
	}

	resultsPublisher := stream.NewPublisher(natsWrapper.JetStream(), stream.PublisherConfig{
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

func (j *JoinOperatorTestSuite) iStopJoinOperatorNoWait(delay string) error {
	dur, err := time.ParseDuration(delay)
	if err != nil {
		return fmt.Errorf("parse duration: %w", err)
	}

	j.wg.Add(1)
	go func() {
		defer j.wg.Done()
		time.Sleep(dur)
		j.joinOperator.Stop(operator.WithNoWait(true))
	}()

	j.wg.Wait()

	select {
	case err, ok := <-j.errCh:
		if ok {
			return fmt.Errorf("error from join operator: %w", err)
		}
	default:
		// No error from operator
	}
	close(j.errCh)

	return nil
}

func (j *JoinOperatorTestSuite) iStopJoinOperatorGracefullyAfterDelay(delay string) error {
	dur, err := time.ParseDuration(delay)
	if err != nil {
		return fmt.Errorf("parse duration: %w", err)
	}

	j.wg.Add(1)
	go func() {
		defer j.wg.Done()
		time.Sleep(dur)
		j.joinOperator.Stop()
	}()

	j.wg.Wait()

	select {
	case err, ok := <-j.errCh:
		if ok {
			return fmt.Errorf("error from join operator: %w", err)
		}
	default:
		// No error from operator
	}
	close(j.errCh)

	return nil
}

func (j *JoinOperatorTestSuite) iPublishEventsToTheLeftStream(count int, dataTable *godog.Table) error {
	natsWrap, err := stream.NewNATSWrapper(j.natsContainer.GetURI())
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

		_, err = js.Publish(context.Background(), j.leftStreamConfig.NatsSubject, eventBytes)
		if err != nil {
			return fmt.Errorf("publish event: %w", err)
		}
	}

	return nil
}

func (j *JoinOperatorTestSuite) iPublishEventsToTheRightStream(count int, dataTable *godog.Table) error {
	natsWrap, err := stream.NewNATSWrapper(j.natsContainer.GetURI())
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

		_, err = js.Publish(context.Background(), j.rightStreamConfig.NatsSubject, eventBytes)
		if err != nil {
			return fmt.Errorf("publish event: %w", err)
		}
	}

	return nil
}

func (j *JoinOperatorTestSuite) iCheckResults(count int) error {
	var resultsCount, toFetch int
	natsWrap, err := stream.NewNATSWrapper(j.natsContainer.GetURI())
	if err != nil {
		return fmt.Errorf("create nats wrapper: %w", err)
	}
	defer natsWrap.Close()

	js := natsWrap.JetStream()

	consumer, err := js.CreateOrUpdateConsumer(context.Background(), j.resultsConsumerConfig.NatsStream, jetstream.ConsumerConfig{ //nolint:exhaustruct // optional config
		Name:          j.resultsConsumerConfig.NatsConsumer,
		Durable:       j.resultsConsumerConfig.NatsConsumer,
		AckWait:       j.resultsConsumerConfig.AckWait,
		FilterSubject: j.resultsConsumerConfig.NatsSubject,
	})
	if err != nil {
		return fmt.Errorf("subscribe to results stream: %w", err)
	}

	// consumer all messages
	toFetch = max(count*2, 1)
	msgs, err := consumer.Fetch(toFetch, jetstream.FetchMaxWait(1000*time.Millisecond))
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

func (j *JoinOperatorTestSuite) iCheckResultsWithContent(dataTable *godog.Table) error {
	natsWrap, err := stream.NewNATSWrapper(j.natsContainer.GetURI())
	if err != nil {
		return fmt.Errorf("create nats wrapper: %w", err)
	}
	defer natsWrap.Close()

	js := natsWrap.JetStream()

	consumer, err := js.CreateOrUpdateConsumer(context.Background(), j.resultsConsumerConfig.NatsStream, jetstream.ConsumerConfig{ //nolint:exhaustruct // optional config
		Name:          j.resultsConsumerConfig.NatsConsumer,
		Durable:       j.resultsConsumerConfig.NatsConsumer,
		AckWait:       j.resultsConsumerConfig.AckWait,
		FilterSubject: j.resultsConsumerConfig.NatsSubject,
	})
	if err != nil {
		return fmt.Errorf("subscribe to results stream: %w", err)
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
	msgs, err := consumer.Fetch(2*expectedCount, jetstream.FetchMaxWait(1000*time.Millisecond))
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

func (j *JoinOperatorTestSuite) CleanupResources() error {
	if j.natsContainer != nil {
		err := j.natsContainer.Stop(context.Background())
		if err != nil {
			return fmt.Errorf("stop nats container: %w", err)
		}

		j.natsContainer = nil
	}

	return nil
}

func (j *JoinOperatorTestSuite) RegisterSteps(sc *godog.ScenarioContext) {
	sc.Step(`^a running NATS instance for operator test$`, j.aRunningNATSInstance)
	sc.Step(`^a left stream consumer config "([^"]*)" and subject "([^"]*)" and consumer "([^"]*)"$`, j.aLeftStreamConsumerConfig)
	sc.Step(`^a right stream consumer config "([^"]*)" and subject "([^"]*)" and consumer "([^"]*)"$`, j.aRightStreamConsumerConfig)
	sc.Step(`^a results consumer config "([^"]*)" and subject "([^"]*)" and consumer "([^"]*)"$`, j.aResultsConsumerConfig)

	sc.Step(`^a running left stream$`, j.aRunningLeftStream)
	sc.Step(`^a running right stream$`, j.aRunningRightStream)
	sc.Step(`^a running results stream$`, j.aRunningResultsStream)

	sc.Step(`^an operator schema config with mapping$`, j.aSchemaConfigWithMapping)
	sc.Step(`^I run join operator with left TTL "([^"]*)" right TTL "([^"]*)"$`, j.iRunJoinOperator)
	sc.Step(`^I stop join operator gracefully after "([^"]*)"$`, j.iStopJoinOperatorGracefullyAfterDelay)
	sc.Step(`^I stop join operator after "([^"]*)"$`, j.iStopJoinOperatorNoWait)
	sc.Step(`^I publish (\d+) events to the left stream$`, j.iPublishEventsToTheLeftStream)
	sc.Step(`^I publish (\d+) events to the right stream$`, j.iPublishEventsToTheRightStream)
	sc.Step(`^I check results count is (\d+)$`, j.iCheckResults)
	sc.Step(`^I check results with content$`, j.iCheckResultsWithContent)
	sc.After(func(ctx context.Context, _ *godog.Scenario, _ error) (context.Context, error) {
		cleanupErr := j.CleanupResources()
		if cleanupErr != nil {
			return ctx, cleanupErr
		}
		return ctx, nil
	})
}
