package processor

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

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
