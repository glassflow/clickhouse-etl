package models

import (
	"strings"
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

func TestSanitizeNATSSubject(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "no dots",
			input:    "my-topic",
			expected: "my-topic",
		},
		{
			name:     "single dot",
			input:    "my.topic",
			expected: "my_topic",
		},
		{
			name:     "multiple dots",
			input:    "my.topic.name",
			expected: "my_topic_name",
		},
		{
			name:     "dots at start and end",
			input:    ".my.topic.",
			expected: "_my_topic_",
		},
		{
			name:     "consecutive dots",
			input:    "my..topic",
			expected: "my__topic",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := SanitizeNATSSubject(tt.input)
			if result != tt.expected {
				t.Errorf("SanitizeNATSSubject(%q) = %q, want %q", tt.input, result, tt.expected)
			}
		})
	}
}

func TestGenerateStreamHash(t *testing.T) {
	// Test that the same pipeline ID always generates the same hash
	pipelineID := "test-pipeline-123"
	hash1 := GenerateStreamHash(pipelineID)
	hash2 := GenerateStreamHash(pipelineID)

	if hash1 != hash2 {
		t.Errorf("GenerateStreamHash should be deterministic, got %q and %q", hash1, hash2)
	}

	// Test that different pipeline IDs generate different hashes
	hash3 := GenerateStreamHash("different-pipeline-456")
	if hash1 == hash3 {
		t.Errorf("Different pipeline IDs should generate different hashes")
	}

	// Test that hash is always 8 characters
	if len(hash1) != 8 {
		t.Errorf("Hash should be 8 characters, got %d", len(hash1))
	}
}

func TestGetPipelineStreamName(t *testing.T) {
	pipelineID := "test-pipeline-123"

	tests := []struct {
		name     string
		topic    string
		expected string
	}{
		{
			name:     "simple topic",
			topic:    "my-topic",
			expected: "gf-", // Will be followed by hash and topic
		},
		{
			name:     "topic with dots",
			topic:    "my.topic.name",
			expected: "gf-", // Will be followed by hash and sanitized topic
		},
		{
			name:     "very long topic name",
			topic:    strings.Repeat("a", 50),
			expected: "gf-", // Should be truncated
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := GetIngestorStreamName(pipelineID, tt.topic)

			// Check that it starts with the expected prefix
			if !strings.HasPrefix(result, tt.expected) {
				t.Errorf("GetIngestorStreamName(%q, %q) = %q, should start with %q",
					pipelineID, tt.topic, result, tt.expected)
			}

			// Check that it doesn't exceed max length
			if len(result) > MaxStreamNameLength {
				t.Errorf("GetIngestorStreamName(%q, %q) = %q, length %d exceeds max %d",
					pipelineID, tt.topic, result, len(result), MaxStreamNameLength)
			}

			// Check that it contains the hash
			hash := GenerateStreamHash(pipelineID)
			if !strings.Contains(result, hash) {
				t.Errorf("GetIngestorStreamName(%q, %q) = %q, should contain hash %q",
					pipelineID, tt.topic, result, hash)
			}
		})
	}
}

func TestGetIngestorStreamName(t *testing.T) {
	pipelineID := "test-pipeline-123"

	tests := []struct {
		name     string
		topic    string
		expected string
	}{
		{
			name:     "simple topic",
			topic:    "my-topic",
			expected: "gf-", // Will be followed by hash and topic
		},
		{
			name:     "topic with dots",
			topic:    "my.topic.name",
			expected: "gf-", // Will be followed by hash and sanitized topic
		},
		{
			name:     "very long topic name",
			topic:    strings.Repeat("a", 50),
			expected: "gf-", // Should be truncated
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := GetIngestorStreamName(pipelineID, tt.topic)

			// Check that it starts with the expected prefix
			if !strings.HasPrefix(result, tt.expected) {
				t.Errorf("GetIngestorStreamName(%q, %q) = %q, should start with %q",
					pipelineID, tt.topic, result, tt.expected)
			}

			// Check that it doesn't exceed max length
			if len(result) > MaxStreamNameLength {
				t.Errorf("GetIngestorStreamName(%q, %q) = %q, length %d exceeds max %d",
					pipelineID, tt.topic, result, len(result), MaxStreamNameLength)
			}

			// Check that it contains the hash
			hash := GenerateStreamHash(pipelineID)
			if !strings.Contains(result, hash) {
				t.Errorf("GetIngestorStreamName(%q, %q) = %q, should contain hash %q",
					pipelineID, tt.topic, result, hash)
			}
		})
	}
}

func TestGetPipelineNATSSubject(t *testing.T) {
	pipelineID := "test-pipeline-123"
	topic := "my.topic"

	result := GetPipelineNATSSubject(pipelineID, topic)

	// Should end with .input
	if !strings.HasSuffix(result, DefaultSubjectName) {
		t.Errorf("GetPipelineNATSSubject(%q, %q) = %q, should end with %q",
			pipelineID, topic, result, DefaultSubjectName)
	}

	// Should contain the stream name
	streamName := GetIngestorStreamName(pipelineID, topic)
	if !strings.HasPrefix(result, streamName) {
		t.Errorf("GetPipelineNATSSubject(%q, %q) = %q, should start with stream name %q",
			pipelineID, topic, result, streamName)
	}
}

func TestGetDLQStreamName(t *testing.T) {
	pipelineID := "test-pipeline-123"
	result := GetDLQStreamName(pipelineID)

	// Should contain the hash
	hash := GenerateStreamHash(pipelineID)
	if !strings.Contains(result, hash) {
		t.Errorf("GetDLQStreamName(%q) = %q, should contain hash %q", pipelineID, result, hash)
	}

	// Should end with DLQ
	if !strings.HasSuffix(result, DLQSuffix) {
		t.Errorf("GetDLQStreamName(%q) = %q, should end with %q", pipelineID, result, DLQSuffix)
	}
}

func TestGetJoinedStreamName(t *testing.T) {
	pipelineID := "test-pipeline-123"
	result := GetJoinedStreamName(pipelineID)

	// Should contain the hash
	hash := GenerateStreamHash(pipelineID)
	if !strings.Contains(result, hash) {
		t.Errorf("GetJoinedStreamName(%q) = %q, should contain hash %q", pipelineID, result, hash)
	}

	// Should end with joined
	if !strings.HasSuffix(result, "joined") {
		t.Errorf("GetJoinedStreamName(%q) = %q, should end with 'joined'", pipelineID, result)
	}
}
