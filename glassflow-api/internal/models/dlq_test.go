package models

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestDLQNewBatchSuccess(t *testing.T) {
	bs, err := NewDLQBatchSize(50)
	require.NoError(t, err)

	require.Equal(t, 50, bs.Int)
}

func TestDLQNewBatchForEmptySizeSuccess(t *testing.T) {
	bs, err := NewDLQBatchSize(0)
	require.NoError(t, err)

	require.Equal(t, 100, bs.Int)
}

func TestDLQNewBatchGreaterThanMaxAllowedFail(t *testing.T) {
	s, err := NewDLQBatchSize(1000)
	require.EqualError(t, err, ErrDLQMaxBatchSize.Error())

	require.Empty(t, s)
}

func TestNewDLQMessage(t *testing.T) {
	data := []byte("test message")
	dlqMsg := NewDLQMessage("test-component", "test error", data)

	require.Equal(t, "test-component", dlqMsg.Component)
	require.Equal(t, "test error", dlqMsg.Error)
	require.Equal(t, Payload(data), dlqMsg.OriginalMessage)
}

func TestDLQMessageToJSON(t *testing.T) {
	data := []byte("test message")
	dlqMsg := NewDLQMessage("test-component", "test error", data)

	jsonData, err := dlqMsg.ToJSON()
	require.NoError(t, err)

	expectedJSON := fmt.Sprintf(`{"component":"%s","error":"%s","original_message":"%s"}`, dlqMsg.Component, dlqMsg.Error, data)
	require.JSONEq(t, expectedJSON, string(jsonData))
}
