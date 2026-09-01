package pipelinegraph

import (
	"reflect"
	"testing"
)

func streamBinding(name string, subjects ...string) StreamBinding {
	return StreamBinding{
		Name:     name,
		Subjects: subjects,
	}
}

func outputBinding(prefix string, totalSubjectCount int, streams ...StreamBinding) OutputBinding {
	return OutputBinding{
		StreamPrefix:      prefix,
		SubjectPrefix:     prefix,
		Streams:           streams,
		TotalSubjectCount: totalSubjectCount,
	}
}

func inputBinding(prefix string, streams ...StreamBinding) InputBinding {
	return InputBinding{
		StreamPrefix: prefix,
		Streams:      streams,
	}
}

// Topology:
//
//	┌───────────────┐         ┌───────────┐
//	│ ingestor_0 x2 ├── in ──►│ sink_0 x2 │
//	└───────────────┘         └───────────┘
func TestGraphIngestorSinkTwoTwo(t *testing.T) {
	t.Parallel()

	graph, err := New(Config{
		PipelineID: "pipe-1",
		Nodes: []NodeConfig{
			{
				ID:       "ingestor_0",
				Type:     NodeTypeIngestor,
				Replicas: 2,
			},
			{
				ID:       "sink_0",
				Type:     NodeTypeSink,
				Replicas: 2,
			},
		},
		Edges: []EdgeConfig{
			{
				ID:              "e1",
				SourceID:        "ingestor_0",
				TargetID:        "sink_0",
				TargetInputType: InputTypeIn,
			},
		},
	})
	if err != nil {
		t.Fatalf("New returned error: %v", err)
	}

	output, err := graph.GetOutput("ingestor_0")
	if err != nil {
		t.Fatalf("GetOutput returned error: %v", err)
	}

	wantOutput := outputBinding(
		"gfm-1528386a-ingestor_0-out",
		2,
		streamBinding("gfm-1528386a-ingestor_0-out_0", "gfm-1528386a-ingestor_0-out.0"),
		streamBinding("gfm-1528386a-ingestor_0-out_1", "gfm-1528386a-ingestor_0-out.1"),
	)
	if !reflect.DeepEqual(output, wantOutput) {
		t.Fatalf("output = %#v, want %#v", output, wantOutput)
	}

	sinkInput, err := graph.GetInput("sink_0")
	if err != nil {
		t.Fatalf("GetInput(sink_0) returned error: %v", err)
	}
	wantSinkInput := inputBinding(
		"gfm-1528386a-ingestor_0-out",
		streamBinding("gfm-1528386a-ingestor_0-out_0", "gfm-1528386a-ingestor_0-out.0"),
		streamBinding("gfm-1528386a-ingestor_0-out_1", "gfm-1528386a-ingestor_0-out.1"),
	)
	if !reflect.DeepEqual(sinkInput, wantSinkInput) {
		t.Fatalf("sinkInput = %#v, want %#v", sinkInput, wantSinkInput)
	}
}

// Topology:
//
//	┌───────────────┐
//	│ ingestor_0 x3 ├──── left ────┐
//	└───────────────┘              │
//	                           ┌───▼──────┐         ┌───────────┐
//	                           │ join_0 x1├── in ──►│ sink_0 x1 │
//	                           └───▲──────┘         └───────────┘
//	┌───────────────┐              │
//	│ ingestor_1 x2 ├──── right  ──┘
//	└───────────────┘
func TestGraphTwoIngestorsJoinSink(t *testing.T) {
	t.Parallel()

	graph, err := New(Config{
		PipelineID: "pipe-join",
		Nodes: []NodeConfig{
			{ID: "ingestor_0", Type: NodeTypeIngestor, Replicas: 3},
			{ID: "ingestor_1", Type: NodeTypeIngestor, Replicas: 2},
			{ID: "join_0", Type: NodeTypeJoin, Replicas: 1},
			{ID: "sink_0", Type: NodeTypeSink, Replicas: 1},
		},
		Edges: []EdgeConfig{
			{ID: "e1", SourceID: "ingestor_0", TargetID: "join_0", TargetInputType: InputTypeLeft},
			{ID: "e2", SourceID: "ingestor_1", TargetID: "join_0", TargetInputType: InputTypeRight},
			{ID: "e3", SourceID: "join_0", TargetID: "sink_0", TargetInputType: InputTypeIn},
		},
	})
	if err != nil {
		t.Fatalf("New returned error: %v", err)
	}

	inputs, err := graph.GetJoinInput("join_0")
	if err != nil {
		t.Fatalf("GetJoinInput returned error: %v", err)
	}

	left := inputs.Left

	wantLeft := inputBinding(
		"gfm-2802cd7f-ingestor_0-out",
		streamBinding(
			"gfm-2802cd7f-ingestor_0-out_0",
			"gfm-2802cd7f-ingestor_0-out.0",
			"gfm-2802cd7f-ingestor_0-out.1",
			"gfm-2802cd7f-ingestor_0-out.2",
		),
	)
	if !reflect.DeepEqual(left, wantLeft) {
		t.Fatalf("left = %#v, want %#v", left, wantLeft)
	}

	right := inputs.Right
	wantRight := inputBinding(
		"gfm-2802cd7f-ingestor_1-out",
		streamBinding(
			"gfm-2802cd7f-ingestor_1-out_0",
			"gfm-2802cd7f-ingestor_1-out.0",
			"gfm-2802cd7f-ingestor_1-out.1",
		),
	)
	if !reflect.DeepEqual(right, wantRight) {
		t.Fatalf("right = %#v, want %#v", right, wantRight)
	}

	joinOutput, err := graph.GetOutput("join_0")
	if err != nil {
		t.Fatalf("GetOutput(join_0) returned error: %v", err)
	}
	wantJoinOutput := outputBinding(
		"gfm-2802cd7f-join_0-out",
		1,
		streamBinding("gfm-2802cd7f-join_0-out_0", "gfm-2802cd7f-join_0-out.0"),
	)
	if !reflect.DeepEqual(joinOutput, wantJoinOutput) {
		t.Fatalf("joinOutput = %#v, want %#v", joinOutput, wantJoinOutput)
	}

	sinkInput, err := graph.GetInput("sink_0")
	if err != nil {
		t.Fatalf("GetInput(sink_0) returned error: %v", err)
	}
	wantSinkInput := inputBinding(
		"gfm-2802cd7f-join_0-out",
		streamBinding("gfm-2802cd7f-join_0-out_0", "gfm-2802cd7f-join_0-out.0"),
	)
	if !reflect.DeepEqual(sinkInput, wantSinkInput) {
		t.Fatalf("sinkInput = %#v, want %#v", sinkInput, wantSinkInput)
	}
}

// Topology:
//
//	┌───────────────┐         ┌────────────┐         ┌───────────┐
//	│ ingestor_0 x2 ├── in ──►│ dedup_0 x2 ├── in ──►│ sink_0 x2 │
//	└───────────────┘         └────────────┘         └───────────┘
func TestGraphDedupOutputNamingTwoTwo(t *testing.T) {
	t.Parallel()

	graph, err := New(Config{
		PipelineID: "pipe-1",
		Nodes: []NodeConfig{
			{ID: "ingestor_0", Type: NodeTypeIngestor, Replicas: 2},
			{ID: "dedup_0", Type: NodeTypeDedup, Replicas: 2},
			{ID: "sink_0", Type: NodeTypeSink, Replicas: 2},
		},
		Edges: []EdgeConfig{
			{ID: "e1", SourceID: "ingestor_0", TargetID: "dedup_0", TargetInputType: InputTypeIn},
			{ID: "e2", SourceID: "dedup_0", TargetID: "sink_0", TargetInputType: InputTypeIn},
		},
	})
	if err != nil {
		t.Fatalf("New returned error: %v", err)
	}

	output, err := graph.GetOutput("dedup_0")
	if err != nil {
		t.Fatalf("GetOutput returned error: %v", err)
	}

	wantOutput := outputBinding(
		"gfm-1528386a-dedup_0-out",
		2,
		streamBinding("gfm-1528386a-dedup_0-out_0", "gfm-1528386a-dedup_0-out.0"),
		streamBinding("gfm-1528386a-dedup_0-out_1", "gfm-1528386a-dedup_0-out.1"),
	)
	if !reflect.DeepEqual(output, wantOutput) {
		t.Fatalf("output = %#v, want %#v", output, wantOutput)
	}
}

// Topology:
//
//	┌───────────────┐         ┌────────────┐         ┌───────────┐
//	│ ingestor_0 x3 ├── in ──►│ dedup_0 x2 ├── in ──►│ sink_0 x1 │
//	└───────────────┘         └────────────┘         └───────────┘
func TestGraphIngestorDedupSinkThreeTwoOne(t *testing.T) {
	t.Parallel()

	graph, err := New(
		Config{
			PipelineID: "pipe-1",
			Nodes: []NodeConfig{
				{
					ID:       "ingestor_0",
					Type:     NodeTypeIngestor,
					Replicas: 3,
				},
				{
					ID:       "dedup_0",
					Type:     NodeTypeDedup,
					Replicas: 2,
				},
				{
					ID:       "sink_0",
					Type:     NodeTypeSink,
					Replicas: 1,
				},
			},
			Edges: []EdgeConfig{
				{
					ID:              "e1",
					SourceID:        "ingestor_0",
					TargetID:        "dedup_0",
					TargetInputType: InputTypeIn,
				},
				{
					ID:              "e2",
					SourceID:        "dedup_0",
					TargetID:        "sink_0",
					TargetInputType: InputTypeIn,
				},
			},
		})
	if err != nil {
		t.Fatalf("New returned error: %v", err)
	}

	ingestorOutput, err := graph.GetOutput("ingestor_0")
	if err != nil {
		t.Fatalf("GetOutput(ingestor_0) returned error: %v", err)
	}
	wantIngestorOutput := outputBinding(
		"gfm-1528386a-ingestor_0-out",
		3,
		streamBinding(
			"gfm-1528386a-ingestor_0-out_0",
			"gfm-1528386a-ingestor_0-out.0",
			"gfm-1528386a-ingestor_0-out.2",
		),
		streamBinding("gfm-1528386a-ingestor_0-out_1", "gfm-1528386a-ingestor_0-out.1"),
	)
	if !reflect.DeepEqual(ingestorOutput, wantIngestorOutput) {
		t.Fatalf("ingestorOutput = %#v, want %#v", ingestorOutput, wantIngestorOutput)
	}

	dedupInput, err := graph.GetInput("dedup_0")
	if err != nil {
		t.Fatalf("GetInput(dedup_0) returned error: %v", err)
	}
	wantDedupInput := inputBinding(
		"gfm-1528386a-ingestor_0-out",
		streamBinding(
			"gfm-1528386a-ingestor_0-out_0",
			"gfm-1528386a-ingestor_0-out.0",
			"gfm-1528386a-ingestor_0-out.2",
		),
		streamBinding("gfm-1528386a-ingestor_0-out_1", "gfm-1528386a-ingestor_0-out.1"),
	)
	if !reflect.DeepEqual(dedupInput, wantDedupInput) {
		t.Fatalf("dedupInput = %#v, want %#v", dedupInput, wantDedupInput)
	}

	dedupOutput, err := graph.GetOutput("dedup_0")
	if err != nil {
		t.Fatalf("GetOutput(dedup_0) returned error: %v", err)
	}
	wantDedupOutput := outputBinding(
		"gfm-1528386a-dedup_0-out",
		2,
		streamBinding(
			"gfm-1528386a-dedup_0-out_0",
			"gfm-1528386a-dedup_0-out.0",
			"gfm-1528386a-dedup_0-out.1",
		),
	)
	if !reflect.DeepEqual(dedupOutput, wantDedupOutput) {
		t.Fatalf("dedupOutput = %#v, want %#v", dedupOutput, wantDedupOutput)
	}

	sinkInput, err := graph.GetInput("sink_0")
	if err != nil {
		t.Fatalf("GetInput(sink_0) returned error: %v", err)
	}
	wantSinkInput := inputBinding(
		"gfm-1528386a-dedup_0-out",
		streamBinding(
			"gfm-1528386a-dedup_0-out_0",
			"gfm-1528386a-dedup_0-out.0",
			"gfm-1528386a-dedup_0-out.1",
		),
	)
	if !reflect.DeepEqual(sinkInput, wantSinkInput) {
		t.Fatalf("sinkInput = %#v, want %#v", sinkInput, wantSinkInput)
	}
}

// Topology:
//
//	┌───────────────┐         ┌────────────┐
//	│ ingestor_0 x2 ├── in ──►│ dedup_0 x2 ├──── left  ────┐
//	└───────────────┘         └────────────┘               │
//	                                                    ┌───▼──────┐         ┌───────────┐
//	                                                    │ join_0 x1├── in ──►│ sink_0 x1 │
//	                                                    └───▲──────┘         └───────────┘
//	┌───────────────┐         ┌────────────┐               │
//	│ ingestor_1 x3 ├── in ──►│ dedup_1 x3 ├──── right  ───┘
//	└───────────────┘         └────────────┘
func TestGraphTwoIngestorsTwoDedupsJoinSink(t *testing.T) {
	t.Parallel()

	graph, err := New(Config{
		PipelineID: "pipe-join",
		Nodes: []NodeConfig{
			{ID: "ingestor_0", Type: NodeTypeIngestor, Replicas: 2},
			{ID: "dedup_0", Type: NodeTypeDedup, Replicas: 2},
			{ID: "ingestor_1", Type: NodeTypeIngestor, Replicas: 3},
			{ID: "dedup_1", Type: NodeTypeDedup, Replicas: 3},
			{ID: "join_0", Type: NodeTypeJoin, Replicas: 1},
			{ID: "sink_0", Type: NodeTypeSink, Replicas: 1},
		},
		Edges: []EdgeConfig{
			{ID: "e1", SourceID: "ingestor_0", TargetID: "dedup_0", TargetInputType: InputTypeIn},
			{ID: "e2", SourceID: "dedup_0", TargetID: "join_0", TargetInputType: InputTypeLeft},
			{ID: "e3", SourceID: "ingestor_1", TargetID: "dedup_1", TargetInputType: InputTypeIn},
			{ID: "e4", SourceID: "dedup_1", TargetID: "join_0", TargetInputType: InputTypeRight},
			{ID: "e5", SourceID: "join_0", TargetID: "sink_0", TargetInputType: InputTypeIn},
		},
	})
	if err != nil {
		t.Fatalf("New returned error: %v", err)
	}

	ingestor0Output, err := graph.GetOutput("ingestor_0")
	if err != nil {
		t.Fatalf("GetOutput(ingestor_0) returned error: %v", err)
	}
	wantIngestor0Output := outputBinding(
		"gfm-2802cd7f-ingestor_0-out",
		2,
		streamBinding("gfm-2802cd7f-ingestor_0-out_0", "gfm-2802cd7f-ingestor_0-out.0"),
		streamBinding("gfm-2802cd7f-ingestor_0-out_1", "gfm-2802cd7f-ingestor_0-out.1"),
	)
	if !reflect.DeepEqual(ingestor0Output, wantIngestor0Output) {
		t.Fatalf("ingestor0Output = %#v, want %#v", ingestor0Output, wantIngestor0Output)
	}

	dedup0Input, err := graph.GetInput("dedup_0")
	if err != nil {
		t.Fatalf("GetInput(dedup_0) returned error: %v", err)
	}
	wantDedup0Input := inputBinding(wantIngestor0Output.StreamPrefix, wantIngestor0Output.Streams...)
	if !reflect.DeepEqual(dedup0Input, wantDedup0Input) {
		t.Fatalf("dedup0Input = %#v, want %#v", dedup0Input, wantDedup0Input)
	}

	dedup0Output, err := graph.GetOutput("dedup_0")
	if err != nil {
		t.Fatalf("GetOutput(dedup_0) returned error: %v", err)
	}
	wantDedup0Output := outputBinding(
		"gfm-2802cd7f-dedup_0-out",
		2,
		streamBinding(
			"gfm-2802cd7f-dedup_0-out_0",
			"gfm-2802cd7f-dedup_0-out.0",
			"gfm-2802cd7f-dedup_0-out.1",
		),
	)
	if !reflect.DeepEqual(dedup0Output, wantDedup0Output) {
		t.Fatalf("dedup0Output = %#v, want %#v", dedup0Output, wantDedup0Output)
	}

	ingestor1Output, err := graph.GetOutput("ingestor_1")
	if err != nil {
		t.Fatalf("GetOutput(ingestor_1) returned error: %v", err)
	}
	wantIngestor1Output := outputBinding(
		"gfm-2802cd7f-ingestor_1-out",
		3,
		streamBinding("gfm-2802cd7f-ingestor_1-out_0", "gfm-2802cd7f-ingestor_1-out.0"),
		streamBinding("gfm-2802cd7f-ingestor_1-out_1", "gfm-2802cd7f-ingestor_1-out.1"),
		streamBinding("gfm-2802cd7f-ingestor_1-out_2", "gfm-2802cd7f-ingestor_1-out.2"),
	)
	if !reflect.DeepEqual(ingestor1Output, wantIngestor1Output) {
		t.Fatalf("ingestor1Output = %#v, want %#v", ingestor1Output, wantIngestor1Output)
	}

	dedup1Input, err := graph.GetInput("dedup_1")
	if err != nil {
		t.Fatalf("GetInput(dedup_1) returned error: %v", err)
	}
	wantDedup1Input := inputBinding(wantIngestor1Output.StreamPrefix, wantIngestor1Output.Streams...)
	if !reflect.DeepEqual(dedup1Input, wantDedup1Input) {
		t.Fatalf("dedup1Input = %#v, want %#v", dedup1Input, wantDedup1Input)
	}

	dedup1Output, err := graph.GetOutput("dedup_1")
	if err != nil {
		t.Fatalf("GetOutput(dedup_1) returned error: %v", err)
	}
	wantDedup1Output := outputBinding(
		"gfm-2802cd7f-dedup_1-out",
		3,
		streamBinding(
			"gfm-2802cd7f-dedup_1-out_0",
			"gfm-2802cd7f-dedup_1-out.0",
			"gfm-2802cd7f-dedup_1-out.1",
			"gfm-2802cd7f-dedup_1-out.2",
		),
	)
	if !reflect.DeepEqual(dedup1Output, wantDedup1Output) {
		t.Fatalf("dedup1Output = %#v, want %#v", dedup1Output, wantDedup1Output)
	}

	joinInput, err := graph.GetJoinInput("join_0")
	if err != nil {
		t.Fatalf("GetJoinInput(join_0) returned error: %v", err)
	}
	wantJoinInput := JoinInputBinding{
		Left:  inputBinding(wantDedup0Output.StreamPrefix, wantDedup0Output.Streams...),
		Right: inputBinding(wantDedup1Output.StreamPrefix, wantDedup1Output.Streams...),
	}
	if !reflect.DeepEqual(joinInput, wantJoinInput) {
		t.Fatalf("joinInput = %#v, want %#v", joinInput, wantJoinInput)
	}

	joinOutput, err := graph.GetOutput("join_0")
	if err != nil {
		t.Fatalf("GetOutput(join_0) returned error: %v", err)
	}
	wantJoinOutput := outputBinding(
		"gfm-2802cd7f-join_0-out",
		1,
		streamBinding("gfm-2802cd7f-join_0-out_0", "gfm-2802cd7f-join_0-out.0"),
	)
	if !reflect.DeepEqual(joinOutput, wantJoinOutput) {
		t.Fatalf("joinOutput = %#v, want %#v", joinOutput, wantJoinOutput)
	}

	sinkInput, err := graph.GetInput("sink_0")
	if err != nil {
		t.Fatalf("GetInput(sink_0) returned error: %v", err)
	}
	wantSinkInput := inputBinding(wantJoinOutput.StreamPrefix, wantJoinOutput.Streams...)
	if !reflect.DeepEqual(sinkInput, wantSinkInput) {
		t.Fatalf("sinkInput = %#v, want %#v", sinkInput, wantSinkInput)
	}
}

// Topology:
//
//	┌──────────────┐         ┌───────────┐
//	│ otlp_src x1  ├── in ──►│ sink_0 x1 │
//	└──────────────┘         └───────────┘
func TestGraphOTLPSourceSink(t *testing.T) {
	t.Parallel()

	graph, err := New(Config{
		PipelineID: "pipe-1",
		Nodes: []NodeConfig{
			{ID: "otlp", Type: NodeTypeOTLPSource, Replicas: 1},
			{ID: "sink_0", Type: NodeTypeSink, Replicas: 1},
		},
		Edges: []EdgeConfig{
			{ID: "e1", SourceID: "otlp", TargetID: "sink_0", TargetInputType: InputTypeIn},
		},
	})
	if err != nil {
		t.Fatalf("New returned error: %v", err)
	}

	otlpOutput, err := graph.GetOutput("otlp")
	if err != nil {
		t.Fatalf("GetOutput(otlp) returned error: %v", err)
	}
	wantOTLPOutput := outputBinding(
		"gfm-1528386a-otlp-out",
		1,
		streamBinding("gfm-1528386a-otlp-out_0", "gfm-1528386a-otlp-out.0"),
	)
	if !reflect.DeepEqual(otlpOutput, wantOTLPOutput) {
		t.Fatalf("otlpOutput = %#v, want %#v", otlpOutput, wantOTLPOutput)
	}

	sinkInput, err := graph.GetInput("sink_0")
	if err != nil {
		t.Fatalf("GetInput(sink_0) returned error: %v", err)
	}
	wantSinkInput := inputBinding(wantOTLPOutput.StreamPrefix, wantOTLPOutput.Streams...)
	if !reflect.DeepEqual(sinkInput, wantSinkInput) {
		t.Fatalf("sinkInput = %#v, want %#v", sinkInput, wantSinkInput)
	}
}

// Topology:
//
//	┌──────────────┐         ┌────────────┐         ┌───────────┐
//	│ otlp_src x1  ├── in ──►│ dedup_0 x2 ├── in ──►│ sink_0 x1 │
//	└──────────────┘         └────────────┘         └───────────┘
func TestGraphOTLPSourceDedupSink(t *testing.T) {
	t.Parallel()

	graph, err := New(Config{
		PipelineID: "pipe-1",
		Nodes: []NodeConfig{
			{ID: "otlp", Type: NodeTypeOTLPSource, Replicas: 1},
			{ID: "dedup_0", Type: NodeTypeDedup, Replicas: 2},
			{ID: "sink_0", Type: NodeTypeSink, Replicas: 1},
		},
		Edges: []EdgeConfig{
			{ID: "e1", SourceID: "otlp", TargetID: "dedup_0", TargetInputType: InputTypeIn},
			{ID: "e2", SourceID: "dedup_0", TargetID: "sink_0", TargetInputType: InputTypeIn},
		},
	})
	if err != nil {
		t.Fatalf("New returned error: %v", err)
	}

	otlpOutput, err := graph.GetOutput("otlp")
	if err != nil {
		t.Fatalf("GetOutput(otlp) returned error: %v", err)
	}
	// otlp(1) → dedup(2): new algorithm creates 2 streams (one per downstream consumer)
	wantOTLPOutput := outputBinding(
		"gfm-1528386a-otlp-out",
		2,
		streamBinding("gfm-1528386a-otlp-out_0", "gfm-1528386a-otlp-out.0"),
		streamBinding("gfm-1528386a-otlp-out_1", "gfm-1528386a-otlp-out.1"),
	)
	if !reflect.DeepEqual(otlpOutput, wantOTLPOutput) {
		t.Fatalf("otlpOutput = %#v, want %#v", otlpOutput, wantOTLPOutput)
	}

	dedupInput, err := graph.GetInput("dedup_0")
	if err != nil {
		t.Fatalf("GetInput(dedup_0) returned error: %v", err)
	}
	wantDedupInput := inputBinding(wantOTLPOutput.StreamPrefix, wantOTLPOutput.Streams...)
	if !reflect.DeepEqual(dedupInput, wantDedupInput) {
		t.Fatalf("dedupInput = %#v, want %#v", dedupInput, wantDedupInput)
	}

	dedupOutput, err := graph.GetOutput("dedup_0")
	if err != nil {
		t.Fatalf("GetOutput(dedup_0) returned error: %v", err)
	}
	wantDedupOutput := outputBinding(
		"gfm-1528386a-dedup_0-out",
		2,
		streamBinding(
			"gfm-1528386a-dedup_0-out_0",
			"gfm-1528386a-dedup_0-out.0",
			"gfm-1528386a-dedup_0-out.1",
		),
	)
	if !reflect.DeepEqual(dedupOutput, wantDedupOutput) {
		t.Fatalf("dedupOutput = %#v, want %#v", dedupOutput, wantDedupOutput)
	}

	sinkInput, err := graph.GetInput("sink_0")
	if err != nil {
		t.Fatalf("GetInput(sink_0) returned error: %v", err)
	}
	wantSinkInput := inputBinding(wantDedupOutput.StreamPrefix, wantDedupOutput.Streams...)
	if !reflect.DeepEqual(sinkInput, wantSinkInput) {
		t.Fatalf("sinkInput = %#v, want %#v", sinkInput, wantSinkInput)
	}
}

// Topology:
//
//	┌───────────────┐         ┌───────────┐
//	│ ingestor_0 x1 ├── in ──►│ sink_0 x2 │
//	└───────────────┘         └───────────┘
//
// When upstream has fewer replicas than downstream, the new algorithm creates
// streamCount streams and totalSubjects=max(source,stream) subjects.
// The single ingestor pod publishes to subjects 0 and 1 round-robin.
func TestGraphIngestorSinkOneTwo(t *testing.T) {
	t.Parallel()

	graph, err := New(Config{
		PipelineID: "pipe-1",
		Nodes: []NodeConfig{
			{ID: "ingestor_0", Type: NodeTypeIngestor, Replicas: 1},
			{ID: "sink_0", Type: NodeTypeSink, Replicas: 2},
		},
		Edges: []EdgeConfig{
			{ID: "e1", SourceID: "ingestor_0", TargetID: "sink_0", TargetInputType: InputTypeIn},
		},
	})
	if err != nil {
		t.Fatalf("New returned error: %v", err)
	}

	output, err := graph.GetOutput("ingestor_0")
	if err != nil {
		t.Fatalf("GetOutput returned error: %v", err)
	}

	// 2 streams created (one per sink replica), 2 subjects total (max(1,2)=2).
	// Ingestor pod 0 is responsible for both subjects (round-robin publish).
	wantOutput := outputBinding(
		"gfm-1528386a-ingestor_0-out",
		2,
		streamBinding("gfm-1528386a-ingestor_0-out_0", "gfm-1528386a-ingestor_0-out.0"),
		streamBinding("gfm-1528386a-ingestor_0-out_1", "gfm-1528386a-ingestor_0-out.1"),
	)
	if !reflect.DeepEqual(output, wantOutput) {
		t.Fatalf("output = %#v, want %#v", output, wantOutput)
	}

	sinkInput, err := graph.GetInput("sink_0")
	if err != nil {
		t.Fatalf("GetInput(sink_0) returned error: %v", err)
	}
	wantSinkInput := inputBinding(
		"gfm-1528386a-ingestor_0-out",
		streamBinding("gfm-1528386a-ingestor_0-out_0", "gfm-1528386a-ingestor_0-out.0"),
		streamBinding("gfm-1528386a-ingestor_0-out_1", "gfm-1528386a-ingestor_0-out.1"),
	)
	if !reflect.DeepEqual(sinkInput, wantSinkInput) {
		t.Fatalf("sinkInput = %#v, want %#v", sinkInput, wantSinkInput)
	}
}

// Topology:
//
//	┌───────────────┐         ┌───────────┐
//	│ ingestor_0 x2 ├── in ──►│ sink_0 x5 │
//	└───────────────┘         └───────────┘
//
// 5 streams created, 5 subjects total (max(2,5)=5).
// Pod 0 handles subjects 0, 2, 4 (even indices); pod 1 handles 1, 3 (odd).
func TestGraphIngestorSinkTwoFive(t *testing.T) {
	t.Parallel()

	graph, err := New(Config{
		PipelineID: "pipe-1",
		Nodes: []NodeConfig{
			{ID: "ingestor_0", Type: NodeTypeIngestor, Replicas: 2},
			{ID: "sink_0", Type: NodeTypeSink, Replicas: 5},
		},
		Edges: []EdgeConfig{
			{ID: "e1", SourceID: "ingestor_0", TargetID: "sink_0", TargetInputType: InputTypeIn},
		},
	})
	if err != nil {
		t.Fatalf("New returned error: %v", err)
	}

	output, err := graph.GetOutput("ingestor_0")
	if err != nil {
		t.Fatalf("GetOutput returned error: %v", err)
	}

	// 5 streams, 5 subjects (max(2,5)=5); each stream gets exactly one subject.
	// Pod 0 publishes to subjects 0,2,4 (s%2==0); pod 1 to subjects 1,3 (s%2==1).
	wantOutput := outputBinding(
		"gfm-1528386a-ingestor_0-out",
		5,
		streamBinding("gfm-1528386a-ingestor_0-out_0", "gfm-1528386a-ingestor_0-out.0"),
		streamBinding("gfm-1528386a-ingestor_0-out_1", "gfm-1528386a-ingestor_0-out.1"),
		streamBinding("gfm-1528386a-ingestor_0-out_2", "gfm-1528386a-ingestor_0-out.2"),
		streamBinding("gfm-1528386a-ingestor_0-out_3", "gfm-1528386a-ingestor_0-out.3"),
		streamBinding("gfm-1528386a-ingestor_0-out_4", "gfm-1528386a-ingestor_0-out.4"),
	)
	if !reflect.DeepEqual(output, wantOutput) {
		t.Fatalf("output = %#v, want %#v", output, wantOutput)
	}
}

func TestGraphGetOutputIsDeterministic(t *testing.T) {
	t.Parallel()

	config := Config{
		PipelineID: "pipe-1",
		Nodes: []NodeConfig{
			{ID: "ingestor_0", Type: NodeTypeIngestor, Replicas: 3},
			{ID: "sink_0", Type: NodeTypeSink, Replicas: 2},
		},
		Edges: []EdgeConfig{
			{ID: "e1", SourceID: "ingestor_0", TargetID: "sink_0", TargetInputType: InputTypeIn},
		},
	}

	firstGraph, err := New(config)
	if err != nil {
		t.Fatalf("New returned error: %v", err)
	}

	first, err := firstGraph.GetOutput("ingestor_0")
	if err != nil {
		t.Fatalf("first GetOutput returned error: %v", err)
	}

	secondGraph, err := New(config)
	if err != nil {
		t.Fatalf("second New returned error: %v", err)
	}

	second, err := secondGraph.GetOutput("ingestor_0")
	if err != nil {
		t.Fatalf("second GetOutput returned error: %v", err)
	}
	if !reflect.DeepEqual(first, second) {
		t.Fatalf("GetOutput returned different results across calls: first=%#v second=%#v", first, second)
	}
}

func TestNewRejectsCycle(t *testing.T) {
	t.Parallel()

	_, err := New(Config{
		PipelineID: "pipe-cycle",
		Nodes: []NodeConfig{
			{ID: "dedup_0", Type: NodeTypeDedup, Replicas: 1},
			{ID: "dedup_1", Type: NodeTypeDedup, Replicas: 1},
		},
		Edges: []EdgeConfig{
			{ID: "e1", SourceID: "dedup_0", TargetID: "dedup_1", TargetInputType: InputTypeIn},
			{ID: "e2", SourceID: "dedup_1", TargetID: "dedup_0", TargetInputType: InputTypeIn},
		},
	})
	if err == nil {
		t.Fatal("New returned nil error, want cycle validation error")
	}
	if got, want := err.Error(), "graph contains a cycle"; got != want {
		t.Fatalf("error = %q, want %q", got, want)
	}
}

func TestResolveOutputRejectsMissingNodes(t *testing.T) {
	t.Parallel()

	graph, err := New(Config{
		PipelineID: "pipe-1",
		Nodes: []NodeConfig{
			{ID: "ingestor_0", Type: NodeTypeIngestor, Replicas: 1},
			{ID: "sink_0", Type: NodeTypeSink, Replicas: 1},
		},
		Edges: []EdgeConfig{
			{ID: "e1", SourceID: "ingestor_0", TargetID: "sink_0", TargetInputType: InputTypeIn},
		},
	})
	if err != nil {
		t.Fatalf("New returned error: %v", err)
	}

	_, err = graph.resolveOutput(EdgeConfig{ID: "broken", SourceID: "missing", TargetID: "sink_0", TargetInputType: InputTypeIn})
	if err == nil {
		t.Fatal("resolveOutput returned nil error for missing source node")
	}
	if got, want := err.Error(), `edge "broken" source node "missing" not found`; got != want {
		t.Fatalf("error = %q, want %q", got, want)
	}

	_, err = graph.resolveOutput(EdgeConfig{ID: "broken", SourceID: "ingestor_0", TargetID: "missing", TargetInputType: InputTypeIn})
	if err == nil {
		t.Fatal("resolveOutput returned nil error for missing target node")
	}
	if got, want := err.Error(), `edge "broken" target node "missing" not found`; got != want {
		t.Fatalf("error = %q, want %q", got, want)
	}
}

func TestGetInputRejectsJoinNode(t *testing.T) {
	t.Parallel()

	graph, err := New(Config{
		PipelineID: "pipe-join",
		Nodes: []NodeConfig{
			{ID: "ingestor_0", Type: NodeTypeIngestor, Replicas: 1},
			{ID: "ingestor_1", Type: NodeTypeIngestor, Replicas: 1},
			{ID: "join_0", Type: NodeTypeJoin, Replicas: 1},
			{ID: "sink_0", Type: NodeTypeSink, Replicas: 1},
		},
		Edges: []EdgeConfig{
			{ID: "e1", SourceID: "ingestor_0", TargetID: "join_0", TargetInputType: InputTypeLeft},
			{ID: "e2", SourceID: "ingestor_1", TargetID: "join_0", TargetInputType: InputTypeRight},
			{ID: "e3", SourceID: "join_0", TargetID: "sink_0", TargetInputType: InputTypeIn},
		},
	})
	if err != nil {
		t.Fatalf("New returned error: %v", err)
	}

	_, err = graph.GetInput("join_0")
	if err == nil {
		t.Fatal("GetInput returned nil error for join node")
	}
	if got, want := err.Error(), `join node "join_0" requires GetJoinInput`; got != want {
		t.Fatalf("error = %q, want %q", got, want)
	}
}

func TestGetJoinInputRejectsNonJoinNode(t *testing.T) {
	t.Parallel()

	graph, err := New(Config{
		PipelineID: "pipe-1",
		Nodes: []NodeConfig{
			{ID: "ingestor_0", Type: NodeTypeIngestor, Replicas: 1},
			{ID: "sink_0", Type: NodeTypeSink, Replicas: 1},
		},
		Edges: []EdgeConfig{
			{ID: "e1", SourceID: "ingestor_0", TargetID: "sink_0", TargetInputType: InputTypeIn},
		},
	})
	if err != nil {
		t.Fatalf("New returned error: %v", err)
	}

	_, err = graph.GetJoinInput("sink_0")
	if err == nil {
		t.Fatal("GetJoinInput returned nil error for non-join node")
	}
	if got, want := err.Error(), `node "sink_0" is not a join node`; got != want {
		t.Fatalf("error = %q, want %q", got, want)
	}
}
