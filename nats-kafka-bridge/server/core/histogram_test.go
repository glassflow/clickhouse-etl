/*
 * Copyright 2019 The NATS Authors
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package core

// Based on https://github.com/VividCortex/gohistogram MIT license

import (
	"math"
	"testing"

	"github.com/stretchr/testify/require"
)

func approx(x, y float64) bool {
	return math.Abs(x-y) < 0.2
}

func TestHistogram(t *testing.T) {
	h := NewHistogram(160)
	for i := range 15000 {
		h.Add(float64(i % 100))
	}

	firstQ := h.Quantile(0.25)
	median := h.Quantile(0.5)
	thirdQ := h.Quantile(0.75)

	require.InEpsilon(t, float64(15000), h.Count(), float64(0))
	require.True(t, approx(firstQ, 24))
	require.True(t, approx(median, 49))
	require.True(t, approx(thirdQ, 74))

	require.True(t, approx(h.Mean(), 49.5))

	h.Scale(0.5)
	median = h.Quantile(0.5)
	require.True(t, approx(median, 24.5))
}

func TestHistogramTrim(t *testing.T) {
	h := NewHistogram(10)
	for i := range 150 {
		h.Add(float64(i % 100))
	}
	require.Len(t, h.Bins, 10)
}
