package stream

import (
	"context"
	"io"
	"log/slog"
	"testing"
	"time"

	"github.com/nats-io/nats-server/v2/server"
	natsTest "github.com/nats-io/nats-server/v2/test"
	"github.com/nats-io/nats.go"
	"github.com/nats-io/nats.go/jetstream"
	"github.com/stretchr/testify/require"
)

// Internal-package test so we can drive sampler.sample() directly without
// waiting on the ticker.

func runEmbeddedNATSForSampler(t *testing.T) (jetstream.JetStream, *nats.Conn) {
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

	return js, nc
}

// sample() against a real stream with a known message count must not error,
// and must not panic when MaxMsgs is unset (ratio path is skipped).
func TestStreamSampler_SampleHappyPath(t *testing.T) {
	js, _ := runEmbeddedNATSForSampler(t)
	ctx := context.Background()

	const subject = "sampler.test"
	_, err := js.CreateStream(ctx, jetstream.StreamConfig{
		Name:     "sampler-happy",
		Subjects: []string{subject},
		Storage:  jetstream.MemoryStorage,
		MaxMsgs:  100,
	})
	require.NoError(t, err)

	for range 5 {
		_, err = js.Publish(ctx, subject, []byte("x"))
		require.NoError(t, err)
	}

	s := NewStreamSampler(js, "sampler-happy", slog.New(slog.NewTextHandler(io.Discard, nil)))
	s.sample(ctx)
}

// Missing stream must not panic — the sampler logs and returns.
func TestStreamSampler_SampleMissingStream(t *testing.T) {
	js, _ := runEmbeddedNATSForSampler(t)

	s := NewStreamSampler(js, "does-not-exist", slog.New(slog.NewTextHandler(io.Discard, nil)))
	s.sample(context.Background())
}

// Run() returns promptly when ctx is cancelled before the first tick fires.
func TestStreamSampler_RunStopsOnCancel(t *testing.T) {
	js, _ := runEmbeddedNATSForSampler(t)

	s := NewStreamSampler(js, "irrelevant", slog.New(slog.NewTextHandler(io.Discard, nil)))
	ctx, cancel := context.WithCancel(context.Background())

	done := make(chan struct{})
	go func() {
		s.Run(ctx)
		close(done)
	}()

	cancel()

	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("sampler did not exit after ctx cancel")
	}
}
