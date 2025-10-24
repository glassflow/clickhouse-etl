// nolint
package dlq

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/client"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	natsServer "github.com/nats-io/nats-server/v2/server"
	natsTest "github.com/nats-io/nats-server/v2/test"
	"github.com/nats-io/nats.go/jetstream"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetDurableConsumerConfig(t *testing.T) {
	client := &Client{
		jetstreamClient: nil,
	}

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
	client := &Client{
		jetstreamClient: nil,
	}

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

// TestFetchDLQMessages_ValidationErrors tests input validation
func TestFetchDLQMessages_ValidationErrors(t *testing.T) {
	client := &Client{
		jetstreamClient: nil,
	}

	testCases := []struct {
		name      string
		stream    string
		batchSize int
		wantErr   string
	}{
		{
			name:      "empty stream name",
			stream:    "",
			batchSize: 10,
			wantErr:   "stream name cannot be empty",
		},
		{
			name:      "negative batch size",
			stream:    "test-stream",
			batchSize: -1,
			wantErr:   "batch size must be positive",
		},
		{
			name:      "zero batch size",
			stream:    "test-stream",
			batchSize: 0,
			wantErr:   "batch size must be positive",
		},
		{
			name:      "batch size too large",
			stream:    "test-stream",
			batchSize: internal.DLQMaxBatchSize + 1,
			wantErr:   "DLQ batch size cannot be greater than",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := client.FetchDLQMessages(t.Context(), tc.stream, tc.batchSize)
			assert.Error(t, err)
			assert.Contains(t, err.Error(), tc.wantErr)
		})
	}
}

// TestGetDLQState_ValidationErrors tests input validation for GetDLQState
func TestGetDLQState_ValidationErrors(t *testing.T) {
	client := &Client{
		jetstreamClient: nil,
	}

	_, err := client.GetDLQState(t.Context(), "")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "stream name cannot be empty")
}

func TestClient_GetDLQState(t *testing.T) {
	opts := &natsServer.Options{
		Host:      "127.0.0.1",
		Port:      -1, // Random port
		NoLog:     true,
		NoSigs:    true,
		JetStream: true,
	}

	start := time.Now()
	ns := natsTest.RunServer(opts)
	defer func() {
		fmt.Println(time.Since(start).Seconds())
	}()

	defer ns.Shutdown()

	natsURL := ns.ClientURL()

	natsClient, err := client.NewNATSClient(context.Background(), natsURL)
	require.NoError(t, err)
	defer natsClient.Close()

	js := natsClient.JetStream()

	type args struct {
		ctx        context.Context
		streamName string
		setup      func(t *testing.T, js jetstream.JetStream, streamName string)
	}
	tests := []struct {
		name    string
		args    args
		want    func(t *testing.T, state models.DLQState)
		wantErr assert.ErrorAssertionFunc
	}{
		{
			name: "success with messages in stream",
			args: args{
				ctx:        context.Background(),
				streamName: "test-stream-with-messages",
				setup: func(t *testing.T, js jetstream.JetStream, streamName string) {
					// Create stream
					_, err := js.CreateStream(context.Background(), jetstream.StreamConfig{
						Name:     streamName,
						Subjects: []string{streamName + ".failed"},
					})
					require.NoError(t, err)

					// Publish some messages to the stream
					for i := 0; i < 5; i++ {
						_, err := js.Publish(context.Background(), streamName+".failed", []byte(fmt.Sprintf("test message %d", i)))
						require.NoError(t, err)
					}

					// Create consumer to consume some messages
					consumer, err := js.CreateOrUpdateConsumer(context.Background(), streamName, jetstream.ConsumerConfig{
						Name:          streamName + "-consumer",
						Durable:       streamName + "-consumer",
						AckPolicy:     jetstream.AckAllPolicy,
						FilterSubject: streamName + ".failed",
					})
					require.NoError(t, err)

					// Consume and acknowledge 2 messages
					msgs, err := consumer.Fetch(2)
					require.NoError(t, err)
					for msg := range msgs.Messages() {
						err := msg.Ack()
						require.NoError(t, err)
					}
				},
			},
			want: func(t *testing.T, state models.DLQState) {
				assert.NotNil(t, state.LastReceivedAt)
				assert.NotNil(t, state.LastConsumedAt)
				assert.Equal(t, uint64(5), state.TotalMessages)
				assert.Equal(t, uint64(3), state.UnconsumedMessages) // 5 total - 2 consumed = 3 unconsumed
			},
			wantErr: assert.NoError,
		},
		{
			name: "success with empty stream",
			args: args{
				ctx:        context.Background(),
				streamName: "test-stream-empty",
				setup: func(t *testing.T, js jetstream.JetStream, streamName string) {
					// Create stream without any messages
					_, err := js.CreateStream(context.Background(), jetstream.StreamConfig{
						Name:     streamName,
						Subjects: []string{streamName + ".failed"},
					})
					require.NoError(t, err)
				},
			},
			want: func(t *testing.T, state models.DLQState) {
				assert.Equal(t, uint64(0), state.TotalMessages)
				assert.Equal(t, uint64(0), state.UnconsumedMessages)
			},
			wantErr: assert.NoError,
		},
		{
			name: "error when stream does not exist",
			args: args{
				ctx:        context.Background(),
				streamName: "non-existent-stream",
				setup:      func(t *testing.T, js jetstream.JetStream, streamName string) {},
			},
			want: func(t *testing.T, state models.DLQState) {
				// Expect zero value
				assert.Equal(t, models.DLQState{}, state)
			},
			wantErr: assert.Error,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Run setup for this test case
			tt.args.setup(t, js, tt.args.streamName)
			// Cleanup after test
			defer func() {
				_ = js.DeleteStream(context.Background(), tt.args.streamName)
			}()

			c := &Client{
				jetstreamClient: js,
			}
			got, err := c.GetDLQState(tt.args.ctx, tt.args.streamName)
			if !tt.wantErr(t, err, fmt.Sprintf("GetDLQState(%v, %v)", tt.args.ctx, tt.args.streamName)) {
				return
			}
			tt.want(t, got)
		})
	}
}

func TestClient_FetchDLQMessages(t *testing.T) {
	opts := &natsServer.Options{
		Host:      "127.0.0.1",
		Port:      -1, // Random port
		NoLog:     true,
		NoSigs:    true,
		JetStream: true,
	}

	start := time.Now()
	ns := natsTest.RunServer(opts)
	defer func() {
		fmt.Println(time.Since(start).Seconds())
	}()

	defer ns.Shutdown()

	natsURL := ns.ClientURL()

	natsClient, err := client.NewNATSClient(context.Background(), natsURL)
	require.NoError(t, err)
	defer natsClient.Close()

	js := natsClient.JetStream()

	type args struct {
		ctx        context.Context
		streamName string
		batchSize  int
		setup      func(t *testing.T, js jetstream.JetStream, streamName string)
	}
	tests := []struct {
		name    string
		args    args
		want    func(t *testing.T, messages []models.DLQMessage)
		wantErr assert.ErrorAssertionFunc
	}{
		{
			name: "success with multiple DLQ messages",
			args: args{
				ctx:        context.Background(),
				streamName: "test-stream-fetch-messages",
				batchSize:  3,
				setup: func(t *testing.T, js jetstream.JetStream, streamName string) {
					// Create stream
					_, err := js.CreateStream(context.Background(), jetstream.StreamConfig{
						Name:     streamName,
						Subjects: []string{streamName + ".failed"},
					})
					require.NoError(t, err)

					// Create DLQ messages
					dlqMsg1 := models.DLQMessage{
						Component:       "component1",
						Error:           "error1",
						OriginalMessage: models.NewOriginalMessage([]byte("data1")),
					}
					dlqMsg2 := models.DLQMessage{
						Component:       "component2",
						Error:           "error2",
						OriginalMessage: models.NewOriginalMessage([]byte("data2")),
					}
					dlqMsg3 := models.DLQMessage{
						Component:       "component3",
						Error:           "error3",
						OriginalMessage: models.NewOriginalMessage([]byte("data3")),
					}

					// Publish DLQ messages to the stream
					for _, dlqMsg := range []models.DLQMessage{dlqMsg1, dlqMsg2, dlqMsg3} {
						data, err := json.Marshal(dlqMsg)
						require.NoError(t, err)
						_, err = js.Publish(context.Background(), streamName+".failed", data)
						require.NoError(t, err)
					}
				},
			},
			want: func(t *testing.T, messages []models.DLQMessage) {
				assert.Len(t, messages, 3)
				assert.Equal(t, "component1", messages[0].Component)
				assert.Equal(t, "error1", messages[0].Error)
				assert.Equal(t, models.NewOriginalMessage([]byte("data1")), messages[0].OriginalMessage)
				assert.Equal(t, "component2", messages[1].Component)
				assert.Equal(t, "error2", messages[1].Error)
				assert.Equal(t, models.NewOriginalMessage([]byte("data2")), messages[1].OriginalMessage)
				assert.Equal(t, "component3", messages[2].Component)
				assert.Equal(t, "error3", messages[2].Error)
				assert.Equal(t, models.NewOriginalMessage([]byte("data3")), messages[2].OriginalMessage)
			},
			wantErr: assert.NoError,
		},
		{
			name: "success with batch size smaller than available messages",
			args: args{
				ctx:        context.Background(),
				streamName: "test-stream-fetch-partial",
				batchSize:  2,
				setup: func(t *testing.T, js jetstream.JetStream, streamName string) {
					// Create stream
					_, err := js.CreateStream(context.Background(), jetstream.StreamConfig{
						Name:     streamName,
						Subjects: []string{streamName + ".failed"},
					})
					require.NoError(t, err)

					// Publish 5 messages but only fetch 2
					for i := 0; i < 5; i++ {
						dlqMsg := models.DLQMessage{
							Component:       fmt.Sprintf("component%d", i),
							Error:           fmt.Sprintf("error%d", i),
							OriginalMessage: models.NewOriginalMessage([]byte(fmt.Sprintf("data%d", i))),
						}
						data, err := json.Marshal(dlqMsg)
						require.NoError(t, err)
						_, err = js.Publish(context.Background(), streamName+".failed", data)
						require.NoError(t, err)
					}
				},
			},
			want: func(t *testing.T, messages []models.DLQMessage) {
				assert.Len(t, messages, 2)
				assert.Equal(t, "component0", messages[0].Component)
				assert.Equal(t, "component1", messages[1].Component)
			},
			wantErr: assert.NoError,
		},
		{
			name: "error when stream is empty",
			args: args{
				ctx:        context.Background(),
				streamName: "test-stream-empty-fetch",
				batchSize:  10,
				setup: func(t *testing.T, js jetstream.JetStream, streamName string) {
					// Create stream without any messages
					_, err := js.CreateStream(context.Background(), jetstream.StreamConfig{
						Name:     streamName,
						Subjects: []string{streamName + ".failed"},
					})
					require.NoError(t, err)
				},
			},
			want: func(t *testing.T, messages []models.DLQMessage) {
				assert.Nil(t, messages)
			},
			wantErr: func(t assert.TestingT, err error, msgAndArgs ...interface{}) bool {
				return assert.ErrorIs(t, err, internal.ErrNoMessagesInDLQ, msgAndArgs...)
			},
		},
		{
			name: "error when stream does not exist",
			args: args{
				ctx:        context.Background(),
				streamName: "non-existent-stream-fetch",
				batchSize:  10,
				setup:      func(t *testing.T, js jetstream.JetStream, streamName string) {},
			},
			want: func(t *testing.T, messages []models.DLQMessage) {
				assert.Nil(t, messages)
			},
			wantErr: func(t assert.TestingT, err error, msgAndArgs ...interface{}) bool {
				return assert.ErrorIs(t, err, internal.ErrDLQNotExists, msgAndArgs...)
			},
		},
		{
			name: "success with single message",
			args: args{
				ctx:        context.Background(),
				streamName: "test-stream-single-message",
				batchSize:  10,
				setup: func(t *testing.T, js jetstream.JetStream, streamName string) {
					// Create stream
					_, err := js.CreateStream(context.Background(), jetstream.StreamConfig{
						Name:     streamName,
						Subjects: []string{streamName + ".failed"},
					})
					require.NoError(t, err)

					// Publish one message
					dlqMsg := models.DLQMessage{
						Component:       "single-component",
						Error:           "single-error",
						OriginalMessage: models.NewOriginalMessage([]byte("single-data")),
					}
					data, err := json.Marshal(dlqMsg)
					require.NoError(t, err)
					_, err = js.Publish(context.Background(), streamName+".failed", data)
					require.NoError(t, err)
				},
			},
			want: func(t *testing.T, messages []models.DLQMessage) {
				assert.Len(t, messages, 1)
				assert.Equal(t, "single-component", messages[0].Component)
				assert.Equal(t, "single-error", messages[0].Error)
				assert.Equal(t, models.NewOriginalMessage([]byte("single-data")), messages[0].OriginalMessage)
			},
			wantErr: assert.NoError,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Run setup for this test case
			tt.args.setup(t, js, tt.args.streamName)
			// Cleanup after test
			defer func() {
				_ = js.DeleteStream(context.Background(), tt.args.streamName)
			}()

			c := &Client{
				jetstreamClient: js,
			}
			got, err := c.FetchDLQMessages(tt.args.ctx, tt.args.streamName, tt.args.batchSize)
			if !tt.wantErr(t, err, fmt.Sprintf("FetchDLQMessages(%v, %v, %v)", tt.args.ctx, tt.args.streamName, tt.args.batchSize)) {
				return
			}
			tt.want(t, got)
		})
	}
}
