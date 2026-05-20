package processor

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/stream"
)

func TestErrStreamBackpressure_WrapsBackpressureError(t *testing.T) {
	// Wrapping ErrStreamBackpressure over a back-pressure cause should be
	// detectable with errors.Is on both sentinels.
	cause := stream.ErrStreamMaxPendingMsgs
	wrapped := fmt.Errorf("%w: %w", models.ErrStreamBackpressure, cause)

	require.True(t, errors.Is(wrapped, models.ErrStreamBackpressure))
	require.True(t, errors.Is(wrapped, stream.ErrStreamMaxPendingMsgs))
}

// capturePublisher records SendSignal calls for test assertions.
type capturePublisher struct {
	mu      sync.Mutex
	signals []models.ComponentSignal
}

func (c *capturePublisher) SendSignal(_ context.Context, sig models.ComponentSignal) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.signals = append(c.signals, sig)
	return nil
}

func (c *capturePublisher) count() int {
	c.mu.Lock()
	defer c.mu.Unlock()
	return len(c.signals)
}

func newProcessorWithPublisher(pub backpressureSignalSender) *Processor {
	return &Processor{
		natsWriterCache:        make(map[string]writerConfig),
		sem:                    make(chan struct{}, 10),
		signalSender:           pub,
		lastBackpressureSignal: make(map[string]time.Time),
	}
}

func TestEmitBackpressureSignal_SendsOnFirstCall(t *testing.T) {
	pub := &capturePublisher{}
	p := newProcessorWithPublisher(pub)

	p.emitBackpressureSignal(context.Background(), "pipe-1")

	require.Equal(t, 1, pub.count())
	assert.Equal(t, internal.RoleOLTPReceiver, pub.signals[0].Component)
	assert.Equal(t, "pipe-1", pub.signals[0].PipelineID)
}

func TestEmitBackpressureSignal_RateLimitedWithinCooldown(t *testing.T) {
	pub := &capturePublisher{}
	p := newProcessorWithPublisher(pub)

	p.emitBackpressureSignal(context.Background(), "pipe-1")
	p.emitBackpressureSignal(context.Background(), "pipe-1")
	p.emitBackpressureSignal(context.Background(), "pipe-1")

	require.Equal(t, 1, pub.count(), "should emit only once within cooldown window")
}

func TestEmitBackpressureSignal_SendsAgainAfterCooldown(t *testing.T) {
	pub := &capturePublisher{}
	p := newProcessorWithPublisher(pub)

	// Backdate last signal to just beyond the cooldown window.
	p.lastBackpressureSignal["pipe-1"] = time.Now().Add(-(backpressureSignalCooldown + time.Second))

	p.emitBackpressureSignal(context.Background(), "pipe-1")

	require.Equal(t, 1, pub.count(), "should emit after cooldown expires")
}

func TestEmitBackpressureSignal_IndependentPerPipeline(t *testing.T) {
	pub := &capturePublisher{}
	p := newProcessorWithPublisher(pub)

	p.emitBackpressureSignal(context.Background(), "pipe-1")
	p.emitBackpressureSignal(context.Background(), "pipe-2")
	p.emitBackpressureSignal(context.Background(), "pipe-1") // should be suppressed

	require.Equal(t, 2, pub.count(), "each pipeline has its own cooldown")
}

func TestEmitBackpressureSignal_NilPublisher(t *testing.T) {
	p := newProcessorWithPublisher(nil)
	// must not panic
	p.emitBackpressureSignal(context.Background(), "pipe-1")
}

func TestSetupNatsDedupHeader(t *testing.T) {
	fieldName := "user_id"
	cfg := writerConfig{
		routingConfig: models.OTLPConfig{
			Routing: models.RoutingConfig{
				Field: &models.RoutingConfigField{Name: fieldName},
			},
		},
	}

	t.Run("string field value", func(t *testing.T) {
		msg := models.Message{Type: models.MessageTypeNatsMsg}
		msg.SetPayload([]byte(`{"user_id": "abc123"}`))

		result, err := setupNatsDedupHeader(cfg, []models.Message{msg})
		assert.NoError(t, err)

		assert.Equal(t, "abc123", result[0].GetHeader("Nats-Msg-Id"))
	})

	t.Run("int field value", func(t *testing.T) {
		msg := models.Message{Type: models.MessageTypeNatsMsg}
		msg.SetPayload([]byte(`{"user_id": 42}`))

		result, err := setupNatsDedupHeader(cfg, []models.Message{msg})
		assert.NoError(t, err)

		assert.Equal(t, "42", result[0].GetHeader("Nats-Msg-Id"))
	})

	t.Run("schema version header is set", func(t *testing.T) {
		msg := models.Message{Type: models.MessageTypeNatsMsg}
		msg.SetPayload([]byte(`{"user_id": "abc123"}`))

		result := setupSchemaVersionHeader([]models.Message{msg})

		assert.Equal(t, "1", result[0].GetHeader(internal.SchemaVersionIDHeader))
	})
}
