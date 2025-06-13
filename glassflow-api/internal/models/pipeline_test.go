package models

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
)

type TestComponentValid struct {
	Inputs  []Component
	Outputs []Component
	id      string
}

func (s *TestComponentValid) GetOutputs() []Component {
	return s.Outputs
}

func (s *TestComponentValid) SetOutputs(o []Component) {
	s.Outputs = o
}

func (s *TestComponentValid) GetInputs() []Component {
	return s.Inputs
}

func (s *TestComponentValid) SetInputs(i []Component) {
	s.Inputs = i
}

func (s *TestComponentValid) SetID(id string) {
	s.id = id
}

func (s *TestComponentValid) ID() string {
	return s.id
}

func (s *TestComponentValid) Validate() error {
	return nil
}

type TestComponentInvalid struct {
	Inputs  []Component
	Outputs []Component
	id      string
}

func (s *TestComponentInvalid) GetOutputs() []Component {
	return s.Outputs
}

func (s *TestComponentInvalid) SetOutputs(o []Component) {
	s.Outputs = o
}

func (s *TestComponentInvalid) GetInputs() []Component {
	return s.Inputs
}

func (s *TestComponentInvalid) SetInputs(i []Component) {
	s.Inputs = i
}

func (s *TestComponentInvalid) SetID(id string) {
	s.id = id
}

func (s *TestComponentInvalid) ID() string {
	return s.id
}

func (s *TestComponentInvalid) Validate() error {
	return fmt.Errorf("invalid condition for interim component")
}

func TestPipelineIsDAGSuccess(t *testing.T) {
	source := &TestComponentValid{}
	source.SetID("source-1")

	sink := &TestComponentValid{}
	sink.SetID("sink-1")

	interim := &TestComponentValid{}
	interim.SetID("interim-1")

	outputsMap := make(map[Component][]Component)

	outputsMap[source] = []Component{interim}
	outputsMap[interim] = []Component{sink}
	outputsMap[sink] = []Component{}

	p, err := NewPipeline("test", outputsMap)
	require.NoError(t, err)

	require.Len(t, p.Components, 3)

	for i, id := range []string{source.ID(), interim.ID(), sink.ID()} {
		require.Equal(t, id, p.Components[i].ID())
	}
}

func TestPipelineIsDAGWithOnlySourceAndSinkSuccess(t *testing.T) {
	source := &TestComponentValid{}
	source.SetID("source-1")

	sink := &TestComponentValid{}
	sink.SetID("sink-1")

	outputsMap := make(map[Component][]Component)

	outputsMap[source] = []Component{sink}

	p, err := NewPipeline("test", outputsMap)
	require.NoError(t, err)

	require.Len(t, p.Components, 2)

	for i, id := range []string{source.ID(), sink.ID()} {
		require.Equal(t, id, p.Components[i].ID())
	}
}

func TestPipelineIsNotDAGFail(t *testing.T) {
	source := &TestComponentValid{}
	source.SetID("source-1")

	sink := &TestComponentValid{}
	sink.SetID("sink-1")

	interim := &TestComponentValid{}
	interim.SetID("interim-1")

	outputsMap := make(map[Component][]Component)

	outputsMap[source] = []Component{interim}
	outputsMap[interim] = []Component{sink}
	outputsMap[sink] = []Component{source}

	_, err := NewPipeline("test", outputsMap)
	require.EqualError(t, err, "invalid pipeline config: not a DAG")
}

func TestPipelineDAGTwoSourcesSuccess(t *testing.T) {
	source := &TestComponentValid{}
	source.SetID("source-1")

	source2 := &TestComponentValid{}
	source2.SetID("source-2")

	sink := &TestComponentValid{}
	sink.SetID("sink-1")

	interim := &TestComponentValid{}
	interim.SetID("interim-1")

	outputsMap := make(map[Component][]Component)

	outputsMap[source] = []Component{interim}
	outputsMap[source2] = []Component{interim}
	outputsMap[interim] = []Component{sink}
	outputsMap[sink] = []Component{}

	p, err := NewPipeline("test", outputsMap)
	require.NoError(t, err)

	require.Len(t, p.Components, 4)

	for _, c := range p.Components {
		require.Contains(t, []string{source.ID(), source2.ID(), interim.ID(), sink.ID()}, c.ID())
	}
}

func TestPipelineDAGTwoSinksFail(t *testing.T) {
	source := &TestComponentValid{}
	source.SetID("source-1")

	sink := &TestComponentValid{}
	sink.SetID("sink-1")

	sink2 := &TestComponentValid{}
	sink2.SetID("source-2")

	interim := &TestComponentValid{}
	interim.SetID("interim-1")

	outputsMap := make(map[Component][]Component)

	outputsMap[source] = []Component{interim}
	outputsMap[interim] = []Component{sink, sink2}
	outputsMap[sink] = []Component{}
	outputsMap[sink2] = []Component{}

	_, err := NewPipeline("test", outputsMap)
	require.EqualError(t, err, "invalid pipeline config: pipeline can have a maximum of 2 sources and 1 sink")
}

func TestPipelineDAGInvalidInterimComponent(t *testing.T) {
	source := &TestComponentValid{}
	source.SetID("source-1")

	sink := &TestComponentValid{}
	sink.SetID("sink-1")

	interim := &TestComponentInvalid{}
	interim.SetID("interim-1")

	outputsMap := make(map[Component][]Component)

	outputsMap[source] = []Component{interim}
	outputsMap[interim] = []Component{sink}
	outputsMap[sink] = []Component{}

	_, err := NewPipeline("test", outputsMap)
	require.EqualError(t, err, "invalid pipeline config: invalid condition for interim component")
}
