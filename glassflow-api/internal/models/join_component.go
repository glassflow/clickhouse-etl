package models

import (
	"fmt"
	"slices"
	"strings"
	"time"
)

type JoinComponent struct {
	Kind    string // TODO: check type of join and make const/enum
	Sources []joinSource

	inputs  []Component
	outputs []Component
}

func (j *JoinComponent) Validate() error {
	if len(j.GetInputs()) != 2 {
		return fmt.Errorf("join component must have exactly 2 sources")
	}

	inputIDs := make([]string, 0, len(j.GetInputs()))

	for _, i := range j.GetInputs() {
		inputIDs = append(inputIDs, i.ID())
	}

	for _, j := range j.Sources {
		if !slices.Contains(inputIDs, j.Source) {
			return fmt.Errorf("undefined join source: %s", j.Source)
		}
	}

	return nil
}

func (j *JoinComponent) SetInputs(comps []Component) {
	j.inputs = comps
}

func (j *JoinComponent) SetOutputs(comps []Component) {
	j.outputs = comps
}

func (j *JoinComponent) GetInputs() []Component {
	return j.inputs
}

func (j *JoinComponent) GetOutputs() []Component {
	return j.outputs
}

func (j *JoinComponent) ID() string {
	var s1, s2 string
	for _, s := range j.Sources {
		s1 = s.Source
		s2 = s.Source
	}
	return fmt.Sprintf("join-%s-%s", s1, s2)
}

const (
	SupportedJoinType           = "temporal"
	MaxStreamsSupportedWithJoin = 2
)

func NewJoinComponent(kind string, args []JoinSourceArgs) (zero *JoinComponent, _ error) {
	if kind != strings.ToLower(strings.TrimSpace(SupportedJoinType)) {
		return zero, PipelineConfigError{msg: "invalid join type; only temporal joins are supported"}
	}

	if len(args) != MaxStreamsSupportedWithJoin {
		return zero, PipelineConfigError{msg: "join component must have two distinct sources"}
	}

	joinSources := make([]joinSource, len(args))
	var seenJoinOrder []JoinOrder

	for i, so := range args {
		if len(strings.TrimSpace(so.Source)) == 0 {
			return zero, PipelineConfigError{msg: "join source cannot be empty"}
		}

		jo, err := NewJoinOrder(so.JoinOrder)
		if err != nil {
			return zero, PipelineConfigError{msg: fmt.Sprintf("unsupported value %s for join orientation", so.JoinOrder)}
		}
		if !slices.Contains(seenJoinOrder, jo) {
			seenJoinOrder = append(seenJoinOrder, jo)
		} else {
			return zero, PipelineConfigError{msg: "join sources cannot have same orientations"}
		}

		if len(strings.TrimSpace(so.JoinKey)) == 0 {
			return zero, PipelineConfigError{msg: "join key cannot be empty"}
		}

		joinSources[i] = joinSource{
			Source:    so.Source,
			JoinKey:   so.JoinKey,
			Window:    so.Window,
			JoinOrder: jo,
		}
	}

	//nolint: exhaustruct // don't set private fields
	return &JoinComponent{
		Kind:    kind,
		Sources: joinSources,
	}, nil
}

type JoinSourceArgs struct {
	Source    string
	JoinKey   string
	Window    time.Duration
	JoinOrder string
}

type joinSource struct {
	Source    string
	JoinKey   string
	Window    time.Duration
	JoinOrder JoinOrder
}

type JoinOrder string

const (
	JoinLeft  JoinOrder = "left"
	JoinRight JoinOrder = "right"
)

func (jo JoinOrder) String() string {
	return string(jo)
}

func NewJoinOrder(s string) (zero JoinOrder, _ error) {
	switch s {
	case JoinLeft.String():
		return JoinLeft, nil
	case JoinRight.String():
		return JoinRight, nil
	default:
		return zero, fmt.Errorf("unsupported join order")
	}
}
