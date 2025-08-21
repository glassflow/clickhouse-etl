package models

import (
	"testing"
)

func TestNewPipelineHealth(t *testing.T) {
	pipelineID := "test-pipeline"
	pipelineName := "Test Pipeline"

	health := NewPipelineHealth(pipelineID, pipelineName)

	if health.PipelineID != pipelineID {
		t.Errorf("Expected PipelineID %s, got %s", pipelineID, health.PipelineID)
	}

	if health.PipelineName != pipelineName {
		t.Errorf("Expected PipelineName %s, got %s", pipelineName, health.PipelineName)
	}

	if health.OverallStatus != PipelineStatusCreated {
		t.Errorf("Expected OverallStatus %s, got %s", PipelineStatusCreated, health.OverallStatus)
	}

}

func TestNewPipelineConfig(t *testing.T) {
	id := "test-pipeline"
	name := "Test Pipeline"
	mapper := MapperConfig{Type: SchemaMapperJSONToCHType}
	ingestor := IngestorOperatorConfig{Type: KafkaIngestorType}
	join := JoinOperatorConfig{Type: TemporalJoinType}
	sink := SinkOperatorConfig{Type: ClickHouseSinkType}

	config := NewPipelineConfig(id, name, mapper, ingestor, join, sink)

	if config.ID != id {
		t.Errorf("Expected ID %s, got %s", id, config.ID)
	}

	if config.Name != name {
		t.Errorf("Expected Name %s, got %s", name, config.Name)
	}

	if config.Status.PipelineID != id {
		t.Errorf("Expected Status.PipelineID %s, got %s", id, config.Status.PipelineID)
	}

	if config.Status.OverallStatus != PipelineStatusCreated {
		t.Errorf("Expected Status.OverallStatus %s, got %s", PipelineStatusCreated, config.Status.OverallStatus)
	}
}

func TestGetIngestionStreamName(t *testing.T) {
	tests := []struct {
		name       string
		pipelineID string
		topicName  string
		expected   string
	}{
		{
			name:       "basic stream name",
			pipelineID: "pipeline-123",
			topicName:  "users",
			expected:   "gf-ingest-pipeline-123-users",
		},
		{
			name:       "different pipeline same topic",
			pipelineID: "pipeline-456",
			topicName:  "users",
			expected:   "gf-ingest-pipeline-456-users",
		},
		{
			name:       "same pipeline different topic",
			pipelineID: "pipeline-123",
			topicName:  "orders",
			expected:   "gf-ingest-pipeline-123-orders",
		},
		{
			name:       "special characters in names",
			pipelineID: "pipeline_with_underscores",
			topicName:  "topic-with-dashes",
			expected:   "gf-ingest-pipeline_with_underscores-topic-with-dashes",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := GetIngestionStreamName(tt.pipelineID, tt.topicName)
			if result != tt.expected {
				t.Errorf("GetIngestionStreamName(%s, %s) = %s, want %s", tt.pipelineID, tt.topicName, result, tt.expected)
			}
		})
	}
}

func TestGetIngestionStreamSubjectName(t *testing.T) {
	tests := []struct {
		name       string
		pipelineID string
		topicName  string
		expected   string
	}{
		{
			name:       "basic subject name",
			pipelineID: "pipeline-123",
			topicName:  "users",
			expected:   "gf-ingest-pipeline-123-users.input",
		},
		{
			name:       "different pipeline same topic",
			pipelineID: "pipeline-456",
			topicName:  "users",
			expected:   "gf-ingest-pipeline-456-users.input",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := GetIngestionStreamSubjectName(tt.pipelineID, tt.topicName)
			if result != tt.expected {
				t.Errorf("GetIngestionStreamSubjectName(%s, %s) = %s, want %s", tt.pipelineID, tt.topicName, result, tt.expected)
			}
		})
	}
}

func TestStreamNameUniqueness(t *testing.T) {
	// Test that different pipelines with the same topic get different stream names
	pipeline1 := "pipeline-123"
	pipeline2 := "pipeline-456"
	topic := "users"

	stream1 := GetIngestionStreamName(pipeline1, topic)
	stream2 := GetIngestionStreamName(pipeline2, topic)

	if stream1 == stream2 {
		t.Errorf("Stream names should be unique for different pipelines: %s == %s", stream1, stream2)
	}

	// Test that the same pipeline with different topics get different stream names
	topic1 := "users"
	topic2 := "orders"

	stream3 := GetIngestionStreamName(pipeline1, topic1)
	stream4 := GetIngestionStreamName(pipeline1, topic2)

	if stream3 == stream4 {
		t.Errorf("Stream names should be unique for different topics: %s == %s", stream3, stream4)
	}
}
