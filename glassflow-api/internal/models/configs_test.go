package models

import (
	"strings"
	"testing"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
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

	if health.OverallStatus != internal.PipelineStatusCreated {
		t.Errorf("Expected OverallStatus %s, got %s", internal.PipelineStatusCreated, health.OverallStatus)
	}

}

func TestNewPipelineConfig(t *testing.T) {
	id := "test-pipeline"
	name := "Test Pipeline"
	mapper := MapperConfig{Type: internal.SchemaMapperJSONToCHType}
	ingestor := IngestorComponentConfig{Type: internal.KafkaIngestorType}
	join := JoinComponentConfig{Type: internal.TemporalJoinType}
	sink := SinkComponentConfig{Type: internal.ClickHouseSinkType}

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

	if config.Status.OverallStatus != internal.PipelineStatusCreated {
		t.Errorf("Expected Status.OverallStatus %s, got %s", internal.PipelineStatusCreated, config.Status.OverallStatus)
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
			if len(result) > internal.MaxStreamNameLength {
				t.Errorf("GetIngestorStreamName(%q, %q) = %q, length %d exceeds max %d",
					pipelineID, tt.topic, result, len(result), internal.MaxStreamNameLength)
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
			if len(result) > internal.MaxStreamNameLength {
				t.Errorf("GetIngestorStreamName(%q, %q) = %q, length %d exceeds max %d",
					pipelineID, tt.topic, result, len(result), internal.MaxStreamNameLength)
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
	if !strings.HasSuffix(result, internal.DefaultSubjectName) {
		t.Errorf("GetPipelineNATSSubject(%q, %q) = %q, should end with %q",
			pipelineID, topic, result, internal.DefaultSubjectName)
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
	if !strings.HasSuffix(result, internal.DLQSuffix) {
		t.Errorf("GetDLQStreamName(%q) = %q, should end with %q", pipelineID, result, internal.DLQSuffix)
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

func TestPipelineHealthCanTransitionTo(t *testing.T) {
	tests := []struct {
		name        string
		current     PipelineStatus
		target      PipelineStatus
		shouldAllow bool
	}{
		// From Created
		{"Created to Running", PipelineStatus(internal.PipelineStatusCreated), PipelineStatus(internal.PipelineStatusRunning), true},
		{"Created to Terminated", PipelineStatus(internal.PipelineStatusCreated), PipelineStatus(internal.PipelineStatusTerminating), true},
		{"Created to Pausing", PipelineStatus(internal.PipelineStatusCreated), PipelineStatus(internal.PipelineStatusPausing), false},

		// From Running
		{"Running to Pausing", PipelineStatus(internal.PipelineStatusRunning), PipelineStatus(internal.PipelineStatusPausing), true},
		{"Running to Terminated", PipelineStatus(internal.PipelineStatusRunning), PipelineStatus(internal.PipelineStatusTerminating), true},
		{"Running to Created", PipelineStatus(internal.PipelineStatusRunning), PipelineStatus(internal.PipelineStatusCreated), false},

		// From Pausing
		{"Pausing to Paused", PipelineStatus(internal.PipelineStatusPausing), PipelineStatus(internal.PipelineStatusPaused), true},
		{"Pausing to Terminated", PipelineStatus(internal.PipelineStatusPausing), PipelineStatus(internal.PipelineStatusTerminating), true},
		{"Pausing to Running", PipelineStatus(internal.PipelineStatusPausing), PipelineStatus(internal.PipelineStatusRunning), false},

		// From Paused
		{"Paused to Resuming", PipelineStatus(internal.PipelineStatusPaused), PipelineStatus(internal.PipelineStatusResuming), true},
		{"Paused to Terminated", PipelineStatus(internal.PipelineStatusPaused), PipelineStatus(internal.PipelineStatusTerminating), true},
		{"Paused to Running", PipelineStatus(internal.PipelineStatusPaused), PipelineStatus(internal.PipelineStatusRunning), false},

		// From Resuming
		{"Resuming to Running", PipelineStatus(internal.PipelineStatusResuming), PipelineStatus(internal.PipelineStatusRunning), true},
		{"Resuming to Terminated", PipelineStatus(internal.PipelineStatusResuming), PipelineStatus(internal.PipelineStatusTerminating), true},
		{"Resuming to Paused", PipelineStatus(internal.PipelineStatusResuming), PipelineStatus(internal.PipelineStatusPaused), false},

		// From Terminating
		{"Terminating to Terminated", PipelineStatus(internal.PipelineStatusTerminating), PipelineStatus(internal.PipelineStatusTerminated), true},
		{"Terminating to Running", PipelineStatus(internal.PipelineStatusTerminating), PipelineStatus(internal.PipelineStatusRunning), false},

		// From Terminated (terminal state)
		{"Terminated to Running", PipelineStatus(internal.PipelineStatusTerminated), PipelineStatus(internal.PipelineStatusRunning), false},
		{"Terminated to Paused", PipelineStatus(internal.PipelineStatusTerminated), PipelineStatus(internal.PipelineStatusPaused), false},

		// From Failed
		{"Failed to Terminated", PipelineStatus(internal.PipelineStatusFailed), PipelineStatus(internal.PipelineStatusTerminated), true},
		{"Failed to Running", PipelineStatus(internal.PipelineStatusFailed), PipelineStatus(internal.PipelineStatusRunning), false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			health := &PipelineHealth{
				OverallStatus: tt.current,
			}

			result := health.CanTransitionTo(tt.target)
			if result != tt.shouldAllow {
				t.Errorf("CanTransitionTo(%s -> %s) = %v, want %v", tt.current, tt.target, result, tt.shouldAllow)
			}
		})
	}
}

func TestPipelineHealthTransitionTo(t *testing.T) {
	tests := []struct {
		name        string
		current     PipelineStatus
		target      PipelineStatus
		shouldError bool
	}{
		{"Valid transition", PipelineStatus(internal.PipelineStatusRunning), PipelineStatus(internal.PipelineStatusPausing), false},
		{"Invalid transition", PipelineStatus(internal.PipelineStatusRunning), PipelineStatus(internal.PipelineStatusCreated), true},
		{"Terminal state transition", PipelineStatus(internal.PipelineStatusTerminated), PipelineStatus(internal.PipelineStatusRunning), true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			health := &PipelineHealth{
				OverallStatus: tt.current,
			}

			err := health.TransitionTo(tt.target)
			if tt.shouldError {
				if err == nil {
					t.Errorf("TransitionTo(%s -> %s) should have returned an error", tt.current, tt.target)
				}
			} else {
				if err != nil {
					t.Errorf("TransitionTo(%s -> %s) returned unexpected error: %v", tt.current, tt.target, err)
				}
				if health.OverallStatus != tt.target {
					t.Errorf("TransitionTo(%s -> %s) did not update status, got %s", tt.current, tt.target, health.OverallStatus)
				}
			}
		})
	}
}

func TestGetKafkaConsumerGroupName(t *testing.T) {
	pipelineID := "test-pipeline-123"
	result := GetKafkaConsumerGroupName(pipelineID)

	// Should contain the hash
	hash := GenerateStreamHash(pipelineID)
	if !strings.Contains(result, hash) {
		t.Errorf("GetKafkaConsumerGroupName(%q) = %q, should contain hash %q", pipelineID, result, hash)
	}

	// Should start with the prefix
	if !strings.HasPrefix(result, internal.ConsumerGroupNamePrefix) {
		t.Errorf("GetKafkaConsumerGroupName(%q) = %q, should start with %q", pipelineID, result, internal.ConsumerGroupNamePrefix)
	}

	// Should be equal to expected full name
	expected := internal.ConsumerGroupNamePrefix + "-" + hash
	if result != expected {
		t.Errorf("GetKafkaConsumerGroupName(%q) = %q, want %q", pipelineID, result, expected)
	}
}
