package core

import (
	"encoding/json"
	"fmt"
	"testing"

	"github.com/IBM/sarama"
	"github.com/nats-io/nats.go"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/glassflow/nats-kafka-bridge/server/conf"
	"github.com/glassflow/nats-kafka-bridge/server/logging"
)

func TestNoOp(t *testing.T) {
	conn := &BridgeConnector{}
	require.NoError(t, conn.Start())
	require.NoError(t, conn.Shutdown())
	require.NoError(t, conn.CheckConnections())
}

func TestCalculateKeyInvalidKeyValue(t *testing.T) {
	conn := &BridgeConnector{
		config: conf.ConnectorConfig{
			KeyValue: "[[[",
		},
		bridge: &NATSKafkaBridge{
			logger: logging.NewNATSLogger(logging.Config{}),
		},
		stats: NewConnectorStatsHolder("name", "id"),
	}

	conn.config.KeyType = conf.SubjectRegex
	require.Equal(t, []byte{}, conn.calculateKey("subject", "replyto"))

	conn.config.KeyType = conf.ReplyRegex
	require.Equal(t, []byte{}, conn.calculateKey("subject", "replyto"))
}

func TestConvertFromKafkaToNatsHeadersOk(t *testing.T) {
	conn := &BridgeConnector{
		config: conf.ConnectorConfig{
			KeyValue: "[[[",
		},
		bridge: &NATSKafkaBridge{
			logger: logging.NewNATSLogger(logging.Config{}),
		},
		stats: NewConnectorStatsHolder("name", "id"),
	}

	kHdrs := make([]sarama.RecordHeader, 3)
	kHdrsMap := make(map[string]string)
	i := 0
	for i < len(kHdrs) {
		keyString := fmt.Sprintf("key-%d", i)
		valueString := fmt.Sprintf("value-%d", i)
		kHdrs[i].Key = []byte(keyString)
		kHdrs[i].Value = []byte(valueString)
		i++

		kHdrsMap[keyString] = valueString
	}

	nHdrs := conn.convertFromKafkaToNatsHeaders(kHdrs)
	i = 0
	require.Len(t, nHdrs, 3)
	for nKey, nValue := range nHdrs {
		require.Equal(t, kHdrsMap[nKey], nValue[0])
		i++
	}
}

func TestConvertFromKafkaToNatsHeadersNull(t *testing.T) {
	conn := &BridgeConnector{
		config: conf.ConnectorConfig{
			KeyValue: "[[[",
		},
		bridge: &NATSKafkaBridge{
			logger: logging.NewNATSLogger(logging.Config{}),
		},
		stats: NewConnectorStatsHolder("name", "id"),
	}

	nHdrs := conn.convertFromKafkaToNatsHeaders(nil)
	require.Equal(t, nats.Header{}, nHdrs)
}

func TestGetNestedValue(t *testing.T) {
	tests := []struct {
		name     string
		data     map[string]interface{}
		path     string
		expected interface{}
		exists   bool
	}{
		{
			name: "simple field",
			data: map[string]interface{}{
				"id": "test-id",
			},
			path:     "id",
			expected: "test-id",
			exists:   true,
		},
		{
			name: "nested field",
			data: map[string]interface{}{
				"event": map[string]interface{}{
					"id": "nested-id",
				},
			},
			path:     "event.id",
			expected: "nested-id",
			exists:   true,
		},
		{
			name: "deeply nested field",
			data: map[string]interface{}{
				"user": map[string]interface{}{
					"profile": map[string]interface{}{
						"details": map[string]interface{}{
							"id": "deep-id",
						},
					},
				},
			},
			path:     "user.profile.details.id",
			expected: "deep-id",
			exists:   true,
		},
		{
			name: "field not found",
			data: map[string]interface{}{
				"event": map[string]interface{}{
					"id": "test-id",
				},
			},
			path:     "event.nonexistent",
			expected: nil,
			exists:   false,
		},
		{
			name: "path not found",
			data: map[string]interface{}{
				"event": map[string]interface{}{
					"id": "test-id",
				},
			},
			path:     "nonexistent.id",
			expected: nil,
			exists:   false,
		},
		{
			name:     "empty data",
			data:     nil,
			path:     "event.id",
			expected: nil,
			exists:   false,
		},
		{
			name:     "empty path",
			data:     map[string]interface{}{"id": "test"},
			path:     "",
			expected: nil,
			exists:   false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			value, exists := getNestedValue(tt.data, tt.path)
			assert.Equal(t, tt.exists, exists)
			assert.Equal(t, tt.expected, value)
		})
	}
}

func TestSetupDedupHeaderWithNestedKeys(t *testing.T) {
	tests := []struct {
		name         string
		msg          map[string]interface{}
		dedupKey     string
		dedupKeyType string
		expectError  bool
		expectedID   string
	}{
		{
			name: "nested string dedup key",
			msg: map[string]interface{}{
				"event": map[string]interface{}{
					"id": "test-event-id",
				},
				"message": "hello world",
			},
			dedupKey:     "event.id",
			dedupKeyType: "string",
			expectError:  false,
			expectedID:   "test-event-id",
		},
		{
			name: "nested int dedup key",
			msg: map[string]interface{}{
				"event": map[string]interface{}{
					"id": float64(12345),
				},
				"message": "hello world",
			},
			dedupKey:     "event.id",
			dedupKeyType: "int",
			expectError:  false,
			expectedID:   "12345",
		},
		{
			name: "deeply nested string dedup key",
			msg: map[string]interface{}{
				"user": map[string]interface{}{
					"profile": map[string]interface{}{
						"details": map[string]interface{}{
							"id": "deep-event-id",
						},
					},
				},
				"message": "hello world",
			},
			dedupKey:     "user.profile.details.id",
			dedupKeyType: "string",
			expectError:  false,
			expectedID:   "deep-event-id",
		},
		{
			name: "nested key not found",
			msg: map[string]interface{}{
				"event": map[string]interface{}{
					"id": "test-event-id",
				},
				"message": "hello world",
			},
			dedupKey:     "event.nonexistent",
			dedupKeyType: "string",
			expectError:  true,
		},
		{
			name: "wrong type for string",
			msg: map[string]interface{}{
				"event": map[string]interface{}{
					"id": float64(12345),
				},
				"message": "hello world",
			},
			dedupKey:     "event.id",
			dedupKeyType: "string",
			expectError:  true,
		},
		{
			name: "wrong type for int",
			msg: map[string]interface{}{
				"event": map[string]interface{}{
					"id": "not-a-number",
				},
				"message": "hello world",
			},
			dedupKey:     "event.id",
			dedupKeyType: "int",
			expectError:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			msgBytes, err := json.Marshal(tt.msg)
			require.NoError(t, err)

			header := make(nats.Header)
			err = setupDedupHeader(header, msgBytes, tt.dedupKey, tt.dedupKeyType)

			if tt.expectError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				dedupHeader, exists := header["Nats-Msg-Id"]
				assert.True(t, exists)
				assert.Len(t, dedupHeader, 1)
				assert.Equal(t, tt.expectedID, dedupHeader[0])
			}
		})
	}
}

func TestCheckFilter(t *testing.T) {
	tests := []struct {
		name           string
		msg            map[string]interface{}
		filter         conf.FilterConfig
		expectFiltered bool
		expectError    bool
	}{
		{
			name: "filter disabled - should not filter",
			msg: map[string]interface{}{
				"event_type":  "purchase",
				"environment": "test",
			},
			filter: conf.FilterConfig{
				Enabled:  false,
				Field:    "event_type",
				Operator: conf.FilterOperatorEquals,
				Value:    "purchase",
			},
			expectFiltered: false,
			expectError:    false,
		},
		{
			name: "equals operator - match",
			msg: map[string]interface{}{
				"event_type": "purchase",
				"user_id":    123,
			},
			filter: conf.FilterConfig{
				Enabled:  true,
				Field:    "event_type",
				Operator: conf.FilterOperatorEquals,
				Value:    "purchase",
			},
			expectFiltered: true,
			expectError:    false,
		},
		{
			name: "equals operator - no match",
			msg: map[string]interface{}{
				"event_type": "page_view",
				"user_id":    123,
			},
			filter: conf.FilterConfig{
				Enabled:  true,
				Field:    "event_type",
				Operator: conf.FilterOperatorEquals,
				Value:    "purchase",
			},
			expectFiltered: false,
			expectError:    false,
		},
		{
			name: "not_equals operator - should filter",
			msg: map[string]interface{}{
				"environment": "prod",
			},
			filter: conf.FilterConfig{
				Enabled:  true,
				Field:    "environment",
				Operator: conf.FilterOperatorNotEquals,
				Value:    "test",
			},
			expectFiltered: true,
			expectError:    false,
		},
		{
			name: "not_equals operator - should not filter",
			msg: map[string]interface{}{
				"environment": "test",
			},
			filter: conf.FilterConfig{
				Enabled:  true,
				Field:    "environment",
				Operator: conf.FilterOperatorNotEquals,
				Value:    "test",
			},
			expectFiltered: false,
			expectError:    false,
		},
		{
			name: "nested field - equals match",
			msg: map[string]interface{}{
				"user": map[string]interface{}{
					"profile": map[string]interface{}{
						"name": "John Doe",
						"age":  30,
					},
				},
			},
			filter: conf.FilterConfig{
				Enabled:  true,
				Field:    "user.profile.name",
				Operator: conf.FilterOperatorEquals,
				Value:    "John Doe",
			},
			expectFiltered: true,
			expectError:    false,
		},
	}

	for _, tt := range tests {
		t.Run(
			tt.name, func(t *testing.T) {
				msgBytes, err := json.Marshal(tt.msg)
				require.NoError(t, err)

				shouldFilter, err := checkFilter(msgBytes, tt.filter)

				if tt.expectError {
					assert.Error(t, err)
				} else {
					assert.NoError(t, err)
					assert.Equal(t, tt.expectFiltered, shouldFilter)
				}
			},
		)
	}
}
