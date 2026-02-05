package versioned

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/nats-io/nats.go/jetstream"
	"github.com/stretchr/testify/require"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/client"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/componentsignals"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/storage/postgres"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/tests/testutils"
)

func setupPostgres(t *testing.T) (*postgres.PostgresStorage, *pgxpool.Pool, *testutils.PostgresContainer, context.Context) {
	ctx := context.Background()
	container, err := testutils.StartPostgresContainer(ctx)
	require.NoError(t, err)

	storage, err := postgres.NewPostgres(ctx, container.GetDSN(), nil, nil)
	require.NoError(t, err)

	testPool, err := pgxpool.New(ctx, container.GetDSN())
	require.NoError(t, err)

	return storage, testPool, container, ctx
}

func cleanupPostgres(
	t *testing.T,
	storage *postgres.PostgresStorage,
	testPool *pgxpool.Pool,
	container *testutils.PostgresContainer,
	ctx context.Context,
) {
	if testPool != nil {
		testPool.Close()
	}
	if storage != nil {
		err := storage.Close()
		require.NoError(t, err)
	}
	if container != nil {
		err := container.Stop(ctx)
		require.NoError(t, err)
	}
}

func setupNATS(t *testing.T, ctx context.Context) (*client.NATSClient, *componentsignals.ComponentSignalPublisher, *testutils.NATSContainer) {
	natsContainer, err := testutils.StartNATSContainer(ctx)
	require.NoError(t, err)

	natsClient, err := client.NewNATSClient(ctx, natsContainer.GetURI())
	require.NoError(t, err)

	js := natsClient.JetStream()

	streamName := models.ComponentSignalsStream
	subject := models.GetComponentSignalsSubject()

	_, err = js.CreateStream(ctx, jetstream.StreamConfig{
		Name:     streamName,
		Subjects: []string{subject},
	})
	require.NoError(t, err)

	publisher, err := componentsignals.NewPublisher(natsClient)
	require.NoError(t, err)

	return natsClient, publisher, natsContainer
}

func cleanupNATS(t *testing.T, ctx context.Context, natsClient *client.NATSClient, natsContainer *testutils.NATSContainer) {
	if natsClient != nil {
		natsClient.Close()
	}
	if natsContainer != nil {
		err := natsContainer.Stop(ctx)
		require.NoError(t, err)
	}
}

func insertConnection(t *testing.T, ctx context.Context, pool *pgxpool.Pool, connType string) string {
	connID := uuid.New().String()
	query := `
		INSERT INTO connections (id, type, config, created_at, updated_at)
		VALUES ($1, $2, '{}', NOW(), NOW())
	`
	_, err := pool.Exec(ctx, query, connID, connType)
	require.NoError(t, err)
	return connID
}

func insertSource(t *testing.T, ctx context.Context, pool *pgxpool.Pool, connectionID string) string {
	sourceID := uuid.New().String()
	query := `
		INSERT INTO sources (id, type, connection_id, config, created_at, updated_at)
		VALUES ($1, 'kafka', $2, '{}', NOW(), NOW())
	`
	_, err := pool.Exec(ctx, query, sourceID, connectionID)
	require.NoError(t, err)
	return sourceID
}

func insertSink(t *testing.T, ctx context.Context, pool *pgxpool.Pool, connectionID string) string {
	sinkID := uuid.New().String()
	query := `
		INSERT INTO sinks (id, type, connection_id, config, created_at, updated_at)
		VALUES ($1, 'clickhouse', $2, '{}', NOW(), NOW())
	`
	_, err := pool.Exec(ctx, query, sinkID, connectionID)
	require.NoError(t, err)
	return sinkID
}

func insertPipeline(t *testing.T, ctx context.Context, pool *pgxpool.Pool, pipelineID string) {
	kafkaConnID := insertConnection(t, ctx, pool, "kafka")
	sourceID := insertSource(t, ctx, pool, kafkaConnID)

	chConnID := insertConnection(t, ctx, pool, "clickhouse")
	sinkID := insertSink(t, ctx, pool, chConnID)

	query := `
		INSERT INTO pipelines (id, name, status, source_id, sink_id, transformation_ids, metadata, version, created_at, updated_at)
		VALUES ($1, 'test', 'Created', $2, $3, '{}', '{}', 'v2', NOW(), NOW())
	`
	_, err := pool.Exec(ctx, query, pipelineID, sourceID, sinkID)
	require.NoError(t, err)
}

func insertTransformConfig(
	t *testing.T,
	ctx context.Context,
	pool *pgxpool.Pool,
	pipelineID, sourceID, schemaVersionID, transformID, outputVersionID string,
	transforms []models.Transform,
) {
	configJSON, err := json.Marshal(transforms)
	require.NoError(t, err)

	query := `
		INSERT INTO transformation_configs
		(pipeline_id, source_id, schema_version_id, transformation_id, output_schema_version_id, config)
		VALUES ($1, $2, $3, $4, $5, $6)
	`
	_, err = pool.Exec(ctx, query, pipelineID, sourceID, schemaVersionID, transformID, outputVersionID, configJSON)
	require.NoError(t, err)
}

func createMessage(payload []byte, schemaVersionID string) models.Message {
	msg := models.NewNatsMessage(payload, nil)
	if schemaVersionID != "" {
		msg.AddHeader(internal.SchemaVersionIDHeader, schemaVersionID)
	}
	return msg
}

func getSignalCount(t *testing.T, ctx context.Context, js jetstream.JetStream) uint64 {
	stream, err := js.Stream(ctx, models.ComponentSignalsStream)
	require.NoError(t, err)

	info, err := stream.Info(ctx)
	require.NoError(t, err)

	return info.State.Msgs
}

func consumeSignals(t *testing.T, ctx context.Context, js jetstream.JetStream, count int) []models.ComponentSignal {
	consumer, err := js.CreateOrUpdateConsumer(ctx, models.ComponentSignalsStream, jetstream.ConsumerConfig{
		AckPolicy: jetstream.AckExplicitPolicy,
	})
	require.NoError(t, err)

	signals := make([]models.ComponentSignal, 0, count)

	for range count {
		messages, err := consumer.Fetch(1, jetstream.FetchMaxWait(time.Second))
		require.NoError(t, err)

		for msg := range messages.Messages() {
			var signal models.ComponentSignal
			err := json.Unmarshal(msg.Data(), &signal)
			require.NoError(t, err)
			signals = append(signals, signal)

			err = msg.Ack()
			require.NoError(t, err)
		}
	}

	return signals
}

func TestVersionedTransformer_Transform(t *testing.T) {
	ctx := context.Background()

	storage, testPool, pgContainer, pgCtx := setupPostgres(t)
	defer cleanupPostgres(t, storage, testPool, pgContainer, pgCtx)

	natsClient, publisher, natsContainer := setupNATS(t, ctx)
	defer cleanupNATS(t, ctx, natsClient, natsContainer)

	pipelineID := "test-pipeline"
	sourceID := "test-source"

	insertPipeline(t, ctx, testPool, pipelineID)

	tests := []struct {
		name            string
		schemaVersionID string
		transforms      []models.Transform
		outputVersionID string
		input           string
		expectedOutput  string
		wantErr         bool
		expectSignal    bool
	}{
		{
			name:            "basic transformation - uppercase",
			schemaVersionID: "version-1",
			transforms: []models.Transform{
				{Expression: "upper(name)", OutputName: "NAME", OutputType: "string"},
			},
			outputVersionID: "out-1",
			input:           `{"name":"alice"}`,
			expectedOutput:  `{"NAME":"ALICE"}`,
			wantErr:         false,
			expectSignal:    false,
		},
		{
			name:            "multiple transforms",
			schemaVersionID: "version-2",
			transforms: []models.Transform{
				{Expression: "upper(name)", OutputName: "name_upper", OutputType: "string"},
				{Expression: "lower(email)", OutputName: "email_lower", OutputType: "string"},
			},
			outputVersionID: "out-2",
			input:           `{"name":"Bob","email":"BOB@EXAMPLE.COM"}`,
			expectedOutput:  `{"name_upper":"BOB","email_lower":"bob@example.com"}`,
			wantErr:         false,
			expectSignal:    false,
		},
		{
			name:            "transformation with number operations",
			schemaVersionID: "version-3",
			transforms: []models.Transform{
				{Expression: "age * 2", OutputName: "double_age", OutputType: "int"},
				{Expression: "price + 10", OutputName: "price_plus_ten", OutputType: "int"},
			},
			outputVersionID: "out-3",
			input:           `{"age":25,"price":100}`,
			expectedOutput:  `{"double_age":50,"price_plus_ten":110}`,
			wantErr:         false,
			expectSignal:    false,
		},
		{
			name:            "cache hit - same version used twice",
			schemaVersionID: "version-1",
			transforms:      nil,
			outputVersionID: "out-1",
			input:           `{"name":"charlie"}`,
			expectedOutput:  `{"NAME":"CHARLIE"}`,
			wantErr:         false,
			expectSignal:    false,
		},
		{
			name:            "missing config - signal sent",
			schemaVersionID: "non-existent-version",
			transforms:      nil,
			outputVersionID: "",
			input:           `{"name":"dave"}`,
			expectedOutput:  "",
			wantErr:         false,
			expectSignal:    true,
		},
	}

	initialSignalCount := getSignalCount(t, ctx, natsClient.JetStream())

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.transforms != nil {
				insertTransformConfig(t, ctx, testPool, pipelineID, sourceID,
					tt.schemaVersionID, "transform-1", tt.outputVersionID, tt.transforms)
			}

			transformer := New(storage, publisher, pipelineID, sourceID)

			msg := createMessage([]byte(tt.input), tt.schemaVersionID)
			output, err := transformer.Transform(ctx, msg)

			if tt.expectSignal {
				require.ErrorIs(t, err, models.ErrSignalSent)

				currentSignalCount := getSignalCount(t, ctx, natsClient.JetStream())
				require.Equal(t, initialSignalCount+1, currentSignalCount, "expected one signal to be sent")

				signals := consumeSignals(t, ctx, natsClient.JetStream(), 1)
				require.Len(t, signals, 1)
				require.Equal(t, pipelineID, signals[0].PipelineID)
				require.Equal(t, internal.RoleDeduplicator, signals[0].Component)
				require.NotEmpty(t, signals[0].Reason)
				require.NotEmpty(t, signals[0].Text)

				return
			}

			if tt.wantErr {
				require.Error(t, err)
				return
			}

			require.NoError(t, err)

			currentSignalCount := getSignalCount(t, ctx, natsClient.JetStream())
			require.Equal(t, initialSignalCount, currentSignalCount, "no signal should be sent")

			var actualPayload map[string]any
			err = json.Unmarshal(output.Payload(), &actualPayload)
			require.NoError(t, err)

			var expectedPayload map[string]any
			err = json.Unmarshal([]byte(tt.expectedOutput), &expectedPayload)
			require.NoError(t, err)

			require.Equal(t, expectedPayload, actualPayload)

			outputVersionHeader := output.GetHeader(internal.SchemaVersionIDHeader)
			require.Equal(t, tt.outputVersionID, outputVersionHeader)
		})
	}
}

func TestVersionedTransformer_TransformWithoutSchemaVersion(t *testing.T) {
	ctx := context.Background()

	storage, testPool, pgContainer, pgCtx := setupPostgres(t)
	defer cleanupPostgres(t, storage, testPool, pgContainer, pgCtx)

	natsClient, publisher, natsContainer := setupNATS(t, ctx)
	defer cleanupNATS(t, ctx, natsClient, natsContainer)

	pipelineID := "test-pipeline-2"
	sourceID := "test-source-2"

	insertPipeline(t, ctx, testPool, pipelineID)

	transformer := New(storage, publisher, pipelineID, sourceID)

	msg := createMessage([]byte(`{"name":"test"}`), "")
	output, err := transformer.Transform(ctx, msg)

	require.ErrorIs(t, models.ErrSchemaIDIsMissingInHeader, err)
	require.Equal(t, msg.Payload(), output.Payload())

	signalCount := getSignalCount(t, ctx, natsClient.JetStream())
	require.Equal(t, uint64(0), signalCount)
}

func TestVersionedTransformer_CompilationError(t *testing.T) {
	ctx := context.Background()

	storage, testPool, pgContainer, pgCtx := setupPostgres(t)
	defer cleanupPostgres(t, storage, testPool, pgContainer, pgCtx)

	natsClient, publisher, natsContainer := setupNATS(t, ctx)
	defer cleanupNATS(t, ctx, natsClient, natsContainer)

	pipelineID := "test-pipeline-3"
	sourceID := "test-source-3"

	insertPipeline(t, ctx, testPool, pipelineID)

	schemaVersionID := "version-invalid"
	transforms := []models.Transform{
		{Expression: "invalid_expression(((", OutputName: "result", OutputType: "string"},
	}
	insertTransformConfig(t, ctx, testPool, pipelineID, sourceID,
		schemaVersionID, "transform-1", "out-1", transforms)

	transformer := New(storage, publisher, pipelineID, sourceID)

	msg := createMessage([]byte(`{"name":"test"}`), schemaVersionID)
	_, err := transformer.Transform(ctx, msg)

	require.ErrorIs(t, models.ErrSignalSent, err)

	signalCount := getSignalCount(t, ctx, natsClient.JetStream())
	require.Equal(t, uint64(1), signalCount)

	signals := consumeSignals(t, ctx, natsClient.JetStream(), 1)
	require.Len(t, signals, 1)
	require.Equal(t, pipelineID, signals[0].PipelineID)
	require.Equal(t, internal.RoleDeduplicator, signals[0].Component)
	require.Contains(t, signals[0].Reason, "failed to compile transformation")
}
