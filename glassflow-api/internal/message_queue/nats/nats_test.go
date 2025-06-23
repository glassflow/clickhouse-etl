package nats

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/nats-io/nats.go/jetstream"
	"github.com/stretchr/testify/require"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/service"
)

const testDLQStream = "test-DLQ"

func setupTest(t *testing.T) *JSClient {
	t.Helper()

	client, err := NewClient("http://localhost:4222")
	if err != nil {
		t.Fatal("couldn't connect to NATS: ", err)
	}

	_, err = client.js.CreateOrUpdateStream(t.Context(), jetstream.StreamConfig{
		Name:        testDLQStream,
		Description: "test stream for test-mq-DLQ",
		Subjects:    []string{testDLQStream + ".*"},
	})
	if err != nil {
		t.Fatal("couldn't create test stream: ", err)
	}

	t.Cleanup(func() {
		//nolint: usetesting // t.Context() is done before cleanup is called
		err := client.js.DeleteStream(context.Background(), testDLQStream)
		if err != nil {
			t.Fatal(err)
		}
	})

	return client
}

func TestFetchMessagesNonExistingStreamFail(t *testing.T) {
	c := setupTest(t)
	msgs, err := c.FetchDLQMessages(t.Context(), "invalid-stream-name", 20)
	require.EqualError(t, service.ErrDLQNotExists, err.Error())
	require.Empty(t, msgs)
}

func TestFetchMessagesFromTestDLQSuccess(t *testing.T) {
	c := setupTest(t)

	dlqMsgs := []models.DLQMessage{
		{
			Component:       "test",
			Error:           "schema test error",
			OriginalMessage: models.NewOriginalMessage([]byte("test message")),
		},
		{
			Component:       "test",
			Error:           "schema test error",
			OriginalMessage: models.NewOriginalMessage([]byte("test message")),
		},
	}

	for _, msg := range dlqMsgs {
		payload, err := json.Marshal(msg)
		if err != nil {
			t.Fatal("couldn't marshal test dlq msgs: ", err)
		}

		_, err = c.js.Publish(t.Context(), testDLQStream+".failed", payload)
		if err != nil {
			t.Fatal("failed to publish test msgs to JS: %", err)
		}
	}

	msgs, err := c.FetchDLQMessages(t.Context(), testDLQStream, 20)
	require.NoError(t, err)
	require.Len(t, msgs, len(dlqMsgs))
}

func TestGetDLQStateWhenNothingConsumedSuccess(t *testing.T) {
	c := setupTest(t)

	dlqMsgs := []models.DLQMessage{
		{
			Component:       "test",
			Error:           "schema test error",
			OriginalMessage: models.NewOriginalMessage([]byte("test message")),
		},
		{
			Component:       "test",
			Error:           "schema test error",
			OriginalMessage: models.NewOriginalMessage([]byte("test message")),
		},
	}

	receivedAt := time.Now().UTC()
	for _, msg := range dlqMsgs {
		payload, err := json.Marshal(msg)
		if err != nil {
			t.Fatal("couldn't marshal test dlq msgs: ", err)
		}

		_, err = c.js.Publish(t.Context(), testDLQStream+".failed", payload)
		if err != nil {
			t.Fatal("failed to publish test msgs to JS: %", err)
		}
	}

	dlqState, err := c.GetDLQState(t.Context(), testDLQStream)
	require.NoError(t, err)
	require.Equal(t, uint64(len(dlqMsgs)), dlqState.TotalMessages)
	//nolint: gosec // allow conversion in test
	require.Equal(t, uint64(len(dlqMsgs)), dlqState.UnconsumedMessages)
	require.Nil(t, dlqState.LastConsumedAt)
	require.NotNil(t, dlqState.LastReceivedAt)
	require.InDelta(t, receivedAt.UnixNano(), dlqState.LastReceivedAt.UnixNano(), float64(time.Millisecond))
}

func TestGetDLQStateOneConsumedSuccess(t *testing.T) {
	c := setupTest(t)

	dlqMsgs := []models.DLQMessage{
		{
			Component:       "test",
			Error:           "schema test error",
			OriginalMessage: models.NewOriginalMessage([]byte("test message")),
		},
		{
			Component:       "test",
			Error:           "schema test error",
			OriginalMessage: models.NewOriginalMessage([]byte("test message")),
		},
	}

	for _, msg := range dlqMsgs {
		payload, err := json.Marshal(msg)
		if err != nil {
			t.Fatal("couldn't marshal test dlq msgs: ", err)
		}

		_, err = c.js.Publish(t.Context(), testDLQStream+".failed", payload)
		if err != nil {
			t.Fatal("failed to publish test msgs to JS: %", err)
		}
	}

	dcConfig := c.getDurableConsumerConfig(testDLQStream)
	dc, err := c.js.CreateOrUpdateConsumer(t.Context(), testDLQStream, dcConfig)
	if err != nil {
		t.Fatal("couldn't create consumer for state: ", err)
	}

	consumedAt := time.Now()
	batch, err := dc.FetchNoWait(1)
	if err != nil {
		t.Fatal("couldn't fetch from DLQ test consumer: ", err)
	}

	for msg := range batch.Messages() {
		err := msg.Ack()
		if err != nil {
			t.Fatal("couldn't acknowledge msg: ", err)
		}
	}

	dlqState, err := c.GetDLQState(t.Context(), testDLQStream)
	require.NoError(t, err)
	require.Equal(t, uint64(len(dlqMsgs)), dlqState.TotalMessages)
	//nolint: gosec // allow conversion in test
	require.Equal(t, uint64(len(dlqMsgs)-1), dlqState.UnconsumedMessages)
	require.NotNil(t, dlqState.LastConsumedAt)
	require.InDelta(t, consumedAt.UnixNano(), dlqState.LastConsumedAt.UnixNano(), float64(time.Millisecond))
}

func TestGetDLQStateNonExistingStreamFail(t *testing.T) {
	c := setupTest(t)
	msgs, err := c.GetDLQState(t.Context(), "invalid-stream-name")
	require.EqualError(t, service.ErrDLQNotExists, err.Error())
	require.Empty(t, msgs)
}
