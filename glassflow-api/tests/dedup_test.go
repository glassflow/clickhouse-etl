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

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/batch"
	batchNats "github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/batch/nats"
	dedupBadger "github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/deduplication/badger"
	filterJSON "github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/filter/json"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/processor"
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

	dedupConfig := &models.DeduplicationConfig{
		Enabled: true,
		Window:  *models.NewJSONDuration(time.Hour),
	}
	component := createComponent(
		ctx,
		t,
		suite,
		jetStream,
		inputSubject,
		outputSubject,
		dedupConfig,
		nil, // statelessTransform
		nil, // filterConfig
		nil, // dlq
	)

	publishMessages(
		t,
		jetStream,
		ctx,
		inputSubject,
		[]string{"msg-1", "msg-2", "msg-1", "msg-3", "msg-2"},
	)

	// Act
	require.NoError(t, component.Process(ctx))

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

	dedupConfig := &models.DeduplicationConfig{
		Enabled: true,
		Window:  *models.NewJSONDuration(time.Hour),
	}
	component := createComponent(
		ctx,
		t,
		suite,
		js,
		inputSubject,
		outputSubject,
		dedupConfig,
		nil, // statelessTransform
		nil, // filterConfig
		nil, // dlq
	)

	publishMessages(t, js, ctx, inputSubject, []string{"msg-1", "msg-2"})

	// Close Badger DB to cause deduplication failure
	require.NoError(t, suite.GetBadgerDB().Close())

	// Act
	err := component.Process(ctx)

	// Assert
	require.Error(t, err)

	// Verify messages still in input stream (not acked)
	consumer, err := js.Consumer(ctx, "test-input", "test-consumer")
	require.NoError(t, err)
	reader := batchNats.NewBatchReader(consumer)
	availableMessages, err := reader.ReadBatchNoWait(ctx, models.WithBatchSize(10))
	require.NoError(t, err)
	require.Len(t, availableMessages, 2, "messages should still be in input stream")

	// Verify no messages in output stream
	outputMessages := readOutput(t, js, ctx, outputSubject)
	require.Len(t, outputMessages, 0, "no messages should be in output stream")
}

func setupStreams(
	t *testing.T,
	js jetstream.JetStream,
	ctx context.Context,
	inputSubject, outputSubject string,
) {
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

func createComponent(
	ctx context.Context,
	t *testing.T,
	suite *steps.DedupTestSuite,
	js jetstream.JetStream,
	inputSubject, outputSubject string,
	dedupConfig *models.DeduplicationConfig,
	statelessTransform *models.StatelessTransformation,
	filterConfig *models.FilterComponentConfig,
	dlqSubject *string,
) *processor.Component {
	consumer, err := js.CreateOrUpdateConsumer(ctx, "test-input", jetstream.ConsumerConfig{
		Name:          "test-consumer",
		Durable:       "test-consumer",
		FilterSubject: inputSubject,
		AckPolicy:     jetstream.AckExplicitPolicy,
		AckWait:       internal.NatsDefaultAckWait,
		MaxAckPending: -1,
	})
	require.NoError(t, err)

	reader := batchNats.NewBatchReader(consumer)
	writer := batchNats.NewBatchWriter(js, outputSubject)

	var dlqWriter batch.BatchWriter
	if dlqSubject != nil {
		dlqWriter = batchNats.NewBatchWriter(js, *dlqSubject)
	}

	role := internal.RoleDeduplicator

	// Build dedup processor
	var dedupProcessor processor.Processor
	if dedupConfig != nil && dedupConfig.Enabled {
		ttl := dedupConfig.Window.Duration()
		badgerDedup := dedupBadger.NewDeduplicator(suite.GetBadgerDB(), ttl)
		dedupProcessor = processor.NewDedupProcessor(badgerDedup)
	} else {
		dedupProcessor = &processor.NoopProcessor{}
	}

	// Build stateless transformer processor
	var statelessTransformerProcessor processor.Processor
	if statelessTransform != nil && statelessTransform.Enabled {
		transformer, err := jsonTransformer.NewTransformer(statelessTransform.Config.Transform)
		require.NoError(t, err)
		statelessTransformerProcessorBase := processor.NewStatelessTransformerProcessor(transformer)
		statelessTransformerProcessor = processor.ChainProcessors(
			processor.ChainMiddlewares(processor.DLQMiddleware(dlqWriter, role)),
			statelessTransformerProcessorBase,
		)
	} else {
		statelessTransformerProcessor = &processor.NoopProcessor{}
	}

	// Build filter processor
	var filterProcessor processor.Processor
	if filterConfig != nil && filterConfig.Enabled {
		filterJson, err := filterJSON.New(filterConfig.Expression, filterConfig.Enabled)
		require.NoError(t, err)
		filterProcessorBase := processor.NewFilterProcessor(filterJson, nil) // nil meter for tests
		filterProcessor = processor.ChainProcessors(
			processor.ChainMiddlewares(processor.DLQMiddleware(dlqWriter, role)),
			filterProcessorBase,
		)
	} else {
		filterProcessor = &processor.NoopProcessor{}
	}

	return processor.NewComponent(
		reader,
		writer,
		dlqWriter,
		slog.Default(),
		role,
		[]processor.Processor{
			filterProcessor,
			dedupProcessor,
			statelessTransformerProcessor,
		},
	)
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

func readOutput(t *testing.T, js jetstream.JetStream, ctx context.Context, outputSubject string) []models.Message {
	consumer, err := js.CreateOrUpdateConsumer(ctx, "test-output", jetstream.ConsumerConfig{
		Name:          "output-consumer",
		FilterSubject: outputSubject,
	})
	require.NoError(t, err)

	reader := batchNats.NewBatchReader(consumer)
	messages, err := reader.ReadBatchNoWait(ctx, models.WithBatchSize(10))
	require.NoError(t, err)
	return messages
}

func readDLQ(t *testing.T, js jetstream.JetStream, ctx context.Context, dlqSubject string) []models.Message {
	consumer, err := js.CreateOrUpdateConsumer(ctx, "test-dlq", jetstream.ConsumerConfig{
		Name:          "dlq-consumer",
		FilterSubject: dlqSubject,
	})
	require.NoError(t, err)

	reader := batchNats.NewBatchReader(consumer)
	messages, err := reader.ReadBatchNoWait(ctx, models.WithBatchSize(10))
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

	// Create transformer using hasPrefix and upper functions
	statelessTransform := &models.StatelessTransformation{
		Enabled: true,
		Config: models.StatelessTransformationsConfig{
			Transform: []models.Transform{
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
			},
		},
	}

	component := createComponent(ctx, t, suite, js, inputSubject, outputSubject, nil, statelessTransform, nil, nil)

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
	require.NoError(t, component.Process(ctx))

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
		err := json.Unmarshal(msg.Payload(), &actualOutput)
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

	// Create transformer that will fail - misspelled field should return default
	statelessTransform := &models.StatelessTransformation{
		Enabled: true,
		Config: models.StatelessTransformationsConfig{
			Transform: []models.Transform{
				{
					Expression: `containsStr(tet, "qwe")`, // misspelled should return ok
					OutputName: "number",
					OutputType: "bool",
				},
			},
		},
	}

	component := createComponent(
		ctx,
		t,
		suite,
		js,
		inputSubject,
		outputSubject,
		nil, // dedup
		statelessTransform,
		nil, // filterConfig
		&dlqSubject,
	)

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
	require.NoError(t, component.Process(ctx))

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

	// Create transformer that will fail - not enough arguments
	statelessTransform := &models.StatelessTransformation{
		Enabled: true,
		Config: models.StatelessTransformationsConfig{
			Transform: []models.Transform{
				{
					Expression: `containsStr(tet)`, // not enough arguments
					OutputName: "number",
					OutputType: "bool",
				},
			},
		},
	}

	component := createComponent(ctx, t, suite, js, inputSubject, outputSubject, nil, statelessTransform, nil, &dlqSubject)

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
	require.NoError(t, component.Process(ctx))

	// Assert
	outputMessages := readOutput(t, js, ctx, outputSubject)
	require.Len(t, outputMessages, 0, "no messages should be in output stream")

	dlqMessages := readDLQ(t, js, ctx, dlqSubject)
	require.Len(t, dlqMessages, 2, "all failed messages should be in DLQ")
}

func TestDeduplication_BasicFiltering(t *testing.T) {
	// Arrange
	suite := steps.NewDedupTestSuite()
	require.NoError(t, suite.SetupResources())
	defer suite.CleanupResources()

	ctx := context.Background()
	js := suite.GetNATSClient().JetStream()
	inputSubject, outputSubject := "test.filter.input", "test.filter.output"

	setupStreams(t, js, ctx, inputSubject, outputSubject)

	filterConfig := &models.FilterComponentConfig{
		Enabled:    true,
		Expression: `age < 18`, // Filter out minors
	}

	component := createComponent(
		ctx,
		t,
		suite,
		js,
		inputSubject,
		outputSubject,
		nil,          // dedup
		nil,          // statelessTransform
		filterConfig, // filter
		nil,          // dlq
	)

	// Publish 3 messages: 2 match filter (dropped), 1 doesn't match (passes through)
	for _, data := range []string{`{"age": 15}`, `{"age": 25}`, `{"age": 10}`} {
		msg := &nats.Msg{
			Subject: inputSubject,
			Data:    []byte(data),
		}
		_, err := js.PublishMsg(ctx, msg)
		require.NoError(t, err)
	}

	// Act
	require.NoError(t, component.Process(ctx))

	// Assert
	outputMessages := readOutput(t, js, ctx, outputSubject)
	require.Len(t, outputMessages, 1, "should have 1 message (age >= 18)")

	// Verify it's the correct message
	var payload map[string]any
	err := json.Unmarshal(outputMessages[0].Payload(), &payload)
	require.NoError(t, err)
	require.Equal(t, float64(25), payload["age"], "output should be the age:25 message")
}

func TestDeduplication_FilterWithDedupAndTransform(t *testing.T) {
	// Arrange
	suite := steps.NewDedupTestSuite()
	require.NoError(t, suite.SetupResources())
	defer suite.CleanupResources()

	ctx := context.Background()
	js := suite.GetNATSClient().JetStream()
	inputSubject, outputSubject := "test.combined.input", "test.combined.output"

	setupStreams(t, js, ctx, inputSubject, outputSubject)

	// Filter: keep only adults (age >= 18)
	filterConfig := &models.FilterComponentConfig{
		Enabled:    true,
		Expression: `age < 18`, // Filter out minors
	}

	// Deduplication: enabled with 1 hour window
	dedupConfig := &models.DeduplicationConfig{
		Enabled: true,
		Window:  *models.NewJSONDuration(time.Hour),
	}

	// Transformation: uppercase the name field
	statelessTransform := &models.StatelessTransformation{
		Enabled: true,
		Config: models.StatelessTransformationsConfig{
			Transform: []models.Transform{
				{
					Expression: `upper(name)`,
					OutputName: "uppercase_name",
					OutputType: "string",
				},
			},
		},
	}

	component := createComponent(
		ctx,
		t,
		suite,
		js,
		inputSubject,
		outputSubject,
		dedupConfig,
		statelessTransform,
		filterConfig,
		nil, // dlq
	)

	// Publish test messages
	testMessages := []struct {
		msgID string
		data  string
	}{
		{"msg-1", `{"age": 15, "name": "alice"}`},  // Filtered out (age < 18)
		{"msg-2", `{"age": 25, "name": "bob"}`},    // Passes filter, deduped, transformed
		{"msg-2", `{"age": 25, "name": "bob"}`},    // Duplicate (deduped)
		{"msg-3", `{"age": 30, "name": "charlie"}`}, // Passes filter, deduped, transformed
		{"msg-4", `{"age": 10, "name": "dave"}`},   // Filtered out (age < 18)
	}

	for _, tm := range testMessages {
		msg := &nats.Msg{
			Subject: inputSubject,
			Data:    []byte(tm.data),
			Header:  nats.Header{"Nats-Msg-Id": []string{tm.msgID}},
		}
		_, err := js.PublishMsg(ctx, msg)
		require.NoError(t, err)
	}

	// Act
	require.NoError(t, component.Process(ctx))

	// Assert
	outputMessages := readOutput(t, js, ctx, outputSubject)
	require.Len(t, outputMessages, 2, "should have 2 messages (bob and charlie)")

	// Verify transformations
	expectedNames := map[string]bool{"BOB": false, "CHARLIE": false}
	for _, msg := range outputMessages {
		var payload map[string]any
		err := json.Unmarshal(msg.Payload(), &payload)
		require.NoError(t, err)

		uppercaseName, ok := payload["uppercase_name"].(string)
		require.True(t, ok, "uppercase_name field should exist and be a string")

		_, expectedName := expectedNames[uppercaseName]
		require.True(t, expectedName, "unexpected name in output: %s", uppercaseName)
		expectedNames[uppercaseName] = true
	}

	// Verify all expected names were found
	for name, found := range expectedNames {
		require.True(t, found, "expected name %s not found in output", name)
	}
}
