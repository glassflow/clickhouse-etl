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

func createStreamingComponent(
	ctx context.Context,
	t *testing.T,
	suite *steps.DedupTestSuite,
	js jetstream.JetStream,
	inputSubject, outputSubject string,
	dedupConfig *models.DeduplicationConfig,
	statelessTransform *models.StatelessTransformation,
	filterConfig *models.FilterComponentConfig,
	dlqSubject *string,
) *processor.StreamingComponent {
	consumer, err := js.CreateOrUpdateConsumer(ctx, "test-input", jetstream.ConsumerConfig{
		Name:          "test-streaming-consumer",
		Durable:       "test-streaming-consumer",
		FilterSubject: inputSubject,
		AckPolicy:     jetstream.AckAllPolicy,
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
		dedupProcessor = processor.NewDedupProcessor(badgerDedup, nil)
	} else {
		dedupProcessor = &processor.NoopProcessor{}
	}

	// Build stateless transformer processor
	var statelessTransformerProcessor processor.Processor
	if statelessTransform != nil && statelessTransform.Enabled {
		transformer, err := jsonTransformer.NewTransformer(statelessTransform.Config.Transform)
		require.NoError(t, err)
		statelessTransformerProcessorBase := processor.NewStatelessTransformerProcessor(transformer, nil)
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

	return processor.NewStreamingComponent(
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

func TestStreamingComponent_FilterWithDedupAndTransform(t *testing.T) {
	suite := steps.NewDedupTestSuite()
	require.NoError(t, suite.SetupResources())
	defer suite.CleanupResources()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	js := suite.GetNATSClient().JetStream()
	inputSubject, outputSubject := "test.streaming.combined.input", "test.streaming.combined.output"

	setupStreams(t, js, ctx, inputSubject, outputSubject)

	filterConfig := &models.FilterComponentConfig{
		Enabled:    true,
		Expression: `age < 18`, // Filter out minors
	}

	dedupConfig := &models.DeduplicationConfig{
		Enabled: true,
		Window:  *models.NewJSONDuration(time.Hour),
	}

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

	streamingComponent := createStreamingComponent(
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

	componentCtx, componentCancel := context.WithCancel(ctx)
	defer componentCancel()

	errCh := make(chan error, 1)
	go func() {
		errCh <- streamingComponent.Start(componentCtx)
	}()

	testMessages := []struct {
		msgID string
		data  string
	}{
		{"msg-1", `{"age": 15, "name": "alice"}`},   // Filtered out (age < 18)
		{"msg-2", `{"age": 25, "name": "bob"}`},     // Passes filter, deduped, transformed
		{"msg-2", `{"age": 25, "name": "bob"}`},     // Duplicate (deduped)
		{"msg-3", `{"age": 30, "name": "charlie"}`}, // Passes filter, deduped, transformed
		{"msg-4", `{"age": 10, "name": "dave"}`},    // Filtered out (age < 18)
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

	outputMessages := waitForMessages(t, js, ctx, outputSubject, 2, 1*time.Second)
	require.Len(t, outputMessages, 2, "should have 2 messages (bob and charlie)")

	streamingComponent.Shutdown()
	select {
	case err := <-errCh:
		require.NoError(t, err)
	case <-time.After(1 * time.Second):
		t.Fatal("component did not shut down in time")
	}

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

	for name, found := range expectedNames {
		require.True(t, found, "expected name %s not found in output", name)
	}
}

// waitForMessages polls the output stream until the expected number of messages appear or timeout
func waitForMessages(
	t *testing.T,
	js jetstream.JetStream,
	ctx context.Context,
	outputSubject string,
	expectedCount int,
	timeout time.Duration,
) []models.Message {
	deadline := time.Now().Add(timeout)
	pollInterval := 5 * time.Millisecond

	for time.Now().Before(deadline) {
		messages := readOutput(t, js, ctx, outputSubject)
		if len(messages) >= expectedCount {
			return messages
		}
		time.Sleep(pollInterval)
	}

	return readOutput(t, js, ctx, outputSubject)
}
