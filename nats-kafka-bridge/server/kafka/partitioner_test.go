/*
 * Copyright 2019-2021 The NATS Authors
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

package kafka

import (
	"testing"

	cmap "github.com/orcaman/concurrent-map"
	"github.com/stretchr/testify/require"
)

func TestFindPartitionWithMinBytes(t *testing.T) {
	testBytes := cmap.New()
	testBytes.Set("0", uint64(1000))
	testBytes.Set("1", uint64(200))
	testBytes.Set("2", uint64(300))
	testBytes.Set("3", uint64(100))
	testBytes.Set("4", uint64(600))

	partitioner := new(leastBytesPartitioner)
	partitioner.byteCounters = testBytes
	minPartition := partitioner.findPartitionWithMinBytes()
	require.Equal(t, "3", minPartition)
}
