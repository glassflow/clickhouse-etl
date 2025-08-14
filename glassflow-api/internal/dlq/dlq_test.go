package dlq

import (
	"encoding/json"
	"testing"

	"github.com/nats-io/nats.go/jetstream"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

func TestGetDurableConsumerConfig(t *testing.T) {
	// Create a mock NATS client (we don't use it, but it's required)
	client := &Client{js: nil}

	streamName := "test-stream"
	config := client.getDurableConsumerConfig(streamName)

	// Test the consumer configuration
	expectedConfig := jetstream.ConsumerConfig{
		Name:          streamName + "-consumer",
		Durable:       streamName + "-consumer",
		AckPolicy:     jetstream.AckAllPolicy,
		FilterSubject: streamName + ".failed",
	}

	assert.Equal(t, expectedConfig.Name, config.Name)
	assert.Equal(t, expectedConfig.Durable, config.Durable)
	assert.Equal(t, expectedConfig.AckPolicy, config.AckPolicy)
	assert.Equal(t, expectedConfig.FilterSubject, config.FilterSubject)
}

func TestGetDurableConsumerConfig_DifferentStreamNames(t *testing.T) {
	client := &Client{js: nil}

	testCases := []struct {
		streamName string
		expected   jetstream.ConsumerConfig
	}{
		{
			streamName: "pipeline-123-DLQ",
			expected: jetstream.ConsumerConfig{
				Name:          "pipeline-123-DLQ-consumer",
				Durable:       "pipeline-123-DLQ-consumer",
				AckPolicy:     jetstream.AckAllPolicy,
				FilterSubject: "pipeline-123-DLQ.failed",
			},
		},
		{
			streamName: "test-pipeline-DLQ",
			expected: jetstream.ConsumerConfig{
				Name:          "test-pipeline-DLQ-consumer",
				Durable:       "test-pipeline-DLQ-consumer",
				AckPolicy:     jetstream.AckAllPolicy,
				FilterSubject: "test-pipeline-DLQ.failed",
			},
		},
		{
			streamName: "empty",
			expected: jetstream.ConsumerConfig{
				Name:          "empty-consumer",
				Durable:       "empty-consumer",
				AckPolicy:     jetstream.AckAllPolicy,
				FilterSubject: "empty.failed",
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.streamName, func(t *testing.T) {
			config := client.getDurableConsumerConfig(tc.streamName)

			assert.Equal(t, tc.expected.Name, config.Name)
			assert.Equal(t, tc.expected.Durable, config.Durable)
			assert.Equal(t, tc.expected.AckPolicy, config.AckPolicy)
			assert.Equal(t, tc.expected.FilterSubject, config.FilterSubject)
		})
	}
}

// TestDLQMessageUnmarshaling tests the JSON unmarshaling logic used in FetchDLQMessages
func TestDLQMessageUnmarshaling(t *testing.T) {
	testCases := []struct {
		name        string
		jsonData    string
		expected    models.DLQMessage
		shouldError bool
	}{
		{
			name:     "valid DLQ message",
			jsonData: `{"component":"test-component","error":"test error","original_message":"test message"}`,
			expected: models.DLQMessage{
				Component:       "test-component",
				Error:           "test error",
				OriginalMessage: models.NewOriginalMessage([]byte("test message")),
			},
			shouldError: false,
		},
		{
			name:     "DLQ message with empty fields",
			jsonData: `{"component":"","error":"","original_message":""}`,
			expected: models.DLQMessage{
				Component:       "",
				Error:           "",
				OriginalMessage: models.NewOriginalMessage([]byte("")),
			},
			shouldError: false,
		},
		{
			name:        "invalid JSON",
			jsonData:    `{"component":"test-component","error":}`,
			expected:    models.DLQMessage{},
			shouldError: true,
		},
		{
			name:        "completely invalid JSON",
			jsonData:    `invalid json`,
			expected:    models.DLQMessage{},
			shouldError: true,
		},
		{
			name:        "empty JSON",
			jsonData:    ``,
			expected:    models.DLQMessage{},
			shouldError: true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			var dlqMsg models.DLQMessage
			err := json.Unmarshal([]byte(tc.jsonData), &dlqMsg)

			if tc.shouldError {
				assert.Error(t, err)
			} else {
				require.NoError(t, err)
				assert.Equal(t, tc.expected.Component, dlqMsg.Component)
				assert.Equal(t, tc.expected.Error, dlqMsg.Error)
				assert.Equal(t, tc.expected.OriginalMessage, dlqMsg.OriginalMessage)
			}
		})
	}
}

// TestDLQStateStructure tests the DLQState structure creation logic used in GetDLQState
func TestDLQStateStructure(t *testing.T) {
	// Test creating DLQState with different scenarios
	testCases := []struct {
		name               string
		totalMessages      uint64
		unconsumedMessages uint64
	}{
		{
			name:               "no messages",
			totalMessages:      0,
			unconsumedMessages: 0,
		},
		{
			name:               "some messages consumed",
			totalMessages:      100,
			unconsumedMessages: 50,
		},
		{
			name:               "all messages consumed",
			totalMessages:      100,
			unconsumedMessages: 0,
		},
		{
			name:               "no messages consumed",
			totalMessages:      100,
			unconsumedMessages: 100,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			state := models.DLQState{
				LastReceivedAt:     nil,
				LastConsumedAt:     nil,
				TotalMessages:      tc.totalMessages,
				UnconsumedMessages: tc.unconsumedMessages,
			}

			assert.Equal(t, tc.totalMessages, state.TotalMessages)
			assert.Equal(t, tc.unconsumedMessages, state.UnconsumedMessages)
			assert.Nil(t, state.LastReceivedAt)
			assert.Nil(t, state.LastConsumedAt)
		})
	}
}
