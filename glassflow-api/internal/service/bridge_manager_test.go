package service

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

type MockBridge struct {
	calledTimes int
}

func (t *MockBridge) ID() string {
	return uuid.New().String()
}

func (t *MockBridge) Start() error {
	t.calledTimes++
	return nil
}

func (t *MockBridge) Stop(_ context.Context) {
	t.calledTimes--
}

type MockBridgeFactory struct{}

func newMockFactory() *MockBridgeFactory {
	return &MockBridgeFactory{}
}

func (t *MockBridgeFactory) CreateBridge(_ *models.KafkaConfig, _ *models.BridgeSpec) Bridge {
	return &MockBridge{}
}

func TestAllBridgesStartedAndStopped(t *testing.T) {
	bMgr := NewBridgeRunner(newMockFactory())

	numberOfTopics := 5
	streams := make([]models.StreamConfig, numberOfTopics)

	err := bMgr.SetupBridges(&models.KafkaConfig{}, streams)
	require.NoError(t, err)

	require.Len(t, bMgr.bridges, numberOfTopics)

	for _, b := range bMgr.bridges {
		tb, ok := b.(*MockBridge)
		require.True(t, ok)
		// setup bridge must call Start for each bridge
		require.Equal(t, 1, tb.calledTimes)
	}

	bMgr.Shutdown(1 * time.Second)

	for _, b := range bMgr.bridges {
		tb, ok := b.(*MockBridge)
		require.True(t, ok)
		// after calling shutdown, all bridges' Stop methods must be called
		require.Equal(t, 0, tb.calledTimes)
	}
}
