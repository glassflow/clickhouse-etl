package processor

import (
	"context"
	"errors"
	"log/slog"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/sdk/metric/metricdata"

	"github.com/glassflow/clickhouse-etl/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl/glassflow-api/internal/stream"
	"github.com/glassflow/clickhouse-etl/glassflow-api/pkg/observability"
)

// stubWriter is a BatchWriter whose WriteBatch behaviour is controlled per call.
type stubWriter struct {
	calls    [][]models.FailedMessage // response to return on call[i]; cycles on last entry
	callsN   int
	written  [][]models.Message
	closeErr error
}

func (s *stubWriter) WriteBatch(_ context.Context, msgs []models.Message) []models.FailedMessage {
	s.written = append(s.written, msgs)
	idx := s.callsN
	if idx >= len(s.calls) {
		idx = len(s.calls) - 1
	}
	s.callsN++
	return s.calls[idx]
}

func (s *stubWriter) Close() error { return s.closeErr }

func failedMsg(msg models.Message, err error) models.FailedMessage {
	return models.FailedMessage{Message: msg, Error: err}
}

func makeMsg(payload string) models.Message {
	return models.NewNatsMessage([]byte(payload), nil)
}

// newTestComponent builds a minimal StreamingComponent with the given writer and dlqWriter.
func newTestComponent(writer, dlqWriter *stubWriter) *StreamingComponent {
	return &StreamingComponent{
		writer:    writer,
		dlqWriter: dlqWriter,
		log:       slog.Default(),
		role:      "test",
		shutdown:  shutdown{doneCh: make(chan struct{})},
	}
}

func TestWriteWithBackpressure_SucceedsFirstTry(t *testing.T) {
	writer := &stubWriter{calls: [][]models.FailedMessage{nil}}
	dlq := &stubWriter{calls: [][]models.FailedMessage{nil}}
	sc := newTestComponent(writer, dlq)

	msgs := []models.Message{makeMsg(`{"id":1}`)}
	err := sc.writeWithBackpressure(context.Background(), msgs, msgs)
	require.NoError(t, err)
	assert.Equal(t, 1, writer.callsN)
	assert.Equal(t, 0, dlq.callsN)
}

func TestWriteWithBackpressure_RetriesOnBackpressure(t *testing.T) {
	msg := makeMsg(`{"id":1}`)
	// First call returns back-pressure failure; second call succeeds.
	backpressureFailed := []models.FailedMessage{failedMsg(msg, stream.ErrStreamMaxPendingMsgs)}
	writer := &stubWriter{calls: [][]models.FailedMessage{backpressureFailed, nil}}
	dlq := &stubWriter{calls: [][]models.FailedMessage{nil}}
	sc := newTestComponent(writer, dlq)

	start := time.Now()
	err := sc.writeWithBackpressure(context.Background(), []models.Message{msg}, []models.Message{msg})
	require.NoError(t, err)
	assert.Equal(t, 2, writer.callsN, "should have retried once")
	assert.Equal(t, 0, dlq.callsN, "back-pressure errors must not go to DLQ")
	// Back-off starts at 50ms; total should be under IngestorBackpressureMaxDelay.
	assert.Less(t, time.Since(start), 5*time.Second)
}

func TestWriteWithBackpressure_HardFailureGoesToDLQ(t *testing.T) {
	msg := makeMsg(`{"id":2}`)
	hardErr := errors.New("connection closed")
	writer := &stubWriter{calls: [][]models.FailedMessage{{failedMsg(msg, hardErr)}}}
	dlq := &stubWriter{calls: [][]models.FailedMessage{nil}}
	sc := newTestComponent(writer, dlq)

	err := sc.writeWithBackpressure(context.Background(), []models.Message{msg}, []models.Message{msg})
	require.NoError(t, err)
	assert.Equal(t, 1, writer.callsN)
	assert.Equal(t, 1, dlq.callsN, "hard failure should be written to DLQ")
}

func TestWriteWithBackpressure_BackpressureThenHardFailureRoutesCorrectly(t *testing.T) {
	msg1 := makeMsg(`{"id":1}`)
	msg2 := makeMsg(`{"id":2}`)
	bpErr := stream.ErrStreamMaxPendingMsgs
	hardErr := errors.New("stream not found")

	// First call: msg1 back-pressure, msg2 hard failure.
	// Second call (retry for msg1): succeeds.
	firstCall := []models.FailedMessage{failedMsg(msg1, bpErr), failedMsg(msg2, hardErr)}
	writer := &stubWriter{calls: [][]models.FailedMessage{firstCall, nil}}
	dlq := &stubWriter{calls: [][]models.FailedMessage{nil}}
	sc := newTestComponent(writer, dlq)

	err := sc.writeWithBackpressure(context.Background(), []models.Message{msg1, msg2}, []models.Message{msg1, msg2})
	require.NoError(t, err)
	assert.Equal(t, 2, writer.callsN)
	assert.Equal(t, 1, dlq.callsN, "only the hard failure should reach DLQ")
}

func TestWriteWithBackpressure_ContextCancelledDuringRetry(t *testing.T) {
	msg := makeMsg(`{"id":3}`)
	// Always return back-pressure so it would loop forever without cancellation.
	writer := &stubWriter{calls: [][]models.FailedMessage{
		{failedMsg(msg, stream.ErrStreamMaxPendingMsgs)},
	}}
	dlq := &stubWriter{calls: [][]models.FailedMessage{nil}}
	sc := newTestComponent(writer, dlq)

	ctx, cancel := context.WithTimeout(context.Background(), 80*time.Millisecond)
	defer cancel()

	err := sc.writeWithBackpressure(ctx, []models.Message{msg}, []models.Message{msg})
	require.Error(t, err)
	assert.True(t, errors.Is(err, context.DeadlineExceeded))
}

func TestStreamingComponent_WriteFailedBatch_RecordsDLQMetric(t *testing.T) {
	reader := observability.InitMetricsForTesting()

	dlq := &stubWriter{calls: [][]models.FailedMessage{nil}}
	sc := newTestComponent(nil, dlq)
	sc.role = "join"

	failed := []models.FailedMessage{
		{Message: makeMsg(`{"id":1}`), Error: errors.New("processing error")},
		{Message: makeMsg(`{"id":2}`), Error: errors.New("another error")},
	}

	err := sc.writeFailedBatch(context.Background(), failed)
	require.NoError(t, err)

	var rm metricdata.ResourceMetrics
	require.NoError(t, reader.Collect(context.Background(), &rm))

	found := false
	for _, sm := range rm.ScopeMetrics {
		for _, m := range sm.Metrics {
			if m.Name != observability.GfMetricPrefix+"_dlq_records_written_total" {
				continue
			}
			sum, ok := m.Data.(metricdata.Sum[int64])
			if !ok {
				continue
			}
			for _, dp := range sum.DataPoints {
				comp, _ := dp.Attributes.Value("component")
				reason, _ := dp.Attributes.Value("reason")
				if comp.AsString() == "join" && reason.AsString() == observability.DLQReasonUnrecoverable {
					require.Equal(t, int64(2), dp.Value)
					found = true
				}
			}
		}
	}
	require.True(t, found, "dlq_records_written_total metric not recorded for component=join")
}
