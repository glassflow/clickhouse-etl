package models

import "fmt"

type PipelineConfigError struct {
	msg string
}

func (e PipelineConfigError) Error() string {
	return "invalid pipeline config: " + e.msg
}

type Pipeline struct {
	PipelineID string
	Components []Component
}

type Component interface {
	ID() string
	GetInputs() []Component
	GetOutputs() []Component

	SetInputs([]Component)
	SetOutputs([]Component)

	Validate() error
}

type ComponentKind string

const (
	KafkaSource    ComponentKind = "kafka"
	ClickhouseSink ComponentKind = "clickhouse"
	Join           ComponentKind = "join"
)

func NewPipeline(id string, outputsMap map[Component][]Component) (*Pipeline, error) {
	for c, outputs := range outputsMap {
		for _, o := range outputs {
			o.SetInputs(append(o.GetInputs(), c))
			c.SetOutputs(append(c.GetOutputs(), o))
		}
	}

	orderedComponents, err := validateDAGKahn(outputsMap)
	if err != nil {
		return nil, PipelineConfigError{msg: err.Error()}
	}

	var (
		numSources int
		numSinks   int
	)

	for _, c := range orderedComponents {
		if len(c.GetInputs()) == 0 {
			numSources++
		}
		if len(c.GetOutputs()) == 0 {
			numSinks++
		}
	}

	if numSources > 2 || numSinks > 1 {
		return nil, PipelineConfigError{msg: "pipeline can have a maximum of 2 sources and 1 sink"}
	}

	// validate each component w.r.t inputs and outputs
	for _, c := range orderedComponents {
		err := c.Validate()
		if err != nil {
			return nil, PipelineConfigError{msg: err.Error()}
		}
	}

	return &Pipeline{
		PipelineID: id,
		Components: orderedComponents,
	}, nil
}

// Use Kahn's DAG algo
// https://en.wikipedia.org/wiki/Topological_sorting
func validateDAGKahn(componentsMap map[Component][]Component) ([]Component, error) {
	indegrees := make(map[string]int)

	for c := range componentsMap {
		if componentsMap[c] != nil {
			for _, v := range componentsMap[c] {
				indegrees[v.ID()]++
			}
		}
	}

	var queue []Component
	for k := range componentsMap {
		if _, ok := indegrees[k.ID()]; !ok {
			queue = append(queue, k)
		}
	}

	var ordered []Component

	for len(queue) > 0 {
		popped := queue[len(queue)-1]

		queue = queue[:len(queue)-1]

		ordered = append(ordered, popped)
		for _, c := range popped.GetOutputs() {
			indegrees[c.ID()]--
			if indegrees[c.ID()] == 0 {
				queue = append(queue, c)
			}
		}
	}

	for _, i := range indegrees {
		if i > 0 {
			return nil, fmt.Errorf("not a DAG")
		}
	}

	return ordered, nil
}
