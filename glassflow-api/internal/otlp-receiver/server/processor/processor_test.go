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

	t.Run("multikey gjson object syntax produces key-order-dependent header", func(t *testing.T) {
		// gjson object multipath: output key order follows the query string order,
		// so {"a":f1,"b":f2} and {"b":f2,"a":f1} produce different strings for the same data.
		cfgAB := writerConfig{routingConfig: models.OTLPConfig{Routing: models.RoutingConfig{Field: &models.RoutingConfigField{Name: `{"a":user_id,"b":session_id}`}}}}
		cfgBA := writerConfig{routingConfig: models.OTLPConfig{Routing: models.RoutingConfig{Field: &models.RoutingConfigField{Name: `{"b":session_id,"a":user_id}`}}}}

		payload := []byte(`{"user_id": "u1", "session_id": "s1"}`)
		msgAB := models.Message{Type: models.MessageTypeNatsMsg}
		msgAB.SetPayload(payload)
		msgBA := models.Message{Type: models.MessageTypeNatsMsg}
		msgBA.SetPayload(payload)

		resAB, err := setupNatsDedupHeader(cfgAB, []models.Message{msgAB})
		require.NoError(t, err)
		resBA, err := setupNatsDedupHeader(cfgBA, []models.Message{msgBA})
		require.NoError(t, err)

		headerAB := resAB[0].GetHeader("Nats-Msg-Id")
		headerBA := resBA[0].GetHeader("Nats-Msg-Id")

		// Same data, same fields, different query key order → different header → dedup breaks
		assert.NotEqual(t, headerAB, headerBA, "object multipath key order affects dedup id — this is the bug")
	})

	t.Run("multikey gjson array syntax mixed data types", func(t *testing.T) {
		// user_id is a string, session_count is an int — gjson array multipath preserves native types in JSON output
		cfgArr := writerConfig{routingConfig: models.OTLPConfig{Routing: models.RoutingConfig{Field: &models.RoutingConfigField{Name: `[user_id,session_count]`}}}}

		msg := models.Message{Type: models.MessageTypeNatsMsg}
		msg.SetPayload([]byte(`{"user_id": "u1", "session_count": 42}`))

		res, err := setupNatsDedupHeader(cfgArr, []models.Message{msg})
		require.NoError(t, err)

		// gjson renders: string stays quoted, int stays unquoted
		assert.Equal(t, `["u1",42]`, res[0].GetHeader("Nats-Msg-Id"))
	})

	t.Run("multikey gjson array syntax produces order-stable header", func(t *testing.T) {
		// gjson array multipath: output is positional, no keys, always same string for same values.
		cfgArr := writerConfig{routingConfig: models.OTLPConfig{Routing: models.RoutingConfig{Field: &models.RoutingConfigField{Name: `[user_id,session_id]`}}}}

		payload := []byte(`{"user_id": "u1", "session_id": "s1"}`)
		msg1 := models.Message{Type: models.MessageTypeNatsMsg}
		msg1.SetPayload(payload)
		msg2 := models.Message{Type: models.MessageTypeNatsMsg}
		msg2.SetPayload(payload)

		res1, err := setupNatsDedupHeader(cfgArr, []models.Message{msg1})
		require.NoError(t, err)
		res2, err := setupNatsDedupHeader(cfgArr, []models.Message{msg2})
		require.NoError(t, err)

		assert.Equal(t, `["u1","s1"]`, res1[0].GetHeader("Nats-Msg-Id"))
		assert.Equal(t, res1[0].GetHeader("Nats-Msg-Id"), res2[0].GetHeader("Nats-Msg-Id"), "array multipath is stable")
	})

	t.Run("schema version header is set", func(t *testing.T) {
		msg := models.Message{Type: models.MessageTypeNatsMsg}
		msg.SetPayload([]byte(`{"user_id": "abc123"}`))

		result := setupSchemaVersionHeader([]models.Message{msg})

		assert.Equal(t, "1", result[0].GetHeader(internal.SchemaVersionIDHeader))
	})
}
