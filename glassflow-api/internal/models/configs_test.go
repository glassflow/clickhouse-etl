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
	ingestor := IngestorComponentConfig{Type: KafkaIngestorType}
	join := JoinComponentConfig{Type: TemporalJoinType}
	sink := SinkComponentConfig{Type: ClickHouseSinkType}

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
