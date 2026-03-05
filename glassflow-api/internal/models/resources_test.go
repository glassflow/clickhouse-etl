package models

import (
	"slices"
	"testing"
)

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
