package pipelinegraph

import (
	"reflect"
	"testing"

	etlv1alpha1 "github.com/glassflow/glassflow-etl-k8s-operator/api/v1alpha1"
)

func TestConfigFromJoinlessPipelineSpecIngestorSink(t *testing.T) {
	t.Parallel()

	config, err := ConfigFromJoinlessPipelineSpec(etlv1alpha1.PipelineSpec{
		ID: "pipe-1",
		Source: etlv1alpha1.Sources{
			Streams: []etlv1alpha1.SourceStream{
				{TopicName: "orders.events"},
			},
		},
		Resources: &etlv1alpha1.PipelineResources{
			Ingestor: &etlv1alpha1.IngestorResources{
				Base: &etlv1alpha1.ComponentResources{Replicas: ptrInt32(2)},
			},
			Sink: &etlv1alpha1.ComponentResources{Replicas: ptrInt32(3)},
		},
	})
	if err != nil {
		t.Fatalf("ConfigFromPipelineSpec returned error: %v", err)
	}

	want := Config{
		PipelineID: "pipe-1",
		Nodes: []NodeConfig{
			{ID: "ingestor", Type: NodeTypeIngestor, Replicas: 2},
			{ID: "sink", Type: NodeTypeSink, Replicas: 3},
		},
		Edges: []EdgeConfig{
			{ID: "ingestor_to_sink", SourceID: "ingestor", TargetID: "sink", TargetInputType: InputTypeIn},
		},
	}
	if !reflect.DeepEqual(config, want) {
		t.Fatalf("config = %#v, want %#v", config, want)
	}
}

func TestConfigFromJoinlessPipelineSpecIngestorDedupSink(t *testing.T) {
	t.Parallel()

	config, err := ConfigFromJoinlessPipelineSpec(etlv1alpha1.PipelineSpec{
		ID: "pipe-1",
		Source: etlv1alpha1.Sources{
			Streams: []etlv1alpha1.SourceStream{
				{
					TopicName: "orders.events",
					Deduplication: &etlv1alpha1.Deduplication{
						Enabled: true,
					},
				},
			},
		},
		Transform: etlv1alpha1.Transform{
			IsDedupEnabled: true,
		},
		Resources: &etlv1alpha1.PipelineResources{
			Ingestor: &etlv1alpha1.IngestorResources{
				Base: &etlv1alpha1.ComponentResources{Replicas: ptrInt32(3)},
			},
			Dedup: &etlv1alpha1.ComponentResources{Replicas: ptrInt32(2)},
			Sink:  &etlv1alpha1.ComponentResources{Replicas: ptrInt32(1)},
		},
	})
	if err != nil {
		t.Fatalf("ConfigFromPipelineSpec returned error: %v", err)
	}

	want := Config{
		PipelineID: "pipe-1",
		Nodes: []NodeConfig{
			{ID: "ingestor", Type: NodeTypeIngestor, Replicas: 3},
			{ID: "dedup", Type: NodeTypeDedup, Replicas: 2},
			{ID: "sink", Type: NodeTypeSink, Replicas: 1},
		},
		Edges: []EdgeConfig{
			{ID: "ingestor_to_dedup", SourceID: "ingestor", TargetID: "dedup", TargetInputType: InputTypeIn},
			{ID: "dedup_to_sink", SourceID: "dedup", TargetID: "sink", TargetInputType: InputTypeIn},
		},
	}
	if !reflect.DeepEqual(config, want) {
		t.Fatalf("config = %#v, want %#v", config, want)
	}
}

func TestConfigFromJoinPipelineSpecWithOneDedupDisabled(t *testing.T) {
	t.Parallel()

	config, err := ConfigFromJoinPipelineSpec(etlv1alpha1.PipelineSpec{
		ID: "pipe-join",
		Source: etlv1alpha1.Sources{
			Streams: []etlv1alpha1.SourceStream{
				{TopicName: "users"},
				{
					TopicName: "accounts",
					Deduplication: &etlv1alpha1.Deduplication{
						Enabled: true,
					},
				},
			},
		},
		Join: etlv1alpha1.Join{Enabled: true},
		Resources: &etlv1alpha1.PipelineResources{
			Ingestor: &etlv1alpha1.IngestorResources{
				Left:  &etlv1alpha1.ComponentResources{Replicas: ptrInt32(2)},
				Right: &etlv1alpha1.ComponentResources{Replicas: ptrInt32(4)},
			},
			Dedup: &etlv1alpha1.ComponentResources{Replicas: ptrInt32(3)},
			Join:  &etlv1alpha1.ComponentResources{Replicas: ptrInt32(1)},
			Sink:  &etlv1alpha1.ComponentResources{Replicas: ptrInt32(2)},
		},
	})
	if err != nil {
		t.Fatalf("ConfigFromPipelineSpec returned error: %v", err)
	}

	want := Config{
		PipelineID: "pipe-join",
		Nodes: []NodeConfig{
			{ID: "ingestor_left", Type: NodeTypeIngestor, Replicas: 2},
			{ID: "ingestor_right", Type: NodeTypeIngestor, Replicas: 4},
			{ID: "dedup_right", Type: NodeTypeDedup, Replicas: 3},
			{ID: "join", Type: NodeTypeJoin, Replicas: 1},
			{ID: "sink", Type: NodeTypeSink, Replicas: 2},
		},
		Edges: []EdgeConfig{
			{ID: "ingestor_right_to_dedup_right", SourceID: "ingestor_right", TargetID: "dedup_right", TargetInputType: InputTypeIn},
			{ID: "ingestor_left_to_join", SourceID: "ingestor_left", TargetID: "join", TargetInputType: InputTypeLeft},
			{ID: "dedup_right_to_join", SourceID: "dedup_right", TargetID: "join", TargetInputType: InputTypeRight},
			{ID: "join_to_sink", SourceID: "join", TargetID: "sink", TargetInputType: InputTypeIn},
		},
	}
	if !reflect.DeepEqual(config, want) {
		t.Fatalf("config = %#v, want %#v", config, want)
	}
}

// OTLP tests

func TestConfigFromOTLPPipelineSpecSinkOnly(t *testing.T) {
	t.Parallel()

	config, err := ConfigFromOTLPPipelineSpec(etlv1alpha1.PipelineSpec{
		ID: "pipe-otlp",
		Source: etlv1alpha1.Sources{
			Type: etlv1alpha1.SourceTypeOTLPLogs,
		},
		Sink: etlv1alpha1.Sink{Type: "clickhouse"},
		Resources: &etlv1alpha1.PipelineResources{
			Sink: &etlv1alpha1.ComponentResources{Replicas: ptrInt32(2)},
		},
	})
	if err != nil {
		t.Fatalf("ConfigFromOTLPPipelineSpec returned error: %v", err)
	}

	want := Config{
		PipelineID: "pipe-otlp",
		Nodes: []NodeConfig{
			{ID: "otlp", Type: NodeTypeOTLPSource, Replicas: 2},
			{ID: "sink", Type: NodeTypeSink, Replicas: 2},
		},
		Edges: []EdgeConfig{
			{ID: "otlp_to_sink", SourceID: "otlp", TargetID: "sink", TargetInputType: InputTypeIn},
		},
	}
	if !reflect.DeepEqual(config, want) {
		t.Fatalf("config = %#v, want %#v", config, want)
	}
}

func TestConfigFromOTLPPipelineSpecWithDedup(t *testing.T) {
	t.Parallel()

	config, err := ConfigFromOTLPPipelineSpec(etlv1alpha1.PipelineSpec{
		ID: "pipe-otlp-dedup",
		Source: etlv1alpha1.Sources{
			Type: etlv1alpha1.SourceTypeOTLPTraces,
		},
		Transform: etlv1alpha1.Transform{
			IsDedupEnabled: true,
		},
		Sink: etlv1alpha1.Sink{Type: "clickhouse"},
		Resources: &etlv1alpha1.PipelineResources{
			Dedup: &etlv1alpha1.ComponentResources{Replicas: ptrInt32(2)},
			Sink:  &etlv1alpha1.ComponentResources{Replicas: ptrInt32(1)},
		},
	})
	if err != nil {
		t.Fatalf("ConfigFromOTLPPipelineSpec returned error: %v", err)
	}

	want := Config{
		PipelineID: "pipe-otlp-dedup",
		Nodes: []NodeConfig{
			{ID: "otlp", Type: NodeTypeOTLPSource, Replicas: 2},
			{ID: "dedup", Type: NodeTypeDedup, Replicas: 2},
			{ID: "sink", Type: NodeTypeSink, Replicas: 1},
		},
		Edges: []EdgeConfig{
			{ID: "otlp_to_dedup", SourceID: "otlp", TargetID: "dedup", TargetInputType: InputTypeIn},
			{ID: "dedup_to_sink", SourceID: "dedup", TargetID: "sink", TargetInputType: InputTypeIn},
		},
	}
	if !reflect.DeepEqual(config, want) {
		t.Fatalf("config = %#v, want %#v", config, want)
	}
}

func TestConfigFromPipelineSpecDispatchesOTLP(t *testing.T) {
	t.Parallel()

	for _, sourceType := range []string{
		etlv1alpha1.SourceTypeOTLPLogs,
		etlv1alpha1.SourceTypeOTLPTraces,
		etlv1alpha1.SourceTypeOTLPMetrics,
	} {
		t.Run(sourceType, func(t *testing.T) {
			t.Parallel()

			config, err := ConfigFromPipelineSpec(etlv1alpha1.PipelineSpec{
				ID:     "pipe-otlp",
				Source: etlv1alpha1.Sources{Type: sourceType},
				Sink:   etlv1alpha1.Sink{Type: "clickhouse"},
			})
			if err != nil {
				t.Fatalf("ConfigFromPipelineSpec returned error: %v", err)
			}
			for _, node := range config.Nodes {
				if node.Type == NodeTypeIngestor {
					t.Fatalf("expected no ingestor node for OTLP source type %q, but got one", sourceType)
				}
			}
		})
	}
}

func ptrInt32(v int32) *int32 {
	return &v
}
