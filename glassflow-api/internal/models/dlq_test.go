package models

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestDLQNewBatchSuccess(t *testing.T) {
	bs, err := NewDLQBatchSize(50)
	require.NoError(t, err)

	require.Equal(t, 50, bs.Int)
}

func TestDLQNewBatchForEmptySizeSuccess(t *testing.T) {
	bs, err := NewDLQBatchSize(0)
	require.NoError(t, err)

	require.Equal(t, 100, bs.Int)
}

func TestDLQNewBatchGreaterThanMaxAllowedFail(t *testing.T) {
	s, err := NewDLQBatchSize(1000)
	require.EqualError(t, err, ErrDLQMaxBatchSize.Error())

	require.Empty(t, s)
}
