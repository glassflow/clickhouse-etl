package models

import (
	"slices"
	"testing"
)

func TestNewDefaultPipelineResources_NonJoin_TopicReplicas(t *testing.T) {
	cfg := &PipelineConfig{
		Ingestor: IngestorComponentConfig{
			KafkaTopics: []KafkaTopicsConfig{
				{Replicas: 3},
			},
		},
	}

	r := NewDefaultPipelineResources(cfg)

	if r.Ingestor.Base == nil || r.Ingestor.Base.Replicas == nil {
		t.Fatal("expected Base replicas to be set")
	}
	if *r.Ingestor.Base.Replicas != 3 {
		t.Errorf("expected Base.Replicas == 3, got %d", *r.Ingestor.Base.Replicas)
	}
}

func TestNewDefaultPipelineResources_Join_TopicReplicas(t *testing.T) {
	cfg := &PipelineConfig{
		Join: JoinComponentConfig{Enabled: true},
		Ingestor: IngestorComponentConfig{
			KafkaTopics: []KafkaTopicsConfig{
				{Replicas: 2},
				{Replicas: 5},
			},
		},
	}

	r := NewDefaultPipelineResources(cfg)

	if r.Ingestor.Left == nil || r.Ingestor.Left.Replicas == nil {
		t.Fatal("expected Left replicas to be set")
	}
	if *r.Ingestor.Left.Replicas != 2 {
		t.Errorf("expected Left.Replicas == 2, got %d", *r.Ingestor.Left.Replicas)
	}
	if r.Ingestor.Right == nil || r.Ingestor.Right.Replicas == nil {
		t.Fatal("expected Right replicas to be set")
	}
	if *r.Ingestor.Right.Replicas != 5 {
		t.Errorf("expected Right.Replicas == 5, got %d", *r.Ingestor.Right.Replicas)
	}
}

func TestNewDefaultPipelineResources_EmptyTopics_DefaultsToOne(t *testing.T) {
	cfg := &PipelineConfig{}

	r := NewDefaultPipelineResources(cfg)

	if r.Ingestor.Base == nil || r.Ingestor.Base.Replicas == nil {
		t.Fatal("expected Base replicas to be set")
	}
	if *r.Ingestor.Base.Replicas != 1 {
		t.Errorf("expected Base.Replicas == 1, got %d", *r.Ingestor.Base.Replicas)
	}
}

func TestMergeWithDefaults_ExistingReplicasHonored(t *testing.T) {
	cfg := &PipelineConfig{
		Ingestor: IngestorComponentConfig{
			KafkaTopics: []KafkaTopicsConfig{
				{Replicas: 4},
			},
		},
	}
	explicit := PipelineResources{
		Ingestor: &IngestorResources{
			Base: &ComponentResources{Replicas: ptrInt64(7)},
		},
	}

	defaults := NewDefaultPipelineResources(cfg)
	result := MergeWithDefaults(cfg, explicit, defaults)

	if result.Ingestor.Base == nil || result.Ingestor.Base.Replicas == nil {
		t.Fatal("expected Base replicas to be set")
	}
	if *result.Ingestor.Base.Replicas != 7 {
		t.Errorf("expected explicit replicas 7 to be honored, got %d", *result.Ingestor.Base.Replicas)
	}
}

func TestGetImmutableAfterCreateFields_WithoutDedup(t *testing.T) {
	cfg := &PipelineConfig{}

	fields := GetImmutableFields(cfg)

	if slices.Contains(fields, "transform/replicas") {
		t.Error("expected transform/replicas NOT in immutable fields when dedup is disabled")
	}

	// Base fields should still be present
	for _, f := range PipelineResourcesImmutable {
		if !slices.Contains(fields, f) {
			t.Errorf("expected base field %q in immutable fields", f)
		}
	}
}

func TestGetImmutableAfterCreateFields_WithDedup(t *testing.T) {
	cfg := &PipelineConfig{
		Ingestor: IngestorComponentConfig{
			KafkaTopics: []KafkaTopicsConfig{
				{Deduplication: DeduplicationConfig{Enabled: true}},
			},
		},
	}

	fields := GetImmutableFields(cfg)

	if !slices.Contains(fields, "transform/replicas") {
		t.Error("expected transform/replicas in immutable fields when dedup is enabled")
	}
}

func TestParseNATSMaxBytesQuantity(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		want    int64
		wantErr bool
	}{
		{
			name:  "resource quantity",
			input: "10Gi",
			want:  10 * 1024 * 1024 * 1024,
		},
		{
			name:  "compatibility gb format",
			input: "1GB",
			want:  1024 * 1024 * 1024,
		},
		{
			name:  "compatibility decimal tb format",
			input: "1.5TB",
			want:  int64(1.5 * 1024 * 1024 * 1024 * 1024),
		},
		{
			name:  "plain number",
			input: "1048576",
			want:  1048576,
		},
		{
			name:    "invalid format",
			input:   "10gigs",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			q, err := ParseNATSMaxBytesQuantity(tt.input)
			if (err != nil) != tt.wantErr {
				t.Fatalf("ParseNATSMaxBytesQuantity() error = %v, wantErr %v", err, tt.wantErr)
			}
			if tt.wantErr {
				return
			}

			if q.Value() != tt.want {
				t.Fatalf("ParseNATSMaxBytesQuantity() value = %d, want %d", q.Value(), tt.want)
			}
		})
	}
}

func TestDefaultNATSMaxMsgs(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name          string
		sinkBatchSize int
		want          int64
	}{
		{name: "50k batch (dedup default)", sinkBatchSize: 50_000, want: 400_000},
		{name: "10k batch (typical sink)", sinkBatchSize: 10_000, want: 80_000},
		{name: "1k batch (small)", sinkBatchSize: 1_000, want: 8_000},
		{name: "zero falls back to 500k", sinkBatchSize: 0, want: 500_000},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			if got := defaultNATSMaxMsgs(tt.sinkBatchSize); got != tt.want {
				t.Errorf("defaultNATSMaxMsgs(%d) = %d, want %d", tt.sinkBatchSize, got, tt.want)
			}
		})
	}
}

func TestValidateNatsResources_MaxMsgs(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		maxMsgs int64
		wantErr bool
	}{
		{name: "zero (operator default)", maxMsgs: 0, wantErr: false},
		{name: "positive value", maxMsgs: 500_000, wantErr: false},
		{name: "-1 (unlimited)", maxMsgs: -1, wantErr: false},
		{name: "below -1 is invalid", maxMsgs: -2, wantErr: true},
		{name: "large negative invalid", maxMsgs: -1_000_000, wantErr: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			n := &NatsResources{
				Stream: &NatsStreamResources{MaxMsgs: tt.maxMsgs},
			}
			err := validateNatsResources(n)
			if (err != nil) != tt.wantErr {
				t.Errorf("validateNatsResources() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}
