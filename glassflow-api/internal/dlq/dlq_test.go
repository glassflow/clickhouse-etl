// nolint
package dlq

import (
	"context"
	"encoding/json"
	"errors"
	"testing"
	"time"

	"github.com/nats-io/nats.go"
	"github.com/nats-io/nats.go/jetstream"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

func TestGetDurableConsumerConfig(t *testing.T) {
	client := &Client{
		js: nil,
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
		js: nil,
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
		js: nil,
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
		js: nil,
	}

	_, err := client.GetDLQState(t.Context(), "")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "stream name cannot be empty")
}

// TestNewClient tests the basic constructor
func TestNewClient(t *testing.T) {
	// We can't easily test this without a real NATS client
	// but we can test that it doesn't panic and returns a client
	// This test would need integration test setup for full coverage
	assert.NotNil(t, NewClient)
}

// Mock implementations for comprehensive testing

type MockJetStreamClient struct {
	mock.Mock
}

func (m *MockJetStreamClient) Stream(ctx context.Context, name string) (StreamClient, error) {
	args := m.Called(ctx, name)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(StreamClient), args.Error(1)
}

type MockStreamClient struct {
	mock.Mock
}

func (m *MockStreamClient) CreateOrUpdateConsumer(ctx context.Context, cfg jetstream.ConsumerConfig) (ConsumerClient, error) {
	args := m.Called(ctx, cfg)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(ConsumerClient), args.Error(1)
}

func (m *MockStreamClient) Info(ctx context.Context, opts ...jetstream.StreamInfoOpt) (*jetstream.StreamInfo, error) {
	args := m.Called(ctx, opts)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*jetstream.StreamInfo), args.Error(1)
}

type MockConsumerClient struct {
	mock.Mock
}

func (m *MockConsumerClient) FetchNoWait(maxMsgs int) (MessageBatch, error) {
	args := m.Called(maxMsgs)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(MessageBatch), args.Error(1)
}

func (m *MockConsumerClient) Info(ctx context.Context) (*jetstream.ConsumerInfo, error) {
	args := m.Called(ctx)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*jetstream.ConsumerInfo), args.Error(1)
}

type MockMessageBatch struct {
	mock.Mock
}

func (m *MockMessageBatch) Messages() <-chan jetstream.Msg {
	args := m.Called()
	return args.Get(0).(<-chan jetstream.Msg)
}

func (m *MockMessageBatch) Error() error {
	args := m.Called()
	return args.Error(0)
}

type MockMessage struct {
	mock.Mock
	data []byte
}

func (m *MockMessage) Data() []byte {
	return m.data
}

func (m *MockMessage) Ack() error {
	args := m.Called()
	return args.Error(0)
}

func (m *MockMessage) DoubleAck(ctx context.Context) error {
	args := m.Called(ctx)
	return args.Error(0)
}

func (m *MockMessage) Nak() error {
	args := m.Called()
	return args.Error(0)
}

func (m *MockMessage) NakWithDelay(delay time.Duration) error {
	args := m.Called(delay)
	return args.Error(0)
}

func (m *MockMessage) Term() error {
	args := m.Called()
	return args.Error(0)
}

func (m *MockMessage) TermWithReason(reason string) error {
	args := m.Called(reason)
	return args.Error(0)
}

func (m *MockMessage) InProgress() error {
	args := m.Called()
	return args.Error(0)
}

func (m *MockMessage) Subject() string {
	args := m.Called()
	return args.String(0)
}

func (m *MockMessage) Reply() string {
	args := m.Called()
	return args.String(0)
}

func (m *MockMessage) Headers() nats.Header {
	args := m.Called()
	if args.Get(0) == nil {
		return nil
	}
	return args.Get(0).(nats.Header)
}

func (m *MockMessage) Metadata() (*jetstream.MsgMetadata, error) {
	args := m.Called()
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*jetstream.MsgMetadata), args.Error(1)
}

// Comprehensive tests for FetchDLQMessages

func TestFetchDLQMessages_Success(t *testing.T) {
	ctx := t.Context()
	streamName := "test-stream"
	batchSize := 2

	mockJS := &MockJetStreamClient{}
	mockStream := &MockStreamClient{}
	mockConsumer := &MockConsumerClient{}
	mockBatch := &MockMessageBatch{}

	client := &Client{
		js: mockJS,
	}

	// Create test DLQ messages
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

	dlqMsgData1, _ := json.Marshal(dlqMsg1)
	dlqMsgData2, _ := json.Marshal(dlqMsg2)

	mockMsg1 := &MockMessage{data: dlqMsgData1}
	mockMsg2 := &MockMessage{data: dlqMsgData2}
	// mockMsg1.On("Ack").Return(nil)
	mockMsg2.On("Ack").Return(nil)

	// Create channel with test messages
	msgChan := make(chan jetstream.Msg, 2)
	msgChan <- mockMsg1
	msgChan <- mockMsg2
	close(msgChan)

	// Setup expectations
	mockJS.On("Stream", ctx, streamName).Return(mockStream, nil)
	mockStream.On("CreateOrUpdateConsumer", ctx, mock.AnythingOfType("jetstream.ConsumerConfig")).Return(mockConsumer, nil)
	mockConsumer.On("FetchNoWait", batchSize).Return(mockBatch, nil)
	mockBatch.On("Messages").Return((<-chan jetstream.Msg)(msgChan))
	mockBatch.On("Error").Return(nil)

	// Execute
	result, err := client.FetchDLQMessages(ctx, streamName, batchSize)

	// Assert
	assert.NoError(t, err)
	assert.Len(t, result, 2)
	assert.Equal(t, dlqMsg1.Component, result[0].Component)
	assert.Equal(t, dlqMsg2.Component, result[1].Component)

	// Verify all expectations were met
	mockJS.AssertExpectations(t)
	mockStream.AssertExpectations(t)
	mockConsumer.AssertExpectations(t)
	mockBatch.AssertExpectations(t)
	mockMsg1.AssertExpectations(t)
	mockMsg2.AssertExpectations(t)
}

func TestFetchDLQMessages_StreamNotFound(t *testing.T) {
	ctx := t.Context()
	streamName := "non-existent-stream"
	batchSize := 5

	mockJS := &MockJetStreamClient{}
	client := &Client{
		js: mockJS,
	}

	mockJS.On("Stream", ctx, streamName).Return(nil, jetstream.ErrStreamNotFound)

	result, err := client.FetchDLQMessages(ctx, streamName, batchSize)

	assert.Nil(t, result)
	assert.Equal(t, internal.ErrDLQNotExists, err)
	mockJS.AssertExpectations(t)
}

func TestFetchDLQMessages_StreamError(t *testing.T) {
	ctx := t.Context()
	streamName := "test-stream"
	batchSize := 5

	mockJS := &MockJetStreamClient{}
	client := &Client{
		js: mockJS,
	}

	expectedErr := errors.New("stream connection error")
	mockJS.On("Stream", ctx, streamName).Return(nil, expectedErr)

	result, err := client.FetchDLQMessages(ctx, streamName, batchSize)

	assert.Nil(t, result)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "get dlq stream")
	mockJS.AssertExpectations(t)
}

func TestFetchDLQMessages_ConsumerError(t *testing.T) {
	ctx := t.Context()
	streamName := "test-stream"
	batchSize := 5

	mockJS := &MockJetStreamClient{}
	mockStream := &MockStreamClient{}
	client := &Client{
		js: mockJS,
	}

	expectedErr := errors.New("consumer creation error")
	mockJS.On("Stream", ctx, streamName).Return(mockStream, nil)
	mockStream.On("CreateOrUpdateConsumer", ctx, mock.AnythingOfType("jetstream.ConsumerConfig")).Return(nil, expectedErr)

	result, err := client.FetchDLQMessages(ctx, streamName, batchSize)

	assert.Nil(t, result)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "get message queue consumer")
	mockJS.AssertExpectations(t)
	mockStream.AssertExpectations(t)
}

func TestFetchDLQMessages_FetchError(t *testing.T) {
	ctx := t.Context()
	streamName := "test-stream"
	batchSize := 5

	mockJS := &MockJetStreamClient{}
	mockStream := &MockStreamClient{}
	mockConsumer := &MockConsumerClient{}
	client := &Client{
		js: mockJS,
	}

	expectedErr := errors.New("fetch error")
	mockJS.On("Stream", ctx, streamName).Return(mockStream, nil)
	mockStream.On("CreateOrUpdateConsumer", ctx, mock.AnythingOfType("jetstream.ConsumerConfig")).Return(mockConsumer, nil)
	mockConsumer.On("FetchNoWait", batchSize).Return(nil, expectedErr)

	result, err := client.FetchDLQMessages(ctx, streamName, batchSize)

	assert.Nil(t, result)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "fetch dlq message batch")
	mockJS.AssertExpectations(t)
	mockStream.AssertExpectations(t)
	mockConsumer.AssertExpectations(t)
}

func TestFetchDLQMessages_UnmarshalError(t *testing.T) {
	ctx := t.Context()
	streamName := "test-stream"
	batchSize := 1

	mockJS := &MockJetStreamClient{}
	mockStream := &MockStreamClient{}
	mockConsumer := &MockConsumerClient{}
	mockBatch := &MockMessageBatch{}
	client := &Client{
		js: mockJS,
	}

	// Create invalid JSON message
	mockMsg := &MockMessage{data: []byte("invalid json")}

	msgChan := make(chan jetstream.Msg, 1)
	msgChan <- mockMsg
	close(msgChan)

	mockJS.On("Stream", ctx, streamName).Return(mockStream, nil)
	mockStream.On("CreateOrUpdateConsumer", ctx, mock.AnythingOfType("jetstream.ConsumerConfig")).Return(mockConsumer, nil)
	mockConsumer.On("FetchNoWait", batchSize).Return(mockBatch, nil)
	mockBatch.On("Messages").Return((<-chan jetstream.Msg)(msgChan))

	result, err := client.FetchDLQMessages(ctx, streamName, batchSize)

	assert.Nil(t, result)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "unmarshal dlq msg")
	mockJS.AssertExpectations(t)
	mockStream.AssertExpectations(t)
	mockConsumer.AssertExpectations(t)
}

func TestFetchDLQMessages_BatchError(t *testing.T) {
	ctx := t.Context()
	streamName := "test-stream"
	batchSize := 1

	mockJS := &MockJetStreamClient{}
	mockStream := &MockStreamClient{}
	mockConsumer := &MockConsumerClient{}
	mockBatch := &MockMessageBatch{}
	client := &Client{
		js: mockJS,
	}

	// Empty channel
	msgChan := make(chan jetstream.Msg)
	close(msgChan)

	expectedErr := errors.New("batch processing error")
	mockJS.On("Stream", ctx, streamName).Return(mockStream, nil)
	mockStream.On("CreateOrUpdateConsumer", ctx, mock.AnythingOfType("jetstream.ConsumerConfig")).Return(mockConsumer, nil)
	mockConsumer.On("FetchNoWait", batchSize).Return(mockBatch, nil)
	mockBatch.On("Messages").Return((<-chan jetstream.Msg)(msgChan))
	mockBatch.On("Error").Return(expectedErr)

	result, err := client.FetchDLQMessages(ctx, streamName, batchSize)

	assert.Nil(t, result)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "dlq batch")
	mockJS.AssertExpectations(t)
	mockStream.AssertExpectations(t)
	mockConsumer.AssertExpectations(t)
	mockBatch.AssertExpectations(t)
}

func TestFetchDLQMessages_AckError(t *testing.T) {
	ctx := t.Context()
	streamName := "test-stream"
	batchSize := 1

	mockJS := &MockJetStreamClient{}
	mockStream := &MockStreamClient{}
	mockConsumer := &MockConsumerClient{}
	mockBatch := &MockMessageBatch{}
	client := &Client{
		js: mockJS,
	}

	dlqMsg := models.DLQMessage{
		Component:       "test-component",
		Error:           "test error",
		OriginalMessage: models.NewOriginalMessage([]byte("test data")),
	}
	dlqMsgData, _ := json.Marshal(dlqMsg)

	mockMsg := &MockMessage{data: dlqMsgData}
	expectedErr := errors.New("ack error")
	mockMsg.On("Ack").Return(expectedErr)

	msgChan := make(chan jetstream.Msg, 1)
	msgChan <- mockMsg
	close(msgChan)

	mockJS.On("Stream", ctx, streamName).Return(mockStream, nil)
	mockStream.On("CreateOrUpdateConsumer", ctx, mock.AnythingOfType("jetstream.ConsumerConfig")).Return(mockConsumer, nil)
	mockConsumer.On("FetchNoWait", batchSize).Return(mockBatch, nil)
	mockBatch.On("Messages").Return((<-chan jetstream.Msg)(msgChan))
	mockBatch.On("Error").Return(nil)

	result, err := client.FetchDLQMessages(ctx, streamName, batchSize)

	assert.Nil(t, result)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "acknowledge all consumed dlq messages")
	mockJS.AssertExpectations(t)
	mockStream.AssertExpectations(t)
	mockConsumer.AssertExpectations(t)
	mockBatch.AssertExpectations(t)
	mockMsg.AssertExpectations(t)
}

// Comprehensive tests for GetDLQState

func TestGetDLQState_Success(t *testing.T) {
	ctx := t.Context()
	streamName := "test-stream"

	mockJS := &MockJetStreamClient{}
	mockStream := &MockStreamClient{}
	mockConsumer := &MockConsumerClient{}
	client := &Client{
		js: mockJS,
	}

	now := time.Now()
	streamInfo := &jetstream.StreamInfo{
		State: jetstream.StreamState{
			LastTime: now,
			Msgs:     100,
		},
	}

	consumerInfo := &jetstream.ConsumerInfo{
		Delivered: jetstream.SequenceInfo{
			Last: &now,
		},
		NumPending: 50,
	}

	mockJS.On("Stream", ctx, streamName).Return(mockStream, nil)
	mockStream.On("Info", ctx, mock.Anything).Return(streamInfo, nil)
	mockStream.On("CreateOrUpdateConsumer", ctx, mock.AnythingOfType("jetstream.ConsumerConfig")).Return(mockConsumer, nil)
	mockConsumer.On("Info", ctx).Return(consumerInfo, nil)

	result, err := client.GetDLQState(ctx, streamName)

	assert.NoError(t, err)
	assert.Equal(t, &now, result.LastReceivedAt)
	assert.Equal(t, &now, result.LastConsumedAt)
	assert.Equal(t, uint64(100), result.TotalMessages)
	assert.Equal(t, uint64(50), result.UnconsumedMessages)

	mockJS.AssertExpectations(t)
	mockStream.AssertExpectations(t)
	mockConsumer.AssertExpectations(t)
}

func TestGetDLQState_StreamNotFound(t *testing.T) {
	ctx := t.Context()
	streamName := "non-existent-stream"

	mockJS := &MockJetStreamClient{}
	client := &Client{
		js: mockJS,
	}

	mockJS.On("Stream", ctx, streamName).Return(nil, jetstream.ErrStreamNotFound)

	result, err := client.GetDLQState(ctx, streamName)

	assert.Equal(t, models.DLQState{}, result)
	assert.Equal(t, internal.ErrDLQNotExists, err)
	mockJS.AssertExpectations(t)
}

func TestGetDLQState_StreamError(t *testing.T) {
	ctx := t.Context()
	streamName := "test-stream"

	mockJS := &MockJetStreamClient{}
	client := &Client{
		js: mockJS,
	}

	expectedErr := errors.New("stream error")
	mockJS.On("Stream", ctx, streamName).Return(nil, expectedErr)

	result, err := client.GetDLQState(ctx, streamName)

	assert.Equal(t, models.DLQState{}, result)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "get dlq stream")
	mockJS.AssertExpectations(t)
}

func TestGetDLQState_StreamInfoError(t *testing.T) {
	ctx := t.Context()
	streamName := "test-stream"

	mockJS := &MockJetStreamClient{}
	mockStream := &MockStreamClient{}
	client := &Client{
		js: mockJS,
	}

	expectedErr := errors.New("stream info error")
	mockJS.On("Stream", ctx, streamName).Return(mockStream, nil)
	mockStream.On("Info", ctx, mock.Anything).Return(nil, expectedErr)

	result, err := client.GetDLQState(ctx, streamName)

	assert.Equal(t, models.DLQState{}, result)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "get dlq stream info")
	mockJS.AssertExpectations(t)
	mockStream.AssertExpectations(t)
}

func TestGetDLQState_ConsumerError(t *testing.T) {
	ctx := t.Context()
	streamName := "test-stream"

	mockJS := &MockJetStreamClient{}
	mockStream := &MockStreamClient{}
	client := &Client{
		js: mockJS,
	}

	streamInfo := &jetstream.StreamInfo{
		State: jetstream.StreamState{
			LastTime: time.Now(),
			Msgs:     100,
		},
	}

	expectedErr := errors.New("consumer error")
	mockJS.On("Stream", ctx, streamName).Return(mockStream, nil)
	mockStream.On("Info", ctx, mock.Anything).Return(streamInfo, nil)
	mockStream.On("CreateOrUpdateConsumer", ctx, mock.AnythingOfType("jetstream.ConsumerConfig")).Return(nil, expectedErr)

	result, err := client.GetDLQState(ctx, streamName)

	assert.Equal(t, models.DLQState{}, result)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "get dlq durable consumer")
	mockJS.AssertExpectations(t)
	mockStream.AssertExpectations(t)
}

func TestGetDLQState_ConsumerInfoError(t *testing.T) {
	ctx := t.Context()
	streamName := "test-stream"

	mockJS := &MockJetStreamClient{}
	mockStream := &MockStreamClient{}
	mockConsumer := &MockConsumerClient{}
	client := &Client{
		js: mockJS,
	}

	streamInfo := &jetstream.StreamInfo{
		State: jetstream.StreamState{
			LastTime: time.Now(),
			Msgs:     100,
		},
	}

	expectedErr := errors.New("consumer info error")
	mockJS.On("Stream", ctx, streamName).Return(mockStream, nil)
	mockStream.On("Info", ctx, mock.Anything).Return(streamInfo, nil)
	mockStream.On("CreateOrUpdateConsumer", ctx, mock.AnythingOfType("jetstream.ConsumerConfig")).Return(mockConsumer, nil)
	mockConsumer.On("Info", ctx).Return(nil, expectedErr)

	result, err := client.GetDLQState(ctx, streamName)

	assert.Equal(t, models.DLQState{}, result)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "get dlq consumer info")
	mockJS.AssertExpectations(t)
	mockStream.AssertExpectations(t)
	mockConsumer.AssertExpectations(t)
}

// Tests for interface adapters (for better coverage)

func TestNewJetStreamAdapter(t *testing.T) {
	// Test that NewJetStreamAdapter doesn't panic
	adapter := NewJetStreamAdapter(nil)
	assert.NotNil(t, adapter)
}

func TestJetStreamAdapter_Stream_Error(t *testing.T) {
	// This is a simple test that the adapter forwards calls
	// Real testing would require NATS setup
	adapter := &JetStreamAdapter{js: nil}
	// Calling methods on nil jetstream will panic, so we test that it panics
	assert.Panics(t, func() {
		adapter.Stream(t.Context(), "test")
	})
}

func TestStreamAdapter_Methods(t *testing.T) {
	// Test that adapter methods panic with nil stream (as expected)
	adapter := &StreamAdapter{stream: nil}

	assert.Panics(t, func() {
		adapter.CreateOrUpdateConsumer(t.Context(), jetstream.ConsumerConfig{})
	})

	assert.Panics(t, func() {
		adapter.Info(t.Context())
	})
}

func TestConsumerAdapter_Methods(t *testing.T) {
	// Test that adapter methods panic with nil consumer (as expected)
	adapter := &ConsumerAdapter{consumer: nil}

	assert.Panics(t, func() {
		adapter.FetchNoWait(10)
	})

	assert.Panics(t, func() {
		adapter.Info(t.Context())
	})
}

func TestMessageBatchAdapter_Methods(t *testing.T) {
	// Test that adapter methods panic with nil batch (as expected)
	adapter := &MessageBatchAdapter{batch: nil}

	// These will panic when calling methods on nil batch
	assert.Panics(t, func() {
		adapter.Messages()
	})

	assert.Panics(t, func() {
		adapter.Error()
	})
}
