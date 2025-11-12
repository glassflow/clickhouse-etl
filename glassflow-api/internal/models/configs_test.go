package models

import (
	"encoding/json"
	"fmt"
	"strings"
	"testing"
	"time"

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
	filter := FilterComponentConfig{Enabled: false}

	config := NewPipelineConfig(id, name, mapper, ingestor, join, sink, filter)

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
	if !strings.HasSuffix(result, internal.WildcardSubject) {
		t.Errorf("GetPipelineNATSSubject(%q, %q) = %q, should end with %q",
			pipelineID, topic, result, internal.WildcardSubject)
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

func TestGetNATSSubjectName(t *testing.T) {
	streamName := "gf-abc12345-my_topic"
	subjectName := "input"

	result := GetNATSSubjectName(streamName, subjectName)
	expected := fmt.Sprintf("%s.%s", streamName, subjectName)
	if result != expected {
		t.Errorf("GetNATSSubjectName(%q, %q) = %q, want %q", streamName, subjectName, result, expected)
	}
}

func TestGetNATSSubjectNameDefault(t *testing.T) {
	streamName := "gf-abc12345-my_topic"

	result := GetNATSSubjectNameDefault(streamName)
	expected := fmt.Sprintf("%s.%s", streamName, internal.DefaultSubjectName)
	if result != expected {
		t.Errorf("GetNATSSubjectNameDefault(%q) = %q, want %q", streamName, result, expected)
	}
}

func TestGetWildcardNATSSubjectName(t *testing.T) {
	streamName := "gf-abc12345-my_topic"

	result := GetWildcardNATSSubjectName(streamName)
	expected := fmt.Sprintf("%s.%s", streamName, internal.WildcardSubject)
	if result != expected {
		t.Errorf("GetWildcardNATSSubjectName(%q) = %q, want %q", streamName, result, expected)
	}
}

// JSONDuration Tests

func TestConvertDaysToHours(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "single day",
			input:    "1d",
			expected: "24h",
		},
		{
			name:     "multiple days",
			input:    "7d",
			expected: "168h",
		},
		{
			name:     "day with hours",
			input:    "1d12h",
			expected: "24h12h",
		},
		{
			name:     "day with hours and minutes",
			input:    "2d6h30m",
			expected: "48h6h30m",
		},
		{
			name:     "day with all units",
			input:    "1d12h30m45s",
			expected: "24h12h30m45s",
		},
		{
			name:     "multiple days with mixed units",
			input:    "3d2h15m",
			expected: "72h2h15m",
		},
		{
			name:     "no days - should remain unchanged",
			input:    "12h30m",
			expected: "12h30m",
		},
		{
			name:     "only hours - should remain unchanged",
			input:    "24h",
			expected: "24h",
		},
		{
			name:     "only minutes - should remain unchanged",
			input:    "30m",
			expected: "30m",
		},
		{
			name:     "only seconds - should remain unchanged",
			input:    "45s",
			expected: "45s",
		},
		{
			name:     "zero days",
			input:    "0d",
			expected: "0h",
		},
		{
			name:     "large number of days",
			input:    "365d",
			expected: "8760h",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := convertDaysToHours(tt.input)
			if result != tt.expected {
				t.Errorf("convertDaysToHours(%q) = %q, want %q", tt.input, result, tt.expected)
			}
		})
	}
}

func TestJSONDurationUnmarshalJSON(t *testing.T) {
	tests := []struct {
		name        string
		jsonInput   string
		expected    time.Duration
		expectError bool
	}{
		// Day-based durations (new functionality)
		{
			name:      "single day",
			jsonInput: `"1d"`,
			expected:  24 * time.Hour,
		},
		{
			name:      "multiple days",
			jsonInput: `"7d"`,
			expected:  7 * 24 * time.Hour,
		},
		{
			name:      "day with hours",
			jsonInput: `"1d12h"`,
			expected:  36 * time.Hour,
		},
		{
			name:      "day with hours and minutes",
			jsonInput: `"2d6h30m"`,
			expected:  2*24*time.Hour + 6*time.Hour + 30*time.Minute,
		},
		{
			name:      "day with all units",
			jsonInput: `"1d12h30m45s"`,
			expected:  24*time.Hour + 12*time.Hour + 30*time.Minute + 45*time.Second,
		},
		{
			name:      "zero days",
			jsonInput: `"0d"`,
			expected:  0,
		},
		{
			name:      "large number of days",
			jsonInput: `"365d"`,
			expected:  365 * 24 * time.Hour,
		},
		// Standard Go duration formats (existing functionality)
		{
			name:      "hours only",
			jsonInput: `"24h"`,
			expected:  24 * time.Hour,
		},
		{
			name:      "hours and minutes",
			jsonInput: `"12h30m"`,
			expected:  12*time.Hour + 30*time.Minute,
		},
		{
			name:      "minutes only",
			jsonInput: `"30m"`,
			expected:  30 * time.Minute,
		},
		{
			name:      "seconds only",
			jsonInput: `"45s"`,
			expected:  45 * time.Second,
		},
		{
			name:      "milliseconds",
			jsonInput: `"500ms"`,
			expected:  500 * time.Millisecond,
		},
		{
			name:      "nanoseconds",
			jsonInput: `"1000ns"`,
			expected:  1000 * time.Nanosecond,
		},
		{
			name:      "complex duration",
			jsonInput: `"1h30m45s"`,
			expected:  time.Hour + 30*time.Minute + 45*time.Second,
		},
		// Error cases
		{
			name:        "invalid duration format",
			jsonInput:   `"invalid"`,
			expectError: true,
		},
		{
			name:        "non-string input",
			jsonInput:   `123`,
			expectError: true,
		},
		{
			name:        "empty string",
			jsonInput:   `""`,
			expectError: true,
		},
		{
			name:      "negative duration",
			jsonInput: `"-1h"`,
			expected:  -1 * time.Hour,
		},
		{
			name:        "invalid JSON",
			jsonInput:   `invalid json`,
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var d JSONDuration
			err := json.Unmarshal([]byte(tt.jsonInput), &d)

			if tt.expectError {
				if err == nil {
					t.Errorf("Expected error for input %q, but got none", tt.jsonInput)
				}
				return
			}

			if err != nil {
				t.Errorf("Unexpected error for input %q: %v", tt.jsonInput, err)
				return
			}

			if d.Duration() != tt.expected {
				t.Errorf("Expected duration %v, got %v for input %q", tt.expected, d.Duration(), tt.jsonInput)
			}
		})
	}
}

func TestJSONDurationMarshalJSON(t *testing.T) {
	tests := []struct {
		name     string
		duration time.Duration
		expected string
	}{
		{
			name:     "single day equivalent",
			duration: 24 * time.Hour,
			expected: `"24h0m0s"`,
		},
		{
			name:     "multiple days equivalent",
			duration: 7 * 24 * time.Hour,
			expected: `"168h0m0s"`,
		},
		{
			name:     "day with hours equivalent",
			duration: 36 * time.Hour,
			expected: `"36h0m0s"`,
		},
		{
			name:     "complex duration",
			duration: 2*24*time.Hour + 6*time.Hour + 30*time.Minute,
			expected: `"54h30m0s"`,
		},
		{
			name:     "zero duration",
			duration: 0,
			expected: `"0s"`,
		},
		{
			name:     "seconds only",
			duration: 45 * time.Second,
			expected: `"45s"`,
		},
		{
			name:     "minutes only",
			duration: 30 * time.Minute,
			expected: `"30m0s"`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			d := NewJSONDuration(tt.duration)
			result, err := json.Marshal(d)

			if err != nil {
				t.Errorf("Unexpected error marshaling duration %v: %v", tt.duration, err)
				return
			}

			if string(result) != tt.expected {
				t.Errorf("Expected JSON %q, got %q for duration %v", tt.expected, string(result), tt.duration)
			}
		})
	}
}

func TestJSONDurationString(t *testing.T) {
	tests := []struct {
		name     string
		duration time.Duration
		expected string
	}{
		{
			name:     "single day equivalent",
			duration: 24 * time.Hour,
			expected: "24h0m0s",
		},
		{
			name:     "complex duration",
			duration: 2*24*time.Hour + 6*time.Hour + 30*time.Minute + 45*time.Second,
			expected: "54h30m45s",
		},
		{
			name:     "zero duration",
			duration: 0,
			expected: "0s",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			d := NewJSONDuration(tt.duration)
			result := d.String()

			if result != tt.expected {
				t.Errorf("Expected string %q, got %q for duration %v", tt.expected, result, tt.duration)
			}
		})
	}
}

func TestJSONDurationDuration(t *testing.T) {
	tests := []struct {
		name     string
		duration time.Duration
	}{
		{
			name:     "single day equivalent",
			duration: 24 * time.Hour,
		},
		{
			name:     "complex duration",
			duration: 2*24*time.Hour + 6*time.Hour + 30*time.Minute + 45*time.Second,
		},
		{
			name:     "zero duration",
			duration: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			d := NewJSONDuration(tt.duration)
			result := d.Duration()

			if result != tt.duration {
				t.Errorf("Expected duration %v, got %v", tt.duration, result)
			}
		})
	}
}

func TestJSONDurationRoundTrip(t *testing.T) {
	// Test that marshaling and unmarshaling preserves the duration
	tests := []struct {
		name      string
		jsonInput string
	}{
		{
			name:      "day format",
			jsonInput: `"1d"`,
		},
		{
			name:      "day with hours",
			jsonInput: `"2d12h"`,
		},
		{
			name:      "complex day format",
			jsonInput: `"1d6h30m45s"`,
		},
		{
			name:      "standard hour format",
			jsonInput: `"24h"`,
		},
		{
			name:      "standard complex format",
			jsonInput: `"12h30m45s"`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Unmarshal
			var d1 JSONDuration
			err := json.Unmarshal([]byte(tt.jsonInput), &d1)
			if err != nil {
				t.Errorf("Failed to unmarshal %q: %v", tt.jsonInput, err)
				return
			}

			// Marshal back
			jsonOutput, err := json.Marshal(d1)
			if err != nil {
				t.Errorf("Failed to marshal duration %v: %v", d1.Duration(), err)
				return
			}

			// Unmarshal again
			var d2 JSONDuration
			err = json.Unmarshal(jsonOutput, &d2)
			if err != nil {
				t.Errorf("Failed to unmarshal marshaled result %q: %v", string(jsonOutput), err)
				return
			}

			// Check that durations are equal
			if d1.Duration() != d2.Duration() {
				t.Errorf("Round trip failed: original %v, after round trip %v", d1.Duration(), d2.Duration())
			}
		})
	}
}

func TestJSONDurationEdgeCases(t *testing.T) {
	tests := []struct {
		name        string
		jsonInput   string
		expectError bool
		description string
	}{
		{
			name:        "very large number of days",
			jsonInput:   `"999999d"`,
			expectError: true,
			description: "Should reject very large day values that exceed Go duration limits",
		},
		{
			name:        "day with zero hours",
			jsonInput:   `"1d0h"`,
			expectError: false,
			description: "Should handle zero values in mixed units",
		},
		{
			name:        "day with zero minutes",
			jsonInput:   `"1d12h0m"`,
			expectError: false,
			description: "Should handle zero minutes",
		},
		{
			name:        "day with zero seconds",
			jsonInput:   `"1d12h30m0s"`,
			expectError: false,
			description: "Should handle zero seconds",
		},
		{
			name:        "malformed day format",
			jsonInput:   `"1dx"`,
			expectError: true,
			description: "Should reject malformed day format",
		},
		{
			name:        "day with invalid number",
			jsonInput:   `"xd"`,
			expectError: true,
			description: "Should reject invalid day number",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var d JSONDuration
			err := json.Unmarshal([]byte(tt.jsonInput), &d)

			if tt.expectError {
				if err == nil {
					t.Errorf("Expected error for %q (%s), but got none", tt.jsonInput, tt.description)
				}
			} else {
				if err != nil {
					t.Errorf("Unexpected error for %q (%s): %v", tt.jsonInput, tt.description, err)
				}
			}
		})
	}
}
func TestNewIngestorComponentConfig_ErrorsAndDefaults(t *testing.T) {
	validBroker := "kafka:9092"
	validProvider := "confluent"
	validProtocol := "SASL_PLAINTEXT"

	tests := []struct {
		name        string
		conn        KafkaConnectionParamsConfig
		topics      []KafkaTopicsConfig
		description string
		expectError bool
	}{
		{
			name:        "no brokers",
			conn:        KafkaConnectionParamsConfig{Brokers: []string{}, SASLProtocol: validProtocol, SkipAuth: true},
			topics:      nil,
			description: "must have at least one kafka server",
			expectError: true,
		},
		{
			name:        "empty broker entry",
			conn:        KafkaConnectionParamsConfig{Brokers: []string{" "}, SASLProtocol: validProtocol, SkipAuth: true},
			topics:      nil,
			description: "kafka server cannot be empty",
			expectError: true,
		},
		{
			name:        "empty SASL protocol",
			conn:        KafkaConnectionParamsConfig{Brokers: []string{validBroker}, SASLProtocol: " ", SkipAuth: true},
			topics:      nil,
			description: "SASL protocol cannot be empty",
			expectError: true,
		},
		{
			name: "unsupported SASL protocol",
			conn: KafkaConnectionParamsConfig{
				Brokers:      []string{validBroker},
				SASLProtocol: "UNKNOWN",
				SkipAuth:     true,
			},
			description: "Unsupported SASL protocol",
			expectError: true,
		},
		{
			name: "missing SASL mechanism when auth required",
			conn: KafkaConnectionParamsConfig{
				Brokers:       []string{validBroker},
				SASLProtocol:  validProtocol,
				SkipAuth:      false,
				SASLMechanism: "",
			},
			description: "SASL mechanism cannot be empty",
			expectError: true,
		},
		{
			name: "missing SASL username when auth required",
			conn: KafkaConnectionParamsConfig{
				Brokers:       []string{validBroker},
				SASLProtocol:  validProtocol,
				SkipAuth:      false,
				SASLMechanism: internal.MechanismPlain,
				SASLUsername:  " ",
				SASLPassword:  "pwd",
			},
			description: "SASL username cannot be empty",
			expectError: true,
		},
		{
			name: "missing SASL password for non-kerberos",
			conn: KafkaConnectionParamsConfig{
				Brokers:       []string{validBroker},
				SASLProtocol:  validProtocol,
				SkipAuth:      false,
				SASLMechanism: internal.MechanismPlain,
				SASLUsername:  "user",
				SASLPassword:  "",
			},
			description: "SASL password cannot be empty",
			expectError: true,
		},
		{
			name: "unsupported SASL mechanism",
			conn: KafkaConnectionParamsConfig{
				Brokers:       []string{validBroker},
				SASLProtocol:  validProtocol,
				SkipAuth:      false,
				SASLMechanism: "UNSUPPORTED",
				SASLUsername:  "user",
				SASLPassword:  "pwd",
			},
			description: "Unsupported SASL mechanism",
			expectError: true,
		},
		{
			name: "kerberos missing fields",
			conn: KafkaConnectionParamsConfig{
				Brokers:             []string{validBroker},
				SASLProtocol:        validProtocol,
				SkipAuth:            false,
				SASLMechanism:       internal.MechanismKerberos,
				SASLUsername:        "user",
				SASLPassword:        "", // allowed for kerberos but kerberos fields missing
				KerberosServiceName: "",
				KerberosRealm:       "",
				KerberosKeytab:      "",
				KerberosConfig:      "",
			},
			description: "Kerberos configuration fields cannot be empty",
			expectError: true,
		},
		{
			name: "sasl tls enabled without cert",
			conn: KafkaConnectionParamsConfig{
				Brokers:       []string{validBroker},
				SASLProtocol:  validProtocol,
				SkipAuth:      true,
				SASLTLSEnable: true,
				TLSCert:       " ", // empty after trim
			},
			description: "TLS certificate cannot be empty when SASL TLS is enabled",
			expectError: true,
		},
		{
			name: "invalid consumer group initial offset",
			conn: KafkaConnectionParamsConfig{
				Brokers:      []string{validBroker},
				SASLProtocol: validProtocol,
				SkipAuth:     true,
			},
			topics: []KafkaTopicsConfig{
				{ConsumerGroupInitialOffset: "badvalue", Replicas: 1},
			},
			description: "invalid consumer_group_initial_offset",
			expectError: true,
		},
		{
			name: "positive case with TLS and skip auth",
			conn: KafkaConnectionParamsConfig{
				Brokers:       []string{validBroker},
				SASLProtocol:  validProtocol,
				SkipAuth:      true,
				SASLTLSEnable: true,
				TLSCert:       "somecert",
			},
			expectError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := NewIngestorComponentConfig(validProvider, tt.conn, tt.topics)
			if tt.expectError {
				if err == nil {
					t.Fatalf("expected error containing %q, got nil", tt.description)
				}
				if !strings.Contains(err.Error(), tt.description) {
					t.Fatalf("expected error containing %q, got %v", tt.description, err)
				}
			} else {
				if err != nil {
					t.Fatalf("unexpected error: %v", err)
				}
			}
		})
	}
}

func TestNewIngestorComponentConfig_SuccessAndTopicDefaults(t *testing.T) {
	provider := "confluent"
	conn := KafkaConnectionParamsConfig{
		Brokers:       []string{"kafka:9092"},
		SASLProtocol:  "SASL_PLAINTEXT",
		SkipAuth:      false,
		SASLMechanism: internal.MechanismPlain,
		SASLUsername:  "user",
		SASLPassword:  "password",
		SASLTLSEnable: true,
		TLSCert:       "cert-data",
	}

	topics := []KafkaTopicsConfig{
		{
			Name:                       "topic-a",
			ID:                         "t1",
			ConsumerGroupInitialOffset: "", // should default to earliest
			ConsumerGroupName:          "cg",
			Replicas:                   0, // should default to 1
			Deduplication:              DeduplicationConfig{Enabled: false},
		},
		{
			Name:                       "topic-b",
			ID:                         "t2",
			ConsumerGroupInitialOffset: internal.InitialOffsetLatest,
			ConsumerGroupName:          "cg2",
			Replicas:                   3,
			Deduplication:              DeduplicationConfig{Enabled: true},
		},
	}

	cfg, err := NewIngestorComponentConfig(provider, conn, topics)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Basic returned structure checks
	if cfg.Type != internal.KafkaIngestorType {
		t.Fatalf("expected Type %q, got %q", internal.KafkaIngestorType, cfg.Type)
	}
	if cfg.Provider != provider {
		t.Fatalf("expected Provider %q, got %q", provider, cfg.Provider)
	}

	// Connection params round-trip
	if len(cfg.KafkaConnectionParams.Brokers) != 1 || cfg.KafkaConnectionParams.Brokers[0] != "kafka:9092" {
		t.Fatalf("unexpected brokers: %#v", cfg.KafkaConnectionParams.Brokers)
	}
	if cfg.KafkaConnectionParams.SASLMechanism != internal.MechanismPlain {
		t.Fatalf("unexpected SASL mechanism: %s", cfg.KafkaConnectionParams.SASLMechanism)
	}
	if !cfg.KafkaConnectionParams.SASLTLSEnable || cfg.KafkaConnectionParams.TLSCert != "cert-data" {
		t.Fatalf("unexpected TLS settings: %+v", cfg.KafkaConnectionParams)
	}

	// Topic defaults applied
	if len(cfg.KafkaTopics) != 2 {
		t.Fatalf("expected 2 topics, got %d", len(cfg.KafkaTopics))
	}

	if cfg.KafkaTopics[0].ConsumerGroupInitialOffset != internal.InitialOffsetEarliest {
		t.Fatalf("expected default consumer_group_initial_offset to be %q, got %q", internal.InitialOffsetEarliest, cfg.KafkaTopics[0].ConsumerGroupInitialOffset)
	}
	if cfg.KafkaTopics[0].Replicas != 1 {
		t.Fatalf("expected default replicas to be 1, got %d", cfg.KafkaTopics[0].Replicas)
	}
	if cfg.KafkaTopics[1].ConsumerGroupInitialOffset != internal.InitialOffsetLatest {
		t.Fatalf("expected consumer_group_initial_offset to be %q, got %q", internal.InitialOffsetLatest, cfg.KafkaTopics[1].ConsumerGroupInitialOffset)
	}
	if cfg.KafkaTopics[1].Replicas != 3 {
		t.Fatalf("expected replicas to be 3, got %d", cfg.KafkaTopics[1].Replicas)
	}
}
