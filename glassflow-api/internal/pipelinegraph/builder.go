package pipelinegraph

import (
	"fmt"

	etlv1alpha1 "github.com/glassflow/glassflow-etl-k8s-operator/api/v1alpha1"
)

// defaultMinReplicas mirrors defaultMinReplicas in the operator repo,
// inlined here because Go's internal/ rule forbids importing it across modules.
// If this value ever needs to be shared, promote it into etlv1alpha1.
const defaultMinReplicas = 1

const (
	joinNodeID     = "join"
	sinkNodeID     = "sink"
	ingestorNodeID = "ingestor"
	dedupNodeID    = "dedup"
)

// IngestorNodeID returns the graph node ID for the ingestor serving streamIndex.
func IngestorNodeID(spec etlv1alpha1.PipelineSpec, streamIndex int) string {
	return IngestorNodeIDForIndex(streamIndex, spec.Join.Enabled)
}

// IngestorNodeIDForIndex returns the ingestor node ID for a topic index without
// requiring a full PipelineSpec.
func IngestorNodeIDForIndex(streamIndex int, hasJoin bool) string {
	if hasJoin {
		return ingestorNodeID + "_" + joinSide(streamIndex).String()
	}
	return ingestorNodeID
}

// DedupNodeID returns the graph node ID for the dedup serving streamIndex.
func DedupNodeID(spec etlv1alpha1.PipelineSpec, streamIndex int) string {
	return DedupNodeIDForIndex(streamIndex, spec.Join.Enabled)
}

// DedupNodeIDForIndex returns the dedup node ID for a topic index without
// requiring a full PipelineSpec.
func DedupNodeIDForIndex(streamIndex int, hasJoin bool) string {
	if hasJoin {
		return dedupNodeID + "_" + joinSide(streamIndex).String()
	}
	return dedupNodeID
}

// StreamName returns the NATS JetStream stream name for a pipeline node —
// the same deterministic formula the graph resolver uses, without requiring
// a full PipelineSpec or graph resolution.
func StreamName(pipelineID, nodeID string) string {
	hash := generatePipelineHash(pipelineID)
	prefix := truncateName(fmt.Sprintf("%s-%s-%s-%s", namePrefix, hash, sanitizeName(nodeID), nodeOutSuffix))
	return prefix + "_0"
}

// JoinNodeID returns the graph node ID for the join component.
func JoinNodeID() string {
	return joinNodeID
}

// SinkNodeID returns the graph node ID for the sink component.
func SinkNodeID() string {
	return sinkNodeID
}

// ConfigFromPipelineSpec converts a PipelineSpec into a graph topology config.
func ConfigFromPipelineSpec(spec etlv1alpha1.PipelineSpec) (Config, error) {
	if spec.IsOTLPSource() {
		return ConfigFromOTLPPipelineSpec(spec)
	}
	if spec.Join.Enabled {
		return ConfigFromJoinPipelineSpec(spec)
	}

	return ConfigFromJoinlessPipelineSpec(spec)
}

const otlpSourceNodeID = "otlp"

// OTLPSourceNodeID returns the graph node ID for the OTLP source node.
func OTLPSourceNodeID() string {
	return otlpSourceNodeID
}

// ConfigFromOTLPPipelineSpec builds a graph config for an OTLP-sourced pipeline.
// A virtual otlp_source node is always the first node — it has no K8s StatefulSet but
// its output binding defines the NATS subject the shared OTLP receiver publishes to.
func ConfigFromOTLPPipelineSpec(spec etlv1alpha1.PipelineSpec) (Config, error) {
	otlpID := OTLPSourceNodeID()
	sinkID := SinkNodeID()

	otlpReplicas := getSinkReplicas(spec)
	if transformsAreEnabled(spec) {
		otlpReplicas = getDedupReplicas(spec)
	}

	config := Config{
		PipelineID: spec.ID,
		Nodes: []NodeConfig{
			{
				ID:       otlpID,
				Type:     NodeTypeOTLPSource,
				Replicas: otlpReplicas,
			},
		},
	}

	upstreamID := otlpID

	if transformsAreEnabled(spec) {
		dedupID := DedupNodeID(spec, 0)
		config.Nodes = append(config.Nodes, NodeConfig{
			ID:       dedupID,
			Type:     NodeTypeDedup,
			Replicas: getDedupReplicas(spec),
		})
		config.Edges = append(config.Edges, EdgeConfig{
			ID:              edgeID(otlpID, dedupID),
			SourceID:        otlpID,
			TargetID:        dedupID,
			TargetInputType: InputTypeIn,
		})
		upstreamID = dedupID
	}

	config.Nodes = append(config.Nodes, NodeConfig{
		ID:       sinkID,
		Type:     NodeTypeSink,
		Replicas: getSinkReplicas(spec),
	})
	config.Edges = append(config.Edges, EdgeConfig{
		ID:              edgeID(upstreamID, sinkID),
		SourceID:        upstreamID,
		TargetID:        sinkID,
		TargetInputType: InputTypeIn,
	})

	return config, nil
}

// ConfigFromJoinlessPipelineSpec builds a graph config for a single-source pipeline:
func ConfigFromJoinlessPipelineSpec(spec etlv1alpha1.PipelineSpec) (Config, error) {
	ingestorID := IngestorNodeID(spec, 0)
	sinkID := SinkNodeID()

	config := Config{
		PipelineID: spec.ID,
		Nodes: []NodeConfig{
			{
				ID:       ingestorID,
				Type:     NodeTypeIngestor,
				Replicas: getIngestorReplicas(spec, 0),
			},
		},
	}

	upstreamID := ingestorID
	if transformsAreEnabled(spec) {
		dedupID := DedupNodeID(spec, 0)
		config.Nodes = append(config.Nodes, NodeConfig{
			ID:       dedupID,
			Type:     NodeTypeDedup,
			Replicas: getDedupReplicas(spec),
		})
		config.Edges = append(config.Edges, EdgeConfig{
			ID:              edgeID(ingestorID, dedupID),
			SourceID:        ingestorID,
			TargetID:        dedupID,
			TargetInputType: InputTypeIn,
		})
		upstreamID = dedupID
	}

	config.Nodes = append(config.Nodes, NodeConfig{
		ID:       sinkID,
		Type:     NodeTypeSink,
		Replicas: getSinkReplicas(spec),
	})
	config.Edges = append(config.Edges, EdgeConfig{
		ID:              edgeID(upstreamID, sinkID),
		SourceID:        upstreamID,
		TargetID:        sinkID,
		TargetInputType: InputTypeIn,
	})

	return config, nil
}

// ConfigFromJoinPipelineSpec builds a graph config for join pipeline:
func ConfigFromJoinPipelineSpec(spec etlv1alpha1.PipelineSpec) (Config, error) {
	config := Config{
		PipelineID: spec.ID,
		Nodes:      make([]NodeConfig, 0, len(spec.Source.Streams)),
		Edges:      make([]EdgeConfig, 0, len(spec.Source.Streams)),
	}

	upstreamNodeIDs := make([]string, 0, len(spec.Source.Streams))
	for i, stream := range spec.Source.Streams {
		ingestorID := IngestorNodeID(spec, i)
		config.Nodes = append(config.Nodes, NodeConfig{
			ID:       ingestorID,
			Type:     NodeTypeIngestor,
			Replicas: getIngestorReplicas(spec, i),
		})

		upstreamID := ingestorID
		if isStreamDedupEnabled(stream) {
			dedupID := DedupNodeID(spec, i)
			config.Nodes = append(config.Nodes, NodeConfig{
				ID:       dedupID,
				Type:     NodeTypeDedup,
				Replicas: getDedupReplicas(spec),
			})
			config.Edges = append(config.Edges, EdgeConfig{
				ID:              edgeID(ingestorID, dedupID),
				SourceID:        ingestorID,
				TargetID:        dedupID,
				TargetInputType: InputTypeIn,
			})
			upstreamID = dedupID
		}

		upstreamNodeIDs = append(upstreamNodeIDs, upstreamID)
	}

	config.Nodes = append(config.Nodes, NodeConfig{
		ID:       JoinNodeID(),
		Type:     NodeTypeJoin,
		Replicas: getJoinReplicas(spec),
	})
	config.Edges = append(config.Edges, joinEdgeConfig(upstreamNodeIDs[0], 0))
	config.Edges = append(config.Edges, joinEdgeConfig(upstreamNodeIDs[1], 1))

	config.Nodes = append(config.Nodes, NodeConfig{
		ID:       SinkNodeID(),
		Type:     NodeTypeSink,
		Replicas: getSinkReplicas(spec),
	})

	sinkSourceID := JoinNodeID()
	config.Edges = append(config.Edges, EdgeConfig{
		ID:              edgeID(sinkSourceID, SinkNodeID()),
		SourceID:        sinkSourceID,
		TargetID:        SinkNodeID(),
		TargetInputType: InputTypeIn,
	})

	return config, nil
}

// NewFromPipelineSpec builds and validates a graph directly from a PipelineSpec.
func NewFromPipelineSpec(spec etlv1alpha1.PipelineSpec) (*Graph, error) {
	config, err := ConfigFromPipelineSpec(spec)
	if err != nil {
		return nil, err
	}

	return New(config)
}

func joinEdgeConfig(sourceID string, streamIndex int) EdgeConfig {
	inputType := joinSide(streamIndex)
	return EdgeConfig{
		ID:              edgeID(sourceID, JoinNodeID()),
		SourceID:        sourceID,
		TargetID:        JoinNodeID(),
		TargetInputType: inputType,
	}
}

func edgeID(sourceID, targetID string) string {
	return fmt.Sprintf("%s_to_%s", sourceID, targetID)
}

func joinSide(streamIndex int) InputType {
	if streamIndex == 0 {
		return InputTypeLeft
	}
	return InputTypeRight
}

func getIngestorReplicas(spec etlv1alpha1.PipelineSpec, streamIndex int) int {
	replicas := defaultMinReplicas
	if spec.Resources == nil || spec.Resources.Ingestor == nil {
		return replicas
	}

	ingestorResources := spec.Resources.Ingestor
	var component *etlv1alpha1.ComponentResources
	if spec.Join.Enabled {
		if streamIndex == 0 {
			component = ingestorResources.Left
		} else {
			component = ingestorResources.Right
		}
	} else {
		component = ingestorResources.Base
	}

	if component != nil && component.Replicas != nil {
		replicas = int(*component.Replicas)
	}
	if replicas <= 0 {
		return defaultMinReplicas
	}

	return replicas
}

func getDedupReplicas(spec etlv1alpha1.PipelineSpec) int {
	replicas := defaultMinReplicas
	if spec.Resources != nil && spec.Resources.Dedup != nil && spec.Resources.Dedup.Replicas != nil {
		replicas = int(*spec.Resources.Dedup.Replicas)
	}
	if replicas <= 0 {
		return defaultMinReplicas
	}

	return replicas
}

func getJoinReplicas(spec etlv1alpha1.PipelineSpec) int {
	replicas := defaultMinReplicas
	if spec.Resources != nil && spec.Resources.Join != nil && spec.Resources.Join.Replicas != nil {
		replicas = int(*spec.Resources.Join.Replicas)
	}
	if replicas <= 0 {
		return defaultMinReplicas
	}

	return replicas
}

func getSinkReplicas(spec etlv1alpha1.PipelineSpec) int {
	replicas := defaultMinReplicas
	if spec.Resources != nil && spec.Resources.Sink != nil && spec.Resources.Sink.Replicas != nil {
		replicas = int(*spec.Resources.Sink.Replicas)
	}
	if replicas <= 0 {
		return defaultMinReplicas
	}

	return replicas
}

func isStreamDedupEnabled(stream etlv1alpha1.SourceStream) bool {
	return stream.Deduplication != nil && stream.Deduplication.Enabled
}

func transformsAreEnabled(spec etlv1alpha1.PipelineSpec) bool {
	if spec.Transform.IsStatelessTransformEnabled ||
		spec.Transform.IsFilterEnabled ||
		spec.Transform.IsDedupEnabled {
		return true
	}

	for _, stream := range spec.Source.Streams {
		if stream.Deduplication != nil && stream.Deduplication.Enabled {
			return true
		}
	}

	return false
}
