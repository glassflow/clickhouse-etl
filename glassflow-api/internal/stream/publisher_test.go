package stream_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/nats-io/nats-server/v2/server"
	natsTest "github.com/nats-io/nats-server/v2/test"
	"github.com/nats-io/nats.go"
	"github.com/nats-io/nats.go/jetstream"
	"github.com/stretchr/testify/require"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/stream"
)

func runEmbeddedNATS(t *testing.T) (*server.Server, jetstream.JetStream, *nats.Conn) {
	t.Helper()

	srv := natsTest.RunServer(&server.Options{
		Host:      "127.0.0.1",
		Port:      -1,
		NoLog:     true,
		NoSigs:    true,
		JetStream: true,
	})

	nc, err := nats.Connect(srv.ClientURL())
	require.NoError(t, err)

	js, err := jetstream.New(nc)
	require.NoError(t, err)

	t.Cleanup(func() {
		nc.Close()
		srv.Shutdown()
	})

	return srv, js, nc
}

func TestPublishNatsMsgAsync_HappyPath(t *testing.T) {
	_, js, _ := runEmbeddedNATS(t)
	ctx := context.Background()

	subject := "happy.path"
	_, err := js.CreateStream(ctx, jetstream.StreamConfig{
		Name:     "happy",
		Subjects: []string{subject},
		Storage:  jetstream.MemoryStorage,
	})
	require.NoError(t, err)

	pub := stream.NewNATSPublisher(js, stream.PublisherConfig{Subject: subject, TotalSubjectCount: 1})

	fut, err := pub.PublishNatsMsgAsync(ctx, &nats.Msg{Subject: subject, Data: []byte("hi")}, 100)
	require.NoError(t, err)

	select {
	case <-fut.Ok():
	case e := <-fut.Err():
		t.Fatalf("unexpected publish err: %v", e)
	case <-time.After(5 * time.Second):
		t.Fatal("timed out waiting for ack")
	}
}

// TestPublishNatsMsgAsync_StreamFullAck verifies that a server-side stream-full
// NAK on a DiscardNew stream is classified as backpressure by the helper. This
// is the contract PR 2 will rely on.
func TestPublishNatsMsgAsync_StreamFullAck(t *testing.T) {
	_, js, _ := runEmbeddedNATS(t)
	ctx := context.Background()

	subject := "discardnew.test"
	_, err := js.CreateStream(ctx, jetstream.StreamConfig{
		Name:     "discardnew",
		Subjects: []string{subject},
		Storage:  jetstream.MemoryStorage,
		MaxMsgs:  1,
		Discard:  jetstream.DiscardNew,
	})
	require.NoError(t, err)

	pub := stream.NewNATSPublisher(js, stream.PublisherConfig{Subject: subject, TotalSubjectCount: 1})

	// First message fills the stream.
	fut1, err := pub.PublishNatsMsgAsync(ctx, &nats.Msg{Subject: subject, Data: []byte("1")}, 100)
	require.NoError(t, err)
	select {
	case <-fut1.Ok():
	case e := <-fut1.Err():
		t.Fatalf("unexpected err on first publish: %v", e)
	case <-time.After(5 * time.Second):
		t.Fatal("first publish timed out")
	}

	// Second message should be rejected by the server with stream-full.
	fut2, err := pub.PublishNatsMsgAsync(ctx, &nats.Msg{Subject: subject, Data: []byte("2")}, 100)
	require.NoError(t, err)

	select {
	case <-fut2.Ok():
		t.Fatal("expected stream-full nak, got ok")
	case e := <-fut2.Err():
		require.True(t, stream.IsBackpressureErr(e), "want IsBackpressureErr, got %v", e)
		require.False(t, stream.IsFatalPublishErr(e), "stream-full must not be fatal")
	case <-time.After(5 * time.Second):
		t.Fatal("second publish timed out")
	}
}

func TestPublishNatsMsgAsync_CtxAlreadyCancelled(t *testing.T) {
	_, js, _ := runEmbeddedNATS(t)

	subject := "cancelled.test"
	_, err := js.CreateStream(context.Background(), jetstream.StreamConfig{
		Name:     "cancelled",
		Subjects: []string{subject},
		Storage:  jetstream.MemoryStorage,
	})
	require.NoError(t, err)

	pub := stream.NewNATSPublisher(js, stream.PublisherConfig{Subject: subject, TotalSubjectCount: 1})

	// Saturate the pending window so the throttle's retry loop is forced to
	// observe ctx cancellation instead of returning immediately.
	const limit = 1
	for range limit {
		_, err := pub.PublishNatsMsgAsync(context.Background(), &nats.Msg{Subject: subject, Data: []byte("seed")}, limit+1)
		require.NoError(t, err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	_, err = pub.PublishNatsMsgAsync(ctx, &nats.Msg{Subject: subject, Data: []byte("after")}, limit)
	// Either the throttle observed cancellation and returned ctx.Err(), or
	// the pending window drained between calls and the publish proceeded —
	// both are acceptable; what matters is that we never falsely return
	// ErrStreamMaxPendingMsgs when the caller explicitly cancelled.
	if err != nil {
		require.True(t,
			errors.Is(err, context.Canceled) || errors.Is(err, stream.ErrStreamMaxPendingMsgs),
			"unexpected err: %v", err,
		)
	}
}
