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
