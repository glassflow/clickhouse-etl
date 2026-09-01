package pipelinegraph

import (
	"fmt"

	etlv1alpha1 "github.com/glassflow/glassflow-etl-k8s-operator/api/v1alpha1"
)

// Resolve computes the full allocation for a pipeline spec — stream names,
// subjects, replicas, and per-node bindings — and returns it in the
// etlv1alpha1.ResolvedPipeline shape that the operator now reads from
// spec.Resolved (see ETL-1063, ETL-1065).
//
// Used by:
//   - the create / edit / resume pipeline flows (ETL-1064) to populate
//     spec.Resolved before applying the CR to K8s;
//   - the boot-time migration (ETL-1067) to backfill spec.Resolved on legacy
//     CRs that pre-date this work.
//
// Caller must guarantee the spec has been validated; Resolve returns an
// error if the spec produces an inconsistent graph (cycles, missing nodes).
func Resolve(spec etlv1alpha1.PipelineSpec) (etlv1alpha1.ResolvedPipeline, error) {
	cfg, err := ConfigFromPipelineSpec(spec)
	if err != nil {
		return etlv1alpha1.ResolvedPipeline{}, fmt.Errorf("resolve pipeline graph: %w", err)
	}
	graph, err := New(cfg)
	if err != nil {
		return etlv1alpha1.ResolvedPipeline{}, fmt.Errorf("build pipeline graph: %w", err)
	}

	out := etlv1alpha1.ResolvedPipeline{Nodes: make([]etlv1alpha1.ResolvedNode, 0, len(cfg.Nodes))}
	for _, node := range cfg.Nodes {
		rn := etlv1alpha1.ResolvedNode{
			ID:       node.ID,
			Type:     string(node.Type),
			Replicas: int32(node.Replicas), //nolint:gosec // node.Replicas comes from CRD int32, range-safe
		}

		switch node.Type {
		case NodeTypeIngestor, NodeTypeOTLPSource:
			ob, err := graph.GetOutput(node.ID)
			if err != nil {
				return etlv1alpha1.ResolvedPipeline{}, fmt.Errorf("resolve output for %s: %w", node.ID, err)
			}
			rn.Output = convertOutput(ob)

		case NodeTypeDedup:
			ib, err := graph.GetInput(node.ID)
			if err != nil {
				return etlv1alpha1.ResolvedPipeline{}, fmt.Errorf("resolve input for %s: %w", node.ID, err)
			}
			rn.Input = convertInput(ib)
			ob, err := graph.GetOutput(node.ID)
			if err != nil {
				return etlv1alpha1.ResolvedPipeline{}, fmt.Errorf("resolve output for %s: %w", node.ID, err)
			}
			rn.Output = convertOutput(ob)

		case NodeTypeJoin:
			ji, err := graph.GetJoinInput(node.ID)
			if err != nil {
				return etlv1alpha1.ResolvedPipeline{}, fmt.Errorf("resolve join input for %s: %w", node.ID, err)
			}
			rn.JoinInput = &etlv1alpha1.NodeJoinInput{
				Left:  *convertInput(ji.Left),
				Right: *convertInput(ji.Right),
			}
			ob, err := graph.GetOutput(node.ID)
			if err != nil {
				return etlv1alpha1.ResolvedPipeline{}, fmt.Errorf("resolve output for %s: %w", node.ID, err)
			}
			rn.Output = convertOutput(ob)

		case NodeTypeSink:
			ib, err := graph.GetInput(node.ID)
			if err != nil {
				return etlv1alpha1.ResolvedPipeline{}, fmt.Errorf("resolve input for %s: %w", node.ID, err)
			}
			rn.Input = convertInput(ib)
		}

		out.Nodes = append(out.Nodes, rn)
	}

	return out, nil
}

func convertOutput(ob OutputBinding) *etlv1alpha1.NodeOutput {
	return &etlv1alpha1.NodeOutput{
		StreamPrefix:      ob.StreamPrefix,
		SubjectPrefix:     ob.SubjectPrefix,
		Streams:           convertStreams(ob.Streams),
		TotalSubjectCount: int32(ob.TotalSubjectCount), //nolint:gosec // pipeline subject counts fit comfortably in int32
	}
}

func convertInput(ib InputBinding) *etlv1alpha1.NodeInput {
	return &etlv1alpha1.NodeInput{
		StreamPrefix: ib.StreamPrefix,
		Streams:      convertStreams(ib.Streams),
	}
}

func convertStreams(in []StreamBinding) []etlv1alpha1.ResolvedStream {
	out := make([]etlv1alpha1.ResolvedStream, 0, len(in))
	for _, s := range in {
		out = append(out, etlv1alpha1.ResolvedStream{
			Name:     s.Name,
			Subjects: s.Subjects,
		})
	}
	return out
}
