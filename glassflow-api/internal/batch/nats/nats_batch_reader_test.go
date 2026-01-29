package nats_test

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/avast/retry-go/v4"
	"github.com/nats-io/nats-server/v2/server"
	natsTest "github.com/nats-io/nats-server/v2/test"
	"github.com/nats-io/nats.go"
	"github.com/nats-io/nats.go/jetstream"
	"github.com/stretchr/testify/require"

	natsBatch "github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/batch/nats"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

func setupNATSServer(t *testing.T) (*server.Server, *nats.Conn, jetstream.JetStream) {
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

func createStreamAndConsumer(t *testing.T, js jetstream.JetStream, ctx context.Context, subject string) jetstream.Consumer {
	t.Helper()

	_, err := js.CreateStream(ctx, jetstream.StreamConfig{
		Name:     "test-stream",
		Subjects: []string{subject},
		Storage:  jetstream.MemoryStorage,
	})
	require.NoError(t, err)

	consumer, err := js.CreateOrUpdateConsumer(ctx, "test-stream", jetstream.ConsumerConfig{
		Name:          "test-consumer",
		FilterSubject: subject,
		AckPolicy:     jetstream.AckAllPolicy,
	})
	require.NoError(t, err)

	return consumer
}

func TestBatchReader_ReadBatchWithOptions(t *testing.T) {
	natsServer, nc, js := setupNATSServer(t)
	defer natsServer.Shutdown()
	defer nc.Close()

	ctx := context.Background()
	consumer := createStreamAndConsumer(t, js, ctx, "test.options")

	// Publish 10 messages
	for i := 0; i < 10; i++ {
		_, err := js.Publish(ctx, "test.options", []byte(`{"id": 1}`))
		require.NoError(t, err)
	}

	reader := natsBatch.NewBatchReader(consumer)

	// Read with custom batch size
	messages, err := reader.ReadBatch(ctx, models.WithBatchSize(3))
	require.NoError(t, err)
	require.Len(t, messages, 3)

	// Read remaining
	messages, err = reader.ReadBatchNoWait(ctx, models.WithBatchSize(10))
	require.NoError(t, err)
	require.Len(t, messages, 7)
}

func TestBatchReader_ReadBatchNoWait(t *testing.T) {
	natsServer, nc, js := setupNATSServer(t)
	defer natsServer.Shutdown()
	defer nc.Close()

	ctx := context.Background()
	consumer := createStreamAndConsumer(t, js, ctx, "test.nowait")

	// Publish 3 messages
	for i := 0; i < 3; i++ {
		_, err := js.Publish(ctx, "test.nowait", []byte(`{"id": 1}`))
		require.NoError(t, err)
	}

	reader := natsBatch.NewBatchReader(consumer)
	messages, err := reader.ReadBatchNoWait(ctx, models.WithBatchSize(10))
	require.NoError(t, err)
	require.Len(t, messages, 3)

	// Reading again should return no messages
	messages, err = reader.ReadBatchNoWait(ctx, models.WithBatchSize(10))
	require.NoError(t, err)
	require.Nil(t, messages)
}

func TestBatchReader_Ack(t *testing.T) {
	natsServer, nc, js := setupNATSServer(t)
	defer natsServer.Shutdown()
	defer nc.Close()

	ctx := context.Background()
	consumer := createStreamAndConsumer(t, js, ctx, "test.ack")

	// Publish messages
	for i := 0; i < 5; i++ {
		_, err := js.Publish(ctx, "test.ack", []byte(`{"id": 1}`))
		require.NoError(t, err)
	}

	reader := natsBatch.NewBatchReader(consumer)
	messages, err := reader.ReadBatchNoWait(ctx, models.WithBatchSize(10))
	require.NoError(t, err)
	require.Len(t, messages, 5)

	// Ack messages
	err = reader.Ack(ctx, messages)
	require.NoError(t, err)

	// Verify messages are acked by checking consumer info
	info, err := consumer.Info(ctx)
	require.NoError(t, err)
	require.Equal(t, uint64(0), info.NumPending, "no messages should be pending after ack")
}

func TestBatchReader_Nak(t *testing.T) {
	natsServer, nc, js := setupNATSServer(t)
	defer natsServer.Shutdown()
	defer nc.Close()

	ctx := context.Background()
	consumer := createStreamAndConsumer(t, js, ctx, "test.nak")

	// Publish messages
	for i := 0; i < 3; i++ {
		_, err := js.Publish(ctx, "test.nak", []byte(`{"id": 1}`))
		require.NoError(t, err)
	}

	reader := natsBatch.NewBatchReader(consumer)
	messages, err := reader.ReadBatchNoWait(ctx, models.WithBatchSize(10))
	require.NoError(t, err)
	require.Len(t, messages, 3)

	// Nak messages
	err = reader.Nak(ctx, messages)
	require.NoError(t, err)

	// Verify messages are available for redelivery with retry
	err = retry.Do(
		func() error {
			messages, err = reader.ReadBatchNoWait(ctx, models.WithBatchSize(10))
			if err != nil {
				return err
			}
			if len(messages) != 3 {
				return fmt.Errorf("expected 3 messages, got %d", len(messages))
			}
			return nil
		},
		retry.Delay(5*time.Millisecond),
		retry.Attempts(10),
		retry.LastErrorOnly(true),
	)
	require.NoError(t, err, "messages should be available for redelivery after nak")
	require.Len(t, messages, 3)
}

func TestBatchReader_Consume_BasicConsumption(t *testing.T) {
	natsServer, nc, js := setupNATSServer(t)
	defer natsServer.Shutdown()
	defer nc.Close()

	ctx := context.Background()
	consumer := createStreamAndConsumer(t, js, ctx, "test.consume.basic")

	for i := 0; i < 5; i++ {
		_, err := js.Publish(ctx, "test.consume.basic", []byte(fmt.Sprintf(`{"id": %d}`, i)))
		require.NoError(t, err)
	}

	reader := natsBatch.NewBatchReader(consumer)

	receivedCount := 0
	receivedMsgs := make([]models.Message, 0)
	done := make(chan struct{})

	handler := func(msg models.Message) {
		receivedMsgs = append(receivedMsgs, msg)
		receivedCount++
		if receivedCount == 5 {
			close(done)
		}
	}

	handle, err := reader.Consume(ctx, handler)
	require.NoError(t, err)
	require.NotNil(t, handle)

	select {
	case <-done:
	case <-time.After(1 * time.Second):
		t.Fatal("timeout waiting for messages to be consumed")
	}

	handle.Stop()

	select {
	case <-handle.Done():
	case <-time.After(1 * time.Second):
		t.Fatal("timeout waiting for Done channel")
	}

	require.Equal(t, 5, receivedCount)
	require.Len(t, receivedMsgs, 5)

	for _, msg := range receivedMsgs {
		require.NotNil(t, msg.JetstreamMsgOriginal)
	}
}
