/*
 * Copyright 2019-2022 The NATS Authors
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
	"bytes"
	"encoding/binary"
	"fmt"
)

// Utility functions to use with cmap.ConcurrentMap
func packInt32InString(inputNum int32) (string, error) {
	buffer := new(bytes.Buffer)
	err := binary.Write(buffer, binary.BigEndian, inputNum)
	if err != nil {
		return "", fmt.Errorf("write binary: %w", err)
	}

	return buffer.String(), nil
}

func unpackInt32FromString(inputString string) (int32, error) {
	var outputValue int32
	err := binary.Read(bytes.NewBufferString(inputString), binary.BigEndian, &outputValue)
	if err != nil {
		return 0, fmt.Errorf("binary read packer: %w", err)
	}

	return outputValue, nil
}
