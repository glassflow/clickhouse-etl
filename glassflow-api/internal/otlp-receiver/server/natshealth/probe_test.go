package natshealth_test

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

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/otlp-receiver/server/natshealth"
)

func setupNATS(t *testing.T) (*server.Server, *nats.Conn, jetstream.JetStream) {
	t.Helper()

	natsServer := natsTest.RunServer(&server.Options{
		Host:      "127.0.0.1",
		Port:      -1,
		NoLog:     true,
		NoSigs:    true,
		JetStream: true,
	})

	nc, err := nats.Connect(natsServer.ClientURL())
	require.NoError(t, err)

	js, err := jetstream.New(nc)
	require.NoError(t, err)

	return natsServer, nc, js
}

func waitFor(t *testing.T, deadline time.Duration, cond func() bool) bool {
	t.Helper()
	end := time.Now().Add(deadline)
	for time.Now().Before(end) {
		if cond() {
			return true
		}
		time.Sleep(10 * time.Millisecond)
	}
	return cond()
}

func discardLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

func TestProbe_HealthyFalseBeforeFirstSuccess(t *testing.T) {
	natsServer, nc, js := setupNATS(t)
	defer natsServer.Shutdown()
	defer nc.Close()

	p := natshealth.NewProbe(js, time.Second, time.Second, time.Second, discardLogger())

	ok, lastGood := p.Healthy()
	require.False(t, ok, "probe should be unhealthy before any sample succeeds")
	require.True(t, lastGood.IsZero(), "lastGood should be zero before any sample")
}

func TestProbe_HealthyAfterFirstTick(t *testing.T) {
	natsServer, nc, js := setupNATS(t)
	defer natsServer.Shutdown()
	defer nc.Close()

	p := natshealth.NewProbe(js, 50*time.Millisecond, 500*time.Millisecond, time.Second, discardLogger())
	p.Start(t.Context())

	require.True(t, waitFor(t, 2*time.Second, func() bool {
		ok, _ := p.Healthy()
		return ok
	}), "probe should report healthy after first successful tick")
}

func TestProbe_GoesUnhealthyWhenNATSShutsDown(t *testing.T) {
	natsServer, nc, js := setupNATS(t)
	defer nc.Close()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	p := natshealth.NewProbe(js, 50*time.Millisecond, 200*time.Millisecond, 300*time.Millisecond, discardLogger())
	p.Start(ctx)

	require.True(t, waitFor(t, 2*time.Second, func() bool {
		ok, _ := p.Healthy()
		return ok
	}), "probe should be healthy against running server")

	natsServer.Shutdown()
	natsServer.WaitForShutdown()

	require.True(t, waitFor(t, 2*time.Second, func() bool {
		ok, _ := p.Healthy()
		return !ok
	}), "probe should go unhealthy after server shutdown + stale window")
}

func TestProbe_ExitsOnCtxCancel(t *testing.T) {
	natsServer, nc, js := setupNATS(t)
	defer natsServer.Shutdown()
	defer nc.Close()

	ctx, cancel := context.WithCancel(context.Background())

	p := natshealth.NewProbe(js, 50*time.Millisecond, 500*time.Millisecond, time.Second, discardLogger())
	p.Start(ctx)

	require.True(t, waitFor(t, 2*time.Second, func() bool {
		ok, _ := p.Healthy()
		return ok
	}), "probe should be healthy before cancel")

	cancel()

	// After cancel, the goroutine should stop ticking. We can't observe the
	// goroutine directly, but we can verify the lastGood timestamp stops
	// advancing across multiple intervals.
	_, snapshot := p.Healthy()
	time.Sleep(300 * time.Millisecond)
	_, after := p.Healthy()
	require.Equal(t, snapshot, after, "lastGood should not advance after ctx cancel")
}
