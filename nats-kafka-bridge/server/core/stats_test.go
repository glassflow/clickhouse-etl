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
 *
 */

package core

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestMessageCounts(t *testing.T) {
	statsH := NewConnectorStatsHolder("one", "two")
	loops := int64(101)
	sizeIn := int64(11)
	sizeOut := int64(13)

	for range loops {
		statsH.AddMessageIn(sizeIn)
		statsH.AddMessageOut(sizeOut)
	}

	stats := statsH.Stats()
	require.Equal(t, "one", statsH.Name())
	require.Equal(t, "two", statsH.ID())
	require.Equal(t, "one", stats.Name)
	require.Equal(t, "two", stats.ID)
	require.Equal(t, loops, stats.MessagesIn)
	require.Equal(t, loops, stats.MessagesOut)
	require.Equal(t, loops*sizeIn, stats.BytesIn)
	require.Equal(t, loops*sizeOut, stats.BytesOut)
}

func TestConnectDisconnectCounts(t *testing.T) {
	statsH := NewConnectorStatsHolder("one", "two")
	loops := int64(101)

	for range loops {
		statsH.AddDisconnect()
		statsH.AddConnect()
		statsH.AddConnect()
	}

	stats := statsH.Stats()
	require.Equal(t, "one", statsH.Name())
	require.Equal(t, "two", statsH.ID())
	require.Equal(t, "one", stats.Name)
	require.Equal(t, "two", stats.ID)
	require.Equal(t, loops, stats.Disconnects)
	require.Equal(t, 2*loops, stats.Connects)
	require.Equal(t, int64(0), stats.BytesIn)
	require.Equal(t, int64(0), stats.BytesOut)
	require.Equal(t, int64(0), stats.MessagesIn)
	require.Equal(t, int64(0), stats.MessagesOut)
}

func TestRequestTimes(t *testing.T) {
	statsH := NewConnectorStatsHolder("one", "two")

	dur := 4 * time.Second

	statsH.AddRequestTime(dur)

	stats := statsH.Stats()
	require.Equal(t, "one", statsH.Name())
	require.Equal(t, "two", statsH.ID())
	require.Equal(t, "one", stats.Name)
	require.Equal(t, "two", stats.ID)
	require.InEpsilon(t, float64(dur.Nanoseconds()), stats.MovingAverage, float64(0))
	require.Equal(t, int64(1), stats.RequestCount)
}
