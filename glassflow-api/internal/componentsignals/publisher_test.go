// nolint
package componentsignals

import (
	"context"
	"testing"

	natsServer "github.com/nats-io/nats-server/v2/server"
	natsTest "github.com/nats-io/nats-server/v2/test"
	"github.com/nats-io/nats.go"
	"github.com/nats-io/nats.go/jetstream"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

func TestComponentSignalPublisher_SendSignal(t *testing.T) {
	opts := &natsServer.Options{
		Host:      "127.0.0.1",
		Port:      -1, // Random port
		NoLog:     true,
		NoSigs:    true,
		JetStream: true,
	}

	ns := natsTest.RunServer(opts)
	defer ns.Shutdown()

	natsURL := ns.ClientURL()

	nc, err := nats.Connect(natsURL)
	require.NoError(t, err)
	defer nc.Close()

	js, err := jetstream.New(nc)
	require.NoError(t, err)

	streamName := models.ComponentSignalsStream
	subject := models.GetComponentSignalsSubject()

	_, err = js.CreateStream(context.Background(), jetstream.StreamConfig{
		Name:     streamName,
		Subjects: []string{subject},
	})
	require.NoError(t, err)
	defer func() {
		_ = js.DeleteStream(context.Background(), streamName)
	}()

	publisher, err := NewPublisher(nc)
	require.NoError(t, err)
	require.NotNil(t, publisher)

	testSignal := models.ComponentSignal{
		PipelineID: "test-pipeline-123",
		Reason:     "test-reason",
		Text:       "test message text",
	}

	err = publisher.SendSignal(context.Background(), testSignal)
	require.NoError(t, err)

	stream, err := js.Stream(context.Background(), streamName)
	require.NoError(t, err)

	info, err := stream.Info(context.Background())
	require.NoError(t, err)

	assert.Equal(t, uint64(1), info.State.Msgs, "expected 1 message in stream")

	assert.Equal(t, "component-signals.failures", publisher.GetSubject())
}
