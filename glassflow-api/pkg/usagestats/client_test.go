package usagestats

import (
	"context"
	"log/slog"
	"testing"
	"time"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// MockPipelineGetter is a mock implementation of PipelineGetter
type MockPipelineGetter struct {
	mock.Mock
}

func (m *MockPipelineGetter) GetPipeline(ctx context.Context, pid string) (*models.PipelineConfig, error) {
	args := m.Called(ctx, pid)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.PipelineConfig), args.Error(1)
}

func TestClient_RecordPipelineEvent(t *testing.T) {
	tests := []struct {
		name       string
		enabled    bool
		pipelineID string
		eventName  string
		wantQueued bool
	}{
		{
			name:       "enabled client queues event",
			enabled:    true,
			pipelineID: "test-pipeline-1",
			eventName:  "create-pipeline",
			wantQueued: true,
		},
		{
			name:       "disabled client does not queue",
			enabled:    false,
			pipelineID: "test-pipeline-2",
			eventName:  "create-pipeline",
			wantQueued: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			client := NewClient("", "", "", "", tt.enabled, slog.Default(), nil)
			if !tt.enabled {
				assert.False(t, client.IsEnabled())
				client.RecordPipelineEvent(tt.pipelineID, tt.eventName)
				// For disabled client, channel should be nil, so nothing happens
				return
			}

			// Record event
			client.RecordPipelineEvent(tt.pipelineID, tt.eventName)

			// Read from channel to verify event was queued
			select {
			case event := <-client.GetEventChannel():
				assert.Equal(t, tt.pipelineID, event.PipelineID)
				assert.Equal(t, tt.eventName, event.EventName)
			default:
				if tt.wantQueued {
					t.Error("expected event to be queued but channel is empty")
				}
			}
		})
	}
}

func TestClient_RecordPipelineEvent_ChannelFull(t *testing.T) {
	client := NewClient("", "", "", "", true, slog.Default(), nil)

	// Fill the channel to capacity
	for i := 0; i < 100; i++ {
		client.RecordPipelineEvent("pipeline-1", "create-pipeline")
	}

	// This should not block, but event should be dropped
	client.RecordPipelineEvent("pipeline-2", "create-pipeline")

	// Verify channel is full
	select {
	case <-client.GetEventChannel():
		// Good, channel has events
	default:
		t.Error("expected channel to have events")
	}
}

func TestClient_checkTransformations(t *testing.T) {
	client := NewClient("", "", "", "", true, slog.Default(), nil)

	// Test with minimal config - no transformations
	cfg1 := &models.PipelineConfig{
		Ingestor: models.IngestorComponentConfig{
			KafkaTopics: []models.KafkaTopicsConfig{},
		},
		Join:   models.JoinComponentConfig{Enabled: false},
		Filter: models.FilterComponentConfig{Enabled: false},
	}
	hasDedup, hasJoin, hasFilter, hasStatelessTransform := client.checkTransformations(cfg1)
	assert.False(t, hasDedup)
	assert.False(t, hasJoin)
	assert.False(t, hasFilter)
	assert.False(t, hasStatelessTransform)

	// Test with deduplication
	cfg2 := &models.PipelineConfig{
		Ingestor: models.IngestorComponentConfig{
			KafkaTopics: []models.KafkaTopicsConfig{
				{
					Deduplication: models.DeduplicationConfig{Enabled: true},
				},
			},
		},
		Join:                    models.JoinComponentConfig{Enabled: false},
		Filter:                  models.FilterComponentConfig{Enabled: false},
		StatelessTransformation: models.StatelessTransformation{Enabled: false},
	}
	hasDedup, hasJoin, hasFilter, hasStatelessTransform = client.checkTransformations(cfg2)
	assert.True(t, hasDedup)
	assert.False(t, hasJoin)
	assert.False(t, hasFilter)
	assert.False(t, hasStatelessTransform)

	// Test with join
	cfg3 := &models.PipelineConfig{
		Ingestor: models.IngestorComponentConfig{
			KafkaTopics: []models.KafkaTopicsConfig{},
		},
		Join:                    models.JoinComponentConfig{Enabled: true},
		Filter:                  models.FilterComponentConfig{Enabled: false},
		StatelessTransformation: models.StatelessTransformation{Enabled: false},
	}
	hasDedup, hasJoin, hasFilter, hasStatelessTransform = client.checkTransformations(cfg3)
	assert.False(t, hasDedup)
	assert.True(t, hasJoin)
	assert.False(t, hasFilter)
	assert.False(t, hasStatelessTransform)

	// Test with filter
	cfg4 := &models.PipelineConfig{
		Ingestor: models.IngestorComponentConfig{
			KafkaTopics: []models.KafkaTopicsConfig{},
		},
		Join:                    models.JoinComponentConfig{Enabled: false},
		Filter:                  models.FilterComponentConfig{Enabled: true},
		StatelessTransformation: models.StatelessTransformation{Enabled: false},
	}
	hasDedup, hasJoin, hasFilter, hasStatelessTransform = client.checkTransformations(cfg4)
	assert.False(t, hasDedup)
	assert.False(t, hasJoin)
	assert.True(t, hasFilter)
	assert.False(t, hasStatelessTransform)

	// Test with stateless transform
	cfg5 := &models.PipelineConfig{
		Ingestor: models.IngestorComponentConfig{
			KafkaTopics: []models.KafkaTopicsConfig{},
		},
		Join:                    models.JoinComponentConfig{Enabled: false},
		Filter:                  models.FilterComponentConfig{Enabled: false},
		StatelessTransformation: models.StatelessTransformation{Enabled: true},
	}
	hasDedup, hasJoin, hasFilter, hasStatelessTransform = client.checkTransformations(cfg5)
	assert.False(t, hasDedup)
	assert.False(t, hasJoin)
	assert.False(t, hasFilter)
	assert.True(t, hasStatelessTransform)
}

func TestClient_buildPipelineEventProperties(t *testing.T) {
	cfg := &models.PipelineConfig{
		ID:   "test-pipeline",
		Name: "Test Pipeline",
		Ingestor: models.IngestorComponentConfig{
			KafkaTopics: []models.KafkaTopicsConfig{
				{
					Name:     "topic1",
					Replicas: 3,
					Deduplication: models.DeduplicationConfig{
						Enabled: true,
					},
				},
				{
					Name:     "topic2",
					Replicas: 2,
				},
			},
		},
		Join: models.JoinComponentConfig{
			Enabled: true,
		},
		Filter: models.FilterComponentConfig{
			Enabled: false,
		},
		StatelessTransformation: models.StatelessTransformation{
			Enabled: true,
		},
		Sink: models.SinkComponentConfig{
			Batch: models.BatchConfig{
				MaxBatchSize: 1000,
				MaxDelayTime: models.JSONDuration{},
			},
		},
	}
	cfg.Sink.Batch.MaxDelayTime = *models.NewJSONDuration(5 * time.Second)

	client := NewClient("", "", "", "", true, slog.Default(), nil)
	properties := client.buildPipelineEventProperties(cfg, "test-pipeline")

	assert.NotNil(t, properties)
	assert.Equal(t, MaskPipelineID("test-pipeline"), properties["pipeline_id_hash"])
	assert.Equal(t, true, properties["has_dedup"])
	assert.Equal(t, true, properties["has_join"])
	assert.Equal(t, false, properties["has_filter"])
	assert.Equal(t, true, properties["has_stateless_transform"])
	assert.Equal(t, 1000, properties["ch_batch_size"])
	assert.Equal(t, "5s", properties["ch_sync_delay"])
	assert.Equal(t, 3, properties["ingestor_replicas_t1"])
	assert.Equal(t, 2, properties["ingestor_replicas_t2"])
}

func TestClient_ProcessPipelineEvent_DeletePipeline(t *testing.T) {
	client := NewClient("", "", "", "", true, slog.Default(), nil)

	event := PipelineEvent{
		PipelineID: "test-pipeline",
		EventName:  "delete-pipeline",
	}

	// Process delete event - should not require DB lookup
	ctx := context.Background()
	client.ProcessPipelineEvent(ctx, event)

	// Verify no panic occurred and event was processed
	// (We can't easily verify SendEvent was called without mocking, but we can verify it doesn't crash)
}

func TestClient_ProcessPipelineEvent_WithPipelineStore(t *testing.T) {
	mockStore := new(MockPipelineGetter)
	client := NewClient("", "", "", "", true, slog.Default(), mockStore)

	pipelineID := "test-pipeline"
	cfg := &models.PipelineConfig{
		ID:   pipelineID,
		Name: "Test Pipeline",
		Ingestor: models.IngestorComponentConfig{
			KafkaTopics: []models.KafkaTopicsConfig{
				{Replicas: 1},
			},
		},
		Join:                    models.JoinComponentConfig{Enabled: false},
		Filter:                  models.FilterComponentConfig{Enabled: false},
		StatelessTransformation: models.StatelessTransformation{Enabled: false},
		Sink:                    models.SinkComponentConfig{},
	}

	mockStore.On("GetPipeline", mock.Anything, pipelineID).Return(cfg, nil)

	event := PipelineEvent{
		PipelineID: pipelineID,
		EventName:  "create-pipeline",
	}

	ctx := context.Background()
	client.ProcessPipelineEvent(ctx, event)

	mockStore.AssertExpectations(t)
}

func TestClient_ProcessPipelineEvent_PipelineNotFound(t *testing.T) {
	mockStore := new(MockPipelineGetter)
	client := NewClient("", "", "", "", true, slog.Default(), mockStore)

	pipelineID := "non-existent-pipeline"
	mockStore.On("GetPipeline", mock.Anything, pipelineID).Return(nil, assert.AnError)

	event := PipelineEvent{
		PipelineID: pipelineID,
		EventName:  "create-pipeline",
	}

	ctx := context.Background()
	// Should not panic, just log error
	client.ProcessPipelineEvent(ctx, event)

	mockStore.AssertExpectations(t)
}

func TestClient_ProcessPipelineEvent_DisabledClient(t *testing.T) {
	client := NewClient("", "", "", "", false, slog.Default(), nil)

	event := PipelineEvent{
		PipelineID: "test-pipeline",
		EventName:  "create-pipeline",
	}

	ctx := context.Background()
	// Should return early without processing
	client.ProcessPipelineEvent(ctx, event)
}

func TestClient_ProcessPipelineEvent_NoPipelineStore(t *testing.T) {
	client := NewClient("", "", "", "", true, slog.Default(), nil)

	event := PipelineEvent{
		PipelineID: "test-pipeline",
		EventName:  "create-pipeline",
	}

	ctx := context.Background()
	// Should return early without processing when pipelineStore is nil
	client.ProcessPipelineEvent(ctx, event)
}

func TestMaskPipelineID(t *testing.T) {
	tests := []struct {
		name       string
		pipelineID string
		wantLength int
	}{
		{
			name:       "normal pipeline ID",
			pipelineID: "test-pipeline-123",
			wantLength: 32, // MD5 hash is 32 hex characters
		},
		{
			name:       "empty pipeline ID",
			pipelineID: "",
			wantLength: 32,
		},
		{
			name:       "long pipeline ID",
			pipelineID: "very-long-pipeline-id-with-many-characters",
			wantLength: 32,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			masked := MaskPipelineID(tt.pipelineID)
			assert.Len(t, masked, tt.wantLength)
			// Verify it's a valid hex string
			assert.Regexp(t, "^[0-9a-f]{32}$", masked)
		})
	}
}

func TestMaskPipelineID_Consistency(t *testing.T) {
	pipelineID := "test-pipeline"
	masked1 := MaskPipelineID(pipelineID)
	masked2 := MaskPipelineID(pipelineID)

	// Same input should produce same output
	assert.Equal(t, masked1, masked2)
}
