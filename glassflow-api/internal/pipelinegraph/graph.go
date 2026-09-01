package pipelinegraph

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"sort"
	"strconv"
	"strings"
)

const (
	namePrefix    = "gfm"
	maxNameLength = 256
	nodeOutSuffix = "out"
)

type Graph struct {
	pipelineID string
	nodes      map[string]NodeConfig
	incoming   map[string][]EdgeConfig
	outgoing   map[string][]EdgeConfig
}

func New(config Config) (*Graph, error) {
	g := &Graph{
		pipelineID: config.PipelineID,
		nodes:      make(map[string]NodeConfig, len(config.Nodes)),
		incoming:   make(map[string][]EdgeConfig, len(config.Nodes)),
		outgoing:   make(map[string][]EdgeConfig, len(config.Nodes)),
	}

	if strings.TrimSpace(config.PipelineID) == "" {
		return nil, fmt.Errorf("pipeline_id is required")
	}

	for _, node := range config.Nodes {
		if err := validateNode(node); err != nil {
			return nil, err
		}
		if _, exists := g.nodes[node.ID]; exists {
			return nil, fmt.Errorf("duplicate node id %q", node.ID)
		}
		g.nodes[node.ID] = node
	}

	if len(g.nodes) == 0 {
		return nil, fmt.Errorf("at least one node is required")
	}

	for _, edge := range config.Edges {
		if err := g.addEdge(edge); err != nil {
			return nil, err
		}
	}

	for nodeID := range g.nodes {
		sortEdges(g.incoming[nodeID])
		sortEdges(g.outgoing[nodeID])
	}

	if err := g.validateTopology(); err != nil {
		return nil, err
	}

	return g, nil
}

func (g *Graph) GetOutput(nodeID string) (OutputBinding, error) {
	if _, exists := g.nodes[nodeID]; !exists {
		return OutputBinding{}, fmt.Errorf("node %q not found", nodeID)
	}

	edges := g.outgoing[nodeID]
	if len(edges) == 0 {
		return OutputBinding{}, fmt.Errorf("node %q has no output", nodeID)
	}
	if len(edges) > 1 {
		return OutputBinding{}, fmt.Errorf("node %q has %d outputs, multiple outputs are not supported", nodeID, len(edges))
	}

	return g.resolveOutput(edges[0])
}

func (g *Graph) GetInput(nodeID string) (InputBinding, error) {
	node, exists := g.nodes[nodeID]
	if !exists {
		return InputBinding{}, fmt.Errorf("node %q not found", nodeID)
	}
	if node.Type == NodeTypeJoin {
		return InputBinding{}, fmt.Errorf("join node %q requires GetJoinInput", nodeID)
	}

	return g.getInputByType(nodeID, InputTypeIn)
}

func (g *Graph) GetJoinInput(nodeID string) (JoinInputBinding, error) {
	node, exists := g.nodes[nodeID]
	if !exists {
		return JoinInputBinding{}, fmt.Errorf("node %q not found", nodeID)
	}
	if node.Type != NodeTypeJoin {
		return JoinInputBinding{}, fmt.Errorf("node %q is not a join node", nodeID)
	}

	left, err := g.getInputByType(nodeID, InputTypeLeft)
	if err != nil {
		return JoinInputBinding{}, err
	}
	right, err := g.getInputByType(nodeID, InputTypeRight)
	if err != nil {
		return JoinInputBinding{}, err
	}

	return JoinInputBinding{
		Left:  left,
		Right: right,
	}, nil
}

func (g *Graph) getInputByType(nodeID string, inputType InputType) (InputBinding, error) {
	edges := g.incoming[nodeID]
	var match *EdgeConfig
	for _, edge := range edges {
		if edge.TargetInputType != inputType {
			continue
		}
		if match != nil {
			return InputBinding{}, fmt.Errorf("node %q has multiple inputs named %q", nodeID, inputType)
		}
		edgeCopy := edge
		match = &edgeCopy
	}

	if match == nil {
		return InputBinding{}, fmt.Errorf("node %q has no input named %q", nodeID, inputType)
	}

	output, err := g.resolveOutput(*match)
	if err != nil {
		return InputBinding{}, err
	}

	return InputBinding{
		StreamPrefix: output.StreamPrefix,
		Streams:      output.Streams,
	}, nil
}

func (g *Graph) addEdge(edge EdgeConfig) error {
	if strings.TrimSpace(edge.ID) == "" {
		return fmt.Errorf("edge id is required")
	}
	if strings.TrimSpace(edge.SourceID) == "" {
		return fmt.Errorf("edge %q source_id is required", edge.ID)
	}
	if strings.TrimSpace(edge.TargetID) == "" {
		return fmt.Errorf("edge %q target_id is required", edge.ID)
	}
	if _, exists := g.nodes[edge.SourceID]; !exists {
		return fmt.Errorf("edge %q source node %q not found", edge.ID, edge.SourceID)
	}
	if _, exists := g.nodes[edge.TargetID]; !exists {
		return fmt.Errorf("edge %q target node %q not found", edge.ID, edge.TargetID)
	}

	g.outgoing[edge.SourceID] = append(g.outgoing[edge.SourceID], edge)
	g.incoming[edge.TargetID] = append(g.incoming[edge.TargetID], edge)

	return nil
}

func (g *Graph) validateTopology() error {
	for nodeID, node := range g.nodes {
		incoming := g.incoming[nodeID]
		outgoing := g.outgoing[nodeID]

		switch node.Type {
		case NodeTypeIngestor, NodeTypeOTLPSource:
			if len(incoming) != 0 {
				return fmt.Errorf("%s %q cannot have inputs", node.Type, nodeID)
			}
			if len(outgoing) != 1 {
				return fmt.Errorf("%s %q must have exactly one output", node.Type, nodeID)
			}
		case NodeTypeDedup:
			if len(incoming) != 1 || incoming[0].TargetInputType != InputTypeIn {
				return fmt.Errorf("dedup %q must have one input named \"in\"", nodeID)
			}
			if len(outgoing) != 1 {
				return fmt.Errorf("dedup %q must have exactly one output", nodeID)
			}
		case NodeTypeJoin:
			if len(incoming) != 2 {
				return fmt.Errorf("join %q must have exactly two inputs", nodeID)
			}
			if len(outgoing) != 1 {
				return fmt.Errorf("join %q must have exactly one output", nodeID)
			}
			if !hasTargetInput(incoming, InputTypeLeft) || !hasTargetInput(incoming, InputTypeRight) {
				return fmt.Errorf("join %q must have left and right inputs", nodeID)
			}
		case NodeTypeSink:
			if len(incoming) != 1 || incoming[0].TargetInputType != InputTypeIn {
				return fmt.Errorf("sink %q must have one input named \"in\"", nodeID)
			}
			if len(outgoing) != 0 {
				return fmt.Errorf("sink %q cannot have outputs", nodeID)
			}
		default:
			return fmt.Errorf("node %q has unsupported type %q", nodeID, node.Type)
		}
	}

	if err := g.validateAcyclic(); err != nil {
		return err
	}

	return nil
}

func (g *Graph) resolveOutput(edge EdgeConfig) (OutputBinding, error) {
	source, exists := g.nodes[edge.SourceID]
	if !exists {
		return OutputBinding{}, fmt.Errorf("edge %q source node %q not found", edge.ID, edge.SourceID)
	}
	target, exists := g.nodes[edge.TargetID]
	if !exists {
		return OutputBinding{}, fmt.Errorf("edge %q target node %q not found", edge.ID, edge.TargetID)
	}

	basePrefix, err := g.buildOutputPrefix(source)
	if err != nil {
		return OutputBinding{}, err
	}

	streams := buildStreams(basePrefix, source.Replicas, target.Replicas)
	totalSubjects := 0
	for _, s := range streams {
		totalSubjects += len(s.Subjects)
	}
	return OutputBinding{
		StreamPrefix:      basePrefix,
		SubjectPrefix:     basePrefix,
		Streams:           streams,
		TotalSubjectCount: totalSubjects,
	}, nil
}

// buildStreams assigns subjects to streams round-robin (subject s -> stream s%streamCount).
// Always creates exactly streamCount streams (one per downstream consumer).
// Total subjects = max(sourceReplicas, streamCount), so when downstream > upstream,
// the upstream replicas are each responsible for multiple subjects (round-robin publish).
//
// e.g. 1 source replica, 2 streams (1 ingestor → 2 sinks):
// subjects: [0, 1] -> stream_0=[subject_0], stream_1=[subject_1]
// source pod 0 publishes to both subjects round-robin.
//
// e.g. 3 source replicas, 2 streams:
// subjects: [0, 1, 2] -> stream_0=[subject_0, subject_2], stream_1=[subject_1]
// each source pod publishes to its own subject.
func buildStreams(prefix string, sourceReplicas, streamCount int) []StreamBinding {
	totalSubjects := max(sourceReplicas, streamCount)
	streams := make([]StreamBinding, streamCount)
	for i := range streams {
		streams[i].Name = fmt.Sprintf("%s_%d", prefix, i)
	}
	for s := range totalSubjects {
		streams[s%streamCount].Subjects = append(streams[s%streamCount].Subjects, prefix+"."+strconv.Itoa(s))
	}
	return streams
}

func validateNode(node NodeConfig) error {
	if strings.TrimSpace(node.ID) == "" {
		return fmt.Errorf("node id is required")
	}
	if node.Replicas < 1 {
		return fmt.Errorf("node %q replicas must be >= 1", node.ID)
	}

	switch node.Type {
	case NodeTypeDedup, NodeTypeJoin, NodeTypeSink, NodeTypeIngestor, NodeTypeOTLPSource:
	default:
		return fmt.Errorf("node %q has unsupported type %q", node.ID, node.Type)
	}

	return nil
}

func (g *Graph) buildOutputPrefix(node NodeConfig) (string, error) {
	hash := generatePipelineHash(g.pipelineID)
	baseName := truncateName(fmt.Sprintf("%s-%s-%s-%s", namePrefix, hash, sanitizeName(node.ID), nodeOutSuffix))

	switch node.Type {
	case NodeTypeDedup, NodeTypeJoin, NodeTypeIngestor, NodeTypeOTLPSource:
		return baseName, nil
	default:
		return "", fmt.Errorf("node %q of type %q does not produce output streams", node.ID, node.Type)
	}
}

func hasTargetInput(edges []EdgeConfig, targetInput InputType) bool {
	for _, edge := range edges {
		if edge.TargetInputType == targetInput {
			return true
		}
	}
	return false
}

func (g *Graph) validateAcyclic() error {
	inDegree := make(map[string]int, len(g.nodes))
	for nodeID := range g.nodes {
		inDegree[nodeID] = len(g.incoming[nodeID])
	}

	queue := make([]string, 0, len(g.nodes))
	for nodeID, degree := range inDegree {
		if degree == 0 {
			queue = append(queue, nodeID)
		}
	}
	sort.Strings(queue)

	visited := 0
	for len(queue) > 0 {
		nodeID := queue[0]
		queue = queue[1:]
		visited++

		for _, edge := range g.outgoing[nodeID] {
			inDegree[edge.TargetID]--
			if inDegree[edge.TargetID] == 0 {
				queue = append(queue, edge.TargetID)
				sort.Strings(queue)
			}
		}
	}

	if visited != len(g.nodes) {
		return fmt.Errorf("graph contains a cycle")
	}

	return nil
}

func sortEdges(edges []EdgeConfig) {
	sort.Slice(edges, func(i, j int) bool {
		return edgeSortKey(edges[i]) < edgeSortKey(edges[j])
	})
}

func edgeSortKey(edge EdgeConfig) string {
	return inputSortKey(edge.TargetInputType) + ":" + edge.ID
}

func inputSortKey(input InputType) string {
	switch input {
	case InputTypeLeft:
		return "0"
	case InputTypeIn:
		return "1"
	case InputTypeRight:
		return "2"
	default:
		return "9:" + string(input)
	}
}

func generatePipelineHash(pipelineID string) string {
	hash := sha256.Sum256([]byte(pipelineID))
	return hex.EncodeToString(hash[:])[:8]
}

func sanitizeName(value string) string {
	replacer := strings.NewReplacer(".", "_", " ", "_", "/", "_")
	return replacer.Replace(value)
}

func truncateName(name string) string {
	if len(name) <= maxNameLength {
		return name
	}
	return name[:maxNameLength]
}
