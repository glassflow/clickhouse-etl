package steps

import (
	"context"
	"encoding/json"
	"fmt"
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
		NatsURL:        j.natsContainer.GetURI(),
		NatsStream:     streamName,
		NatsConsumer:   consumerName,
		NatsSubject:    subjectName,
		AckWaitSeconds: 5,
	}
	return nil
}

func (j *JoinOperatorTestSuite) aRightStreamConsumerConfig(streamName, subjectName, consumerName string) error {
	j.rightStreamConfig = &stream.ConsumerConfig{
		NatsURL:        j.natsContainer.GetURI(),
		NatsStream:     streamName,
		NatsConsumer:   consumerName,
		NatsSubject:    subjectName,
		AckWaitSeconds: 5,
	}
	return nil
}

func (j *JoinOperatorTestSuite) aResultsConsumerConfig(streamName, subjectName, consumerName string) error {
	j.resultsConsumerConfig = &stream.ConsumerConfig{
		NatsURL:        j.natsContainer.GetURI(),
		NatsStream:     streamName,
		NatsConsumer:   consumerName,
		NatsSubject:    subjectName,
		AckWaitSeconds: 5,
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

func (j *JoinOperatorTestSuite) iRunJoinOperator(leftTTL, rightTTL, runDuration string) error {
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

	rDuration, err := time.ParseDuration(runDuration)
	if err != nil {
		return fmt.Errorf("parse run duration: %w", err)
	}

	natsWrapper, err := client.NewNATSWrapper(j.natsContainer.GetURI())
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

	wg := sync.WaitGroup{}
	errCh := make(chan error, 1)

	wg.Add(1)
	go func() {
		defer wg.Done()
		operator.Start(ctx, errCh)
	}()

	wg.Add(1)
	go func() {
		defer wg.Done()
		time.Sleep(rDuration)
		operator.Stop()
	}()

	wg.Wait()

	select {
	case err, ok := <-errCh:
		if ok {
			return fmt.Errorf("error from join operator: %w", err)
		}
	default:
		// No error from operator
	}
	close(errCh)

	return nil
}

func (j *JoinOperatorTestSuite) iPublishEventsToTheLeftStream(count int, dataTable *godog.Table) error {
	natsWrap, err := stream.NewNATSWrapper(j.leftStreamConfig.NatsURL)
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
	natsWrap, err := stream.NewNATSWrapper(j.leftStreamConfig.NatsURL)
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
	var resultsCount int
	natsWrap, err := stream.NewNATSWrapper(j.resultsConsumerConfig.NatsURL)
	if err != nil {
		return fmt.Errorf("create nats wrapper: %w", err)
	}
	defer natsWrap.Close()

	js := natsWrap.JetStream()

	consumer, err := js.CreateOrUpdateConsumer(context.Background(), j.resultsConsumerConfig.NatsStream, jetstream.ConsumerConfig{
		Name:          j.resultsConsumerConfig.NatsConsumer,
		Durable:       j.resultsConsumerConfig.NatsConsumer,
		AckWait:       time.Duration(j.resultsConsumerConfig.AckWaitSeconds) * time.Second,
		FilterSubject: j.resultsConsumerConfig.NatsSubject,
	})
	if err != nil {
		return fmt.Errorf("subscribe to results stream: %w", err)
	}

	// consumer all messages
	msgs, err := consumer.Fetch(2*count, jetstream.FetchMaxWait(1000*time.Millisecond))
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

func (j *JoinOperatorTestSuite) CleanupResources() error {
	if j.natsContainer != nil {
		err := j.natsContainer.Stop(context.Background())
		if err != nil {
			return fmt.Errorf("stop nats container: %w", err)
		}
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
	sc.Step(`^I run join operator with left TTL "([^"]*)" right TTL "([^"]*)" for "([^"]*)"$`, j.iRunJoinOperator)
	sc.Step(`^I publish (\d+) events to the left stream$`, j.iPublishEventsToTheLeftStream)
	sc.Step(`^I publish (\d+) events to the right stream$`, j.iPublishEventsToTheRightStream)
	sc.Step(`^I check results count is (\d+)$`, j.iCheckResults)
}
