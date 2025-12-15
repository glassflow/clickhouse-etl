package tests

import (
	"context"
	"encoding/json"
	"log/slog"
	"testing"
	"time"

	"github.com/nats-io/nats.go"
	"github.com/nats-io/nats.go/jetstream"
	"github.com/stretchr/testify/require"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/deduplication"
	dedupBadger "github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/deduplication/badger"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/stream"
	jsonTransformer "github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/transformer/json"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/tests/steps"
)

func TestDeduplication_BasicDeduplication(t *testing.T) {
	// Arrange
	suite := steps.NewDedupTestSuite()
	require.NoError(t, suite.SetupResources())
	defer suite.CleanupResources()

	ctx := context.Background()
	jetStream := suite.GetNATSClient().JetStream()
	inputSubject, outputSubject := "test.input", "test.output"

	setupStreams(t, jetStream, ctx, inputSubject, outputSubject)
	dedupService := createService(t, suite, jetStream, ctx, inputSubject, outputSubject)

	publishMessages(t, jetStream, ctx, inputSubject, []string{"msg-1", "msg-2", "msg-1", "msg-3", "msg-2"})

	// Act
	require.NoError(t, dedupService.Process(ctx))

	// Assert
	outputMessages := readOutput(t, jetStream, ctx, outputSubject)
	require.Len(t, outputMessages, 3, "should deduplicate 5 messages to 3 unique")
}

func TestDeduplication_FailureDoesNotAckMessages(t *testing.T) {
	// Arrange
	suite := steps.NewDedupTestSuite()
	require.NoError(t, suite.SetupResources())
	defer suite.CleanupResources()

	ctx := context.Background()
	js := suite.GetNATSClient().JetStream()
	inputSubject, outputSubject := "test.failure.input", "test.failure.output"

	setupStreams(t, js, ctx, inputSubject, outputSubject)
	dedupService := createService(t, suite, js, ctx, inputSubject, outputSubject)

	publishMessages(t, js, ctx, inputSubject, []string{"msg-1", "msg-2"})

	// Close Badger DB to cause deduplication failure
	require.NoError(t, suite.GetBadgerDB().Close())

	// Act
	err := dedupService.Process(ctx)

	// Assert
	require.Error(t, err)

	// Verify messages still in input stream (not acked)
	consumer, err := js.Consumer(ctx, "test-input", "test-consumer")
	require.NoError(t, err)
	reader := stream.NewBatchReader(consumer, slog.Default())
	availableMessages, err := reader.ReadBatchNoWait(ctx, 10)
	require.NoError(t, err)
	require.Len(t, availableMessages, 2, "messages should still be in input stream")

	// Verify no messages in output stream
	outputMessages := readOutput(t, js, ctx, outputSubject)
	require.Len(t, outputMessages, 0, "no messages should be in output stream")
}

func setupStreams(t *testing.T, js jetstream.JetStream, ctx context.Context, inputSubject, outputSubject string) {
	_, err := js.CreateStream(ctx, jetstream.StreamConfig{
		Name:       "test-input",
		Subjects:   []string{inputSubject},
		Storage:    jetstream.MemoryStorage,
		Duplicates: 0,
	})
	require.NoError(t, err)

	_, err = js.CreateStream(ctx, jetstream.StreamConfig{
		Name:       "test-output",
		Subjects:   []string{outputSubject},
		Storage:    jetstream.MemoryStorage,
		Duplicates: 0,
	})
	require.NoError(t, err)
}

func createService(t *testing.T, suite *steps.DedupTestSuite, js jetstream.JetStream, ctx context.Context, inputSubject, outputSubject string) *deduplication.DedupService {
	consumer, err := js.CreateOrUpdateConsumer(ctx, "test-input", jetstream.ConsumerConfig{
		Name:          "test-consumer",
		FilterSubject: inputSubject,
	})
	require.NoError(t, err)

	reader := stream.NewBatchReader(consumer, slog.Default())
	publisher := stream.NewNATSPublisher(js, stream.PublisherConfig{Subject: outputSubject})
	writer := stream.NewNatsBatchWriter(publisher, nil, slog.Default(), 1000)
	deduplicator := dedupBadger.NewDeduplicator(suite.GetBadgerDB(), time.Hour)

	service, err := deduplication.NewDedupService(
		reader,
		writer,
		nil, // no dlqWriter for basic tests
		nil, // no transformer for basic tests
		deduplicator,
		slog.Default(),
		100,
		time.Millisecond,
	)
	require.NoError(t, err)
	return service
}

func publishMessages(t *testing.T, js jetstream.JetStream, ctx context.Context, subject string, msgIDs []string) {
	for _, msgID := range msgIDs {
		msg := &nats.Msg{
			Subject: subject,
			Data:    []byte(`{"value": "test"}`),
			Header:  nats.Header{"Nats-Msg-Id": []string{msgID}},
		}
		_, err := js.PublishMsg(ctx, msg)
		require.NoError(t, err)
	}
}

func readOutput(t *testing.T, js jetstream.JetStream, ctx context.Context, outputSubject string) []jetstream.Msg {
	consumer, err := js.CreateOrUpdateConsumer(ctx, "test-output", jetstream.ConsumerConfig{
		Name:          "output-consumer",
		FilterSubject: outputSubject,
	})
	require.NoError(t, err)

	reader := stream.NewBatchReader(consumer, slog.Default())
	messages, err := reader.ReadBatchNoWait(ctx, 10)
	require.NoError(t, err)
	return messages
}

func readDLQ(t *testing.T, js jetstream.JetStream, ctx context.Context, dlqSubject string) []jetstream.Msg {
	consumer, err := js.CreateOrUpdateConsumer(ctx, "test-dlq", jetstream.ConsumerConfig{
		Name:          "dlq-consumer",
		FilterSubject: dlqSubject,
	})
	require.NoError(t, err)

	reader := stream.NewBatchReader(consumer, slog.Default())
	messages, err := reader.ReadBatchNoWait(ctx, 10)
	require.NoError(t, err)
	return messages
}

func TestDeduplication_SuccessfulTransformation(t *testing.T) {
	// Arrange
	suite := steps.NewDedupTestSuite()
	require.NoError(t, suite.SetupResources())
	defer suite.CleanupResources()

	ctx := context.Background()
	js := suite.GetNATSClient().JetStream()
	inputSubject, outputSubject := "test.transform.input", "test.transform.output"

	setupStreams(t, js, ctx, inputSubject, outputSubject)

	// Create service with transformer using hasPrefix function
	consumer, err := js.CreateOrUpdateConsumer(ctx, "test-input", jetstream.ConsumerConfig{
		Name:          "test-consumer",
		FilterSubject: inputSubject,
	})
	require.NoError(t, err)

	reader := stream.NewBatchReader(consumer, slog.Default())
	publisher := stream.NewNATSPublisher(js, stream.PublisherConfig{Subject: outputSubject})
	writer := stream.NewNatsBatchWriter(publisher, nil, slog.Default(), 1000)
	deduplicator := dedupBadger.NewDeduplicator(suite.GetBadgerDB(), time.Hour)

	// Create transformer using hasPrefix and upper functions
	transformer, err := jsonTransformer.NewTransformer([]models.Transform{
		{
			Expression: `hasPrefix(text, "hello")`,
			OutputName: "has_hello_prefix",
			OutputType: "bool",
		},
		{
			Expression: `upper(text)`,
			OutputName: "uppercase_text",
			OutputType: "string",
		},
	})
	require.NoError(t, err)

	service, err := deduplication.NewDedupService(
		reader,
		writer,
		nil, // no dlqWriter for this test
		transformer,
		deduplicator,
		slog.Default(),
		100,
		time.Millisecond,
	)
	require.NoError(t, err)

	// Publish messages with custom data
	for _, msgID := range []string{"msg-1", "msg-2"} {
		msg := &nats.Msg{
			Subject: inputSubject,
			Data:    []byte(`{"text": "hello world"}`),
			Header:  nats.Header{"Nats-Msg-Id": []string{msgID}},
		}
		_, err := js.PublishMsg(ctx, msg)
		require.NoError(t, err)
	}

	// Act
	require.NoError(t, service.Process(ctx))

	// Assert
	outputMessages := readOutput(t, js, ctx, outputSubject)
	require.Len(t, outputMessages, 2, "should have 2 transformed messages")

	// Verify transformation was applied correctly
	expectedOutput := map[string]any{
		"has_hello_prefix": true,
		"uppercase_text":   "HELLO WORLD",
	}

	for _, msg := range outputMessages {
		var actualOutput map[string]any
		err := json.Unmarshal(msg.Data(), &actualOutput)
		require.NoError(t, err, "should unmarshal output JSON")
		require.Equal(t, expectedOutput, actualOutput, "transformed output should match expected")
	}
}

func TestDeduplication_TransformationMisspelledReturnsDefault(t *testing.T) {
	// Arrange
	suite := steps.NewDedupTestSuite()
	require.NoError(t, suite.SetupResources())
	defer suite.CleanupResources()

	ctx := context.Background()
	js := suite.GetNATSClient().JetStream()
	inputSubject, outputSubject, dlqSubject := "test.dlq.input", "test.dlq.output", "test.dlq.dead"

	setupStreams(t, js, ctx, inputSubject, outputSubject)

	// Create DLQ stream
	_, err := js.CreateStream(ctx, jetstream.StreamConfig{
		Name:       "test-dlq",
		Subjects:   []string{dlqSubject},
		Storage:    jetstream.MemoryStorage,
		Duplicates: 0,
	})
	require.NoError(t, err)

	// Create service with transformer that will fail
	consumer, err := js.CreateOrUpdateConsumer(ctx, "test-input", jetstream.ConsumerConfig{
		Name:          "test-consumer",
		FilterSubject: inputSubject,
	})
	require.NoError(t, err)

	reader := stream.NewBatchReader(consumer, slog.Default())
	publisher := stream.NewNATSPublisher(js, stream.PublisherConfig{Subject: outputSubject})
	writer := stream.NewNatsBatchWriter(publisher, nil, slog.Default(), 1000)
	dlqPublisher := stream.NewNATSPublisher(js, stream.PublisherConfig{Subject: dlqSubject})
	dlqWriter := stream.NewNatsBatchWriter(dlqPublisher, nil, slog.Default(), 1000)
	deduplicator := dedupBadger.NewDeduplicator(suite.GetBadgerDB(), time.Hour)

	// Create transformer that will fail - tries to convert string to int
	transformer, err := jsonTransformer.NewTransformer([]models.Transform{
		{
			Expression: `containsStr(tet, "qwe")`, // misspelled should return ok
			OutputName: "number",
			OutputType: "bool",
		},
	})
	require.NoError(t, err)

	service, err := deduplication.NewDedupService(
		reader,
		writer,
		dlqWriter,
		transformer,
		deduplicator,
		slog.Default(),
		100,
		time.Millisecond,
	)
	require.NoError(t, err)

	// Publish messages that will fail transformation
	for _, msgID := range []string{"msg-1", "msg-2"} {
		msg := &nats.Msg{
			Subject: inputSubject,
			Data:    []byte(`{"text": "hello world"}`),
			Header:  nats.Header{"Nats-Msg-Id": []string{msgID}},
		}
		_, err := js.PublishMsg(ctx, msg)
		require.NoError(t, err)
	}

	// Act
	require.NoError(t, service.Process(ctx))

	// Assert
	outputMessages := readOutput(t, js, ctx, outputSubject)
	require.Len(t, outputMessages, 2, "no messages should be in output stream")

	dlqMessages := readDLQ(t, js, ctx, dlqSubject)
	require.Len(t, dlqMessages, 0, "all failed messages should be in DLQ")
}

func TestDeduplication_TransformationErrorsGoToDLQ(t *testing.T) {
	// Arrange
	suite := steps.NewDedupTestSuite()
	require.NoError(t, suite.SetupResources())
	defer suite.CleanupResources()

	ctx := context.Background()
	js := suite.GetNATSClient().JetStream()
	inputSubject, outputSubject, dlqSubject := "test.dlq.input", "test.dlq.output", "test.dlq.dead"

	setupStreams(t, js, ctx, inputSubject, outputSubject)

	// Create DLQ stream
	_, err := js.CreateStream(ctx, jetstream.StreamConfig{
		Name:       "test-dlq",
		Subjects:   []string{dlqSubject},
		Storage:    jetstream.MemoryStorage,
		Duplicates: 0,
	})
	require.NoError(t, err)

	// Create service with transformer that will fail
	consumer, err := js.CreateOrUpdateConsumer(ctx, "test-input", jetstream.ConsumerConfig{
		Name:          "test-consumer",
		FilterSubject: inputSubject,
	})
	require.NoError(t, err)

	reader := stream.NewBatchReader(consumer, slog.Default())
	publisher := stream.NewNATSPublisher(js, stream.PublisherConfig{Subject: outputSubject})
	writer := stream.NewNatsBatchWriter(publisher, nil, slog.Default(), 1000)
	dlqPublisher := stream.NewNATSPublisher(js, stream.PublisherConfig{Subject: dlqSubject})
	dlqWriter := stream.NewNatsBatchWriter(dlqPublisher, nil, slog.Default(), 1000)
	deduplicator := dedupBadger.NewDeduplicator(suite.GetBadgerDB(), time.Hour)

	// Create transformer that will fail - tries to convert string to int
	transformer, err := jsonTransformer.NewTransformer([]models.Transform{
		{
			Expression: `containsStr(tet)`, // not enough arguments
			OutputName: "number",
			OutputType: "bool",
		},
	})
	require.NoError(t, err)

	service, err := deduplication.NewDedupService(
		reader,
		writer,
		dlqWriter,
		transformer,
		deduplicator,
		slog.Default(),
		100,
		time.Millisecond,
	)
	require.NoError(t, err)

	// Publish messages that will fail transformation
	for _, msgID := range []string{"msg-1", "msg-2"} {
		msg := &nats.Msg{
			Subject: inputSubject,
			Data:    []byte(`{"text": "hello world"}`),
			Header:  nats.Header{"Nats-Msg-Id": []string{msgID}},
		}
		_, err := js.PublishMsg(ctx, msg)
		require.NoError(t, err)
	}

	// Act
	require.NoError(t, service.Process(ctx))

	// Assert
	outputMessages := readOutput(t, js, ctx, outputSubject)
	require.Len(t, outputMessages, 0, "no messages should be in output stream")

	dlqMessages := readDLQ(t, js, ctx, dlqSubject)
	require.Len(t, dlqMessages, 2, "all failed messages should be in DLQ")
}
