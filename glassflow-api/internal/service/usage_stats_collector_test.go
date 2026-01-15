package service

import (
	"context"
	"log/slog"
	"testing"
	"time"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/pkg/usagestats"
	"github.com/stretchr/testify/assert"
)

func TestUsageStatsCollector_ProcessAPIEvent(t *testing.T) {
	mockStore := new(mockPipelineStore)
	usageStatsClient := usagestats.NewClient("", "", "", "", true, slog.Default(), mockStore)

	collector := NewUsageStatsCollector(
		mockStore,
		nil, // NATS client can be nil for this test
		nil, // DLQ client can be nil for this test
		usageStatsClient,
		slog.Default(),
	)

	// Create an event and send it to the channel
	event := usagestats.PipelineEvent{
		PipelineID: "test-pipeline",
		EventName:  "create-pipeline",
	}

	// Process the event
	ctx := context.Background()
	collector.processAPIEvent(ctx, event)

	// Verify the event was processed (no panic means success)
	// The actual event sending is tested in usagestats.Client tests
}

func TestUsageStatsCollector_Start_DisabledClient(t *testing.T) {
	mockStore := new(mockPipelineStore)
	usageStatsClient := usagestats.NewClient("", "", "", "", false, slog.Default(), mockStore)

	collector := NewUsageStatsCollector(
		mockStore,
		nil,
		nil, // DLQ client can be nil for this test
		usageStatsClient,
		slog.Default(),
	)

	ctx := context.Background()

	// Start should return immediately for disabled client
	done := make(chan bool)
	go func() {
		collector.Start(ctx)
		done <- true
	}()

	select {
	case <-done:
		// Success - should return immediately
	case <-time.After(100 * time.Millisecond):
		t.Error("collector should return immediately for disabled client")
	}
}

func TestUsageStatsCollector_Start_NilClient(t *testing.T) {
	mockStore := new(mockPipelineStore)

	collector := NewUsageStatsCollector(
		mockStore,
		nil,
		nil, // DLQ client can be nil for this test
		nil,
		slog.Default(),
	)

	ctx := context.Background()

	// Start should return immediately for nil client
	done := make(chan bool)
	go func() {
		collector.Start(ctx)
		done <- true
	}()

	select {
	case <-done:
		// Success - should return immediately
	case <-time.After(100 * time.Millisecond):
		t.Error("collector should return immediately for nil client")
	}
}

func TestUsageStatsCollector_NewUsageStatsCollector(t *testing.T) {
	mockStore := new(mockPipelineStore)
	usageStatsClient := usagestats.NewClient("", "", "", "", true, slog.Default(), mockStore)

	collector := NewUsageStatsCollector(
		mockStore,
		nil,
		nil, // DLQ client can be nil for this test
		usageStatsClient,
		slog.Default(),
	)

	assert.NotNil(t, collector)
	assert.Equal(t, mockStore, collector.db)
	assert.Nil(t, collector.dlqClient)
	assert.Equal(t, usageStatsClient, collector.usageStatsClient)
	assert.Equal(t, 10*time.Minute, collector.interval)
	assert.NotNil(t, collector.eventChan)
}
