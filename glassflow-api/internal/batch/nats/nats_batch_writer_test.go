package nats_test

import (
	"context"
	"testing"

	"github.com/nats-io/nats-server/v2/server"
	natsTest "github.com/nats-io/nats-server/v2/test"
	"github.com/nats-io/nats.go"
	"github.com/nats-io/nats.go/jetstream"
	"github.com/stretchr/testify/require"

	natsBatch "github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/batch/nats"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

func setupNATSWriterServer(t *testing.T) (*server.Server, *nats.Conn, jetstream.JetStream) {
	t.Helper()

	opts := &server.Options{
		Host:      "127.0.0.1",
		Port:      -1,
		NoLog:     true,
		NoSigs:    true,
		JetStream: true,
	}
	natsServer := natsTest.RunServer(opts)

	nc, err := nats.Connect(natsServer.ClientURL())
	require.NoError(t, err)

	js, err := jetstream.New(nc)
	require.NoError(t, err)

	return natsServer, nc, js
}

func createStream(t *testing.T, js jetstream.JetStream, ctx context.Context, subject string) {
	t.Helper()

	_, err := js.CreateStream(ctx, jetstream.StreamConfig{
		Name:     "test-stream",
		Subjects: []string{subject},
		Storage:  jetstream.MemoryStorage,
	})
	require.NoError(t, err)
}

func TestBatchWriter_WriteBatch(t *testing.T) {
	natsServer, nc, js := setupNATSWriterServer(t)
	defer natsServer.Shutdown()
	defer nc.Close()

	ctx := context.Background()
	subject := "test.write"
	createStream(t, js, ctx, subject)

	writer := natsBatch.NewBatchWriter(js, subject)

	// Create test messages
	messages := []models.Message{
		{
			Type: models.MessageTypeNatsMsg,
			NatsMsgOriginal: &nats.Msg{
				Subject: subject,
				Data:    []byte(`{"id": 1}`),
			},
		},
		{
			Type: models.MessageTypeNatsMsg,
			NatsMsgOriginal: &nats.Msg{
				Subject: subject,
				Data:    []byte(`{"id": 2}`),
			},
		},
		{
			Type: models.MessageTypeNatsMsg,
			NatsMsgOriginal: &nats.Msg{
				Subject: subject,
				Data:    []byte(`{"id": 3}`),
			},
		},
	}

	// Write batch
	failedMessages := writer.WriteBatch(ctx, messages)
	require.Empty(t, failedMessages, "no messages should fail")

	// Verify messages were published
	consumer, err := js.CreateOrUpdateConsumer(ctx, "test-stream", jetstream.ConsumerConfig{
		Name:          "test-consumer",
		FilterSubject: subject,
		AckPolicy:     jetstream.AckExplicitPolicy,
	})
	require.NoError(t, err)

	info, err := consumer.Info(ctx)
	require.NoError(t, err)
	require.Equal(t, uint64(3), info.NumPending, "3 messages should be in the stream")
}

func TestBatchWriter_WriteBatchWithHeaders(t *testing.T) {
	natsServer, nc, js := setupNATSWriterServer(t)
	defer natsServer.Shutdown()
	defer nc.Close()

	ctx := context.Background()
	subject := "test.headers"
	createStream(t, js, ctx, subject)

	writer := natsBatch.NewBatchWriter(js, subject)

	// Create message with headers
	messages := []models.Message{
		{
			Type: models.MessageTypeNatsMsg,
			NatsMsgOriginal: &nats.Msg{
				Subject: subject,
				Data:    []byte(`{"id": 1}`),
				Header: nats.Header{
					"X-Custom-Header": []string{"value1", "value2"},
					"Content-Type":    []string{"application/json"},
				},
			},
		},
	}

	// Add additional header via mutation
	messages[0].AddHeader("X-Added-Header", "added-value")

	// Write batch
	failedMessages := writer.WriteBatch(ctx, messages)
	require.Empty(t, failedMessages, "no messages should fail")

	// Verify message and headers were published
	consumer, err := js.CreateOrUpdateConsumer(ctx, "test-stream", jetstream.ConsumerConfig{
		Name:          "test-consumer-headers",
		FilterSubject: subject,
		AckPolicy:     jetstream.AckExplicitPolicy,
	})
	require.NoError(t, err)

	msgBatch, err := consumer.FetchNoWait(1)
	require.NoError(t, err)

	var receivedMsg jetstream.Msg
	for msg := range msgBatch.Messages() {
		receivedMsg = msg
		break
	}

	require.NotNil(t, receivedMsg)
	require.Equal(t, []byte(`{"id": 1}`), receivedMsg.Data())

	// Verify headers
	require.Equal(t, []string{"value1", "value2"}, receivedMsg.Headers().Values("X-Custom-Header"))
	require.Equal(t, []string{"application/json"}, receivedMsg.Headers().Values("Content-Type"))
	require.Equal(t, []string{"added-value"}, receivedMsg.Headers().Values("X-Added-Header"))
}

func TestBatchWriter_WriteBatchWithJetStreamMsg(t *testing.T) {
	natsServer, nc, js := setupNATSWriterServer(t)
	defer natsServer.Shutdown()
	defer nc.Close()

	ctx := context.Background()
	sourceSubject := "test.jetstream.source"
	destSubject := "test.jetstream.dest"

	// Create source stream
	_, err := js.CreateStream(ctx, jetstream.StreamConfig{
		Name:     "source-stream",
		Subjects: []string{sourceSubject},
		Storage:  jetstream.MemoryStorage,
	})
	require.NoError(t, err)

	// Create destination stream
	_, err = js.CreateStream(ctx, jetstream.StreamConfig{
		Name:     "dest-stream",
		Subjects: []string{destSubject},
		Storage:  jetstream.MemoryStorage,
	})
	require.NoError(t, err)

	// Publish a message with headers to the source stream
	_, err = js.PublishMsg(ctx, &nats.Msg{
		Subject: sourceSubject,
		Data:    []byte(`{"id": 100}`),
		Header: nats.Header{
			"X-Source-Header":  []string{"source-value"},
			"X-Multi-Header":   []string{"value1", "value2"},
			"Content-Type":     []string{"application/json"},
		},
	})
	require.NoError(t, err)

	// Create a consumer to read from the source stream
	sourceConsumer, err := js.CreateOrUpdateConsumer(ctx, "source-stream", jetstream.ConsumerConfig{
		Name:          "source-consumer",
		FilterSubject: sourceSubject,
		AckPolicy:     jetstream.AckExplicitPolicy,
	})
	require.NoError(t, err)

	// Read the message from the source stream to get a jetstream.Msg
	msgBatch, err := sourceConsumer.FetchNoWait(1)
	require.NoError(t, err)

	var jetstreamMsg jetstream.Msg
	for msg := range msgBatch.Messages() {
		jetstreamMsg = msg
		break
	}
	require.NotNil(t, jetstreamMsg)

	// Now create a models.Message with the jetstream.Msg and use the batch writer to publish to destination
	writer := natsBatch.NewBatchWriter(js, destSubject)
	messages := []models.Message{
		{
			Type:                 models.MessageTypeJetstreamMsg,
			JetstreamMsgOriginal: jetstreamMsg,
		},
	}

	// Write batch to destination
	failedMessages := writer.WriteBatch(ctx, messages)
	require.Empty(t, failedMessages, "no messages should fail")

	// Verify the message was published to destination stream
	destConsumer, err := js.CreateOrUpdateConsumer(ctx, "dest-stream", jetstream.ConsumerConfig{
		Name:          "dest-consumer",
		FilterSubject: destSubject,
		AckPolicy:     jetstream.AckExplicitPolicy,
	})
	require.NoError(t, err)

	info, err := destConsumer.Info(ctx)
	require.NoError(t, err)
	require.Equal(t, uint64(1), info.NumPending, "1 message should be in the destination stream")

	// Read the message from destination and verify it has the same data
	destMsgBatch, err := destConsumer.FetchNoWait(1)
	require.NoError(t, err)

	var destMsg jetstream.Msg
	for msg := range destMsgBatch.Messages() {
		destMsg = msg
		break
	}
	require.NotNil(t, destMsg)
	require.Equal(t, []byte(`{"id": 100}`), destMsg.Data())

	// Verify headers are preserved
	require.Equal(t, []string{"source-value"}, destMsg.Headers().Values("X-Source-Header"))
	require.Equal(t, []string{"value1", "value2"}, destMsg.Headers().Values("X-Multi-Header"))
	require.Equal(t, []string{"application/json"}, destMsg.Headers().Values("Content-Type"))
}
