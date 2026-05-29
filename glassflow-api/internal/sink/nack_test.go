package sink

import (
	"context"
	"fmt"
	"log/slog"
	"testing"
	"time"

	"github.com/ClickHouse/clickhouse-go/v2/lib/proto"
	"github.com/nats-io/nats.go/jetstream"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/glassflow/clickhouse-etl/glassflow-api/internal"
	sinkerrors "github.com/glassflow/clickhouse-etl/glassflow-api/internal/sink/errors"
)

func chProtoException(code int32) error {
	return &proto.Exception{Code: code}
}

// mockMsg implements jetstream.Msg for testing
type mockMsg struct {
	jetstream.Msg
	nakDelay time.Duration
	nakCalls int
	ackCalls int
}

func (m *mockMsg) NakWithDelay(d time.Duration) error {
	m.nakDelay = d
	m.nakCalls++
	return nil
}

func (m *mockMsg) Ack() error {
	m.ackCalls++
	return nil
}

func (m *mockMsg) Data() []byte { return []byte("{}") }

func newTestSink() *ClickHouseSink {
	return &ClickHouseSink{
		log: slog.Default(),
	}
}

func TestNakMessages_CallsNakWithDelay(t *testing.T) {
	sink := newTestSink()
	msgs := []*mockMsg{{}, {}, {}}

	jsMsgs := make([]jetstream.Msg, len(msgs))
	for i, m := range msgs {
		jsMsgs[i] = m
	}

	sink.nakMessages(context.Background(), jsMsgs)

	for i, m := range msgs {
		assert.Equal(t, 1, m.nakCalls, "msg %d: expected 1 NakWithDelay call", i)
		assert.Equal(t, internal.NatsConsumerNakDelay, m.nakDelay, "msg %d: unexpected delay", i)
		assert.Equal(t, 0, m.ackCalls, "msg %d: Ack should not be called on NACK path", i)
	}
}

func TestNakMessages_NakErrorIsLogged(t *testing.T) {
	// A failed NakWithDelay should not propagate — sink logs and moves on.
	sink := newTestSink()

	failMsg := &failingNakMsg{}
	sink.nakMessages(context.Background(), []jetstream.Msg{failMsg})
	// No panic, no error returned — test passes if we reach here
}

type failingNakMsg struct{ jetstream.Msg }

func (m *failingNakMsg) NakWithDelay(time.Duration) error { return fmt.Errorf("nats: connection closed") }
func (m *failingNakMsg) Data() []byte                     { return []byte("{}") }

// TestClassify_RetryableMeansNack verifies that the classification of a
// retryable error is Retryable — the dispatch in sendBatch relies on this.
func TestClassify_RetryableMeansNack(t *testing.T) {
	// TooManySimultaneousQueries — a classic transient CH overload error
	require.Equal(t, sinkerrors.Retryable, sinkerrors.Classify(chProtoException(202)))
}

// TestClassify_PermanentMeansDLQ verifies that schema errors are Permanent
// and will not be NACK'd — they go to DLQ unchanged.
func TestClassify_PermanentMeansDLQ(t *testing.T) {
	require.Equal(t, sinkerrors.Permanent, sinkerrors.Classify(chProtoException(60))) // UNKNOWN_TABLE
	require.Equal(t, sinkerrors.Permanent, sinkerrors.Classify(chProtoException(16))) // NO_SUCH_COLUMN
}

// TestClassify_UnknownMeansDLQ verifies that unrecognised errors are
// treated conservatively — DLQ, not NACK.
func TestClassify_UnknownMeansDLQ(t *testing.T) {
	require.Equal(t, sinkerrors.Unknown, sinkerrors.Classify(fmt.Errorf("something new")))
}
