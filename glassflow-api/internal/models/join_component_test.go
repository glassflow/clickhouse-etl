package models

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestNewJoinComponent(t *testing.T) {
	testCases := []struct {
		desc                 string
		joinKind             string
		sourceArgs           []JoinSourceArgs
		expectedErr          error
		expectedComponentNil bool
	}{
		{
			desc:     "valid join component",
			joinKind: "temporal",
			sourceArgs: []JoinSourceArgs{
				{
					Source:    "stream1",
					JoinKey:   "order_id",
					Window:    5 * time.Second,
					JoinOrder: "left",
				},
				{
					Source:    "stream2",
					JoinKey:   "id",
					Window:    5 * time.Second,
					JoinOrder: "right",
				},
			},
			expectedErr:          nil,
			expectedComponentNil: false,
		},
		{
			desc:     "invalid join kind",
			joinKind: "left outer",
			sourceArgs: []JoinSourceArgs{
				{
					Source:    "stream1",
					JoinKey:   "order_id",
					Window:    5 * time.Second,
					JoinOrder: "left",
				},
				{
					Source:    "stream2",
					JoinKey:   "id",
					Window:    5 * time.Second,
					JoinOrder: "right",
				},
			},
			expectedErr:          PipelineConfigError{msg: "invalid join type; only temporal joins are supported"},
			expectedComponentNil: true,
		},
		{
			desc:     "only one source",
			joinKind: "temporal",
			sourceArgs: []JoinSourceArgs{
				{
					Source:    "stream1",
					JoinKey:   "order_id",
					Window:    5 * time.Second,
					JoinOrder: "left",
				},
			},
			expectedErr:          PipelineConfigError{msg: "join component must have two distinct sources"},
			expectedComponentNil: true,
		},
		{
			desc:     "empty source name",
			joinKind: "temporal",
			sourceArgs: []JoinSourceArgs{
				{
					Source:    "",
					JoinKey:   "order_id",
					Window:    5 * time.Second,
					JoinOrder: "left",
				},
				{
					Source:    "stream2",
					JoinKey:   "id",
					Window:    5 * time.Second,
					JoinOrder: "right",
				},
			},
			expectedErr:          PipelineConfigError{msg: "join source cannot be empty"},
			expectedComponentNil: true,
		},
		{
			desc:     "invalid orientation",
			joinKind: "temporal",
			sourceArgs: []JoinSourceArgs{
				{
					Source:    "stream1",
					JoinKey:   "order_id",
					Window:    5 * time.Second,
					JoinOrder: "left",
				},
				{
					Source:    "stream2",
					JoinKey:   "id",
					Window:    5 * time.Second,
					JoinOrder: "invalid",
				},
			},
			expectedErr:          PipelineConfigError{msg: "unsupported value invalid for join orientation"},
			expectedComponentNil: true,
		},
		{
			desc:     "same orientation",
			joinKind: "temporal",
			sourceArgs: []JoinSourceArgs{
				{
					Source:    "stream1",
					JoinKey:   "order_id",
					Window:    5 * time.Second,
					JoinOrder: "left",
				},
				{
					Source:    "stream2",
					JoinKey:   "id",
					Window:    5 * time.Second,
					JoinOrder: "left",
				},
			},
			expectedErr:          PipelineConfigError{msg: "join sources cannot have same orientations"},
			expectedComponentNil: true,
		},
		{
			desc:     "empty join key",
			joinKind: "temporal",
			sourceArgs: []JoinSourceArgs{
				{
					Source:    "stream1",
					JoinKey:   "",
					Window:    5 * time.Second,
					JoinOrder: "left",
				},
				{
					Source:    "stream2",
					JoinKey:   "id",
					Window:    5 * time.Second,
					JoinOrder: "right",
				},
			},
			expectedErr:          PipelineConfigError{msg: "join key cannot be empty"},
			expectedComponentNil: true,
		},
	}
	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			component, err := NewJoinComponent(tc.joinKind, tc.sourceArgs)

			if tc.expectedErr != nil {
				require.EqualError(t, err, tc.expectedErr.Error())
			}
			require.Equal(t, tc.expectedComponentNil, component == nil)
		})
	}
}

func TestJoinComponentValidateForNonExistingSourcesFail(t *testing.T) {
	c, err := NewJoinComponent("temporal", []JoinSourceArgs{
		{
			Source:    "stream1",
			JoinKey:   "",
			Window:    5 * time.Second,
			JoinOrder: "left",
		},
		{
			Source:    "stream2",
			JoinKey:   "id",
			Window:    5 * time.Second,
			JoinOrder: "right",
		},
	})
	require.NoError(t, err)

	source1 := &TestComponentValid{}
	source1.SetID("stream1")

	source2 := &TestComponentValid{}
	source2.SetID("invalidName")

	c.SetInputs([]Component{source1, source2})

	require.EqualError(t, c.Validate(), "undefined join source: invalidName")
}
