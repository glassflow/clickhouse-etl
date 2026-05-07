package processor

import (
	"errors"
	"fmt"
	"testing"

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
