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

	//nolint:staticcheck // will remove deprecated once start supporting pb
	"github.com/jhump/protoreflect/desc"
	//nolint:staticcheck // will remove deprecated once start supporting pb
	"github.com/jhump/protoreflect/dynamic"
	"github.com/riferrei/srclient"
)

type pbDeserializer interface {
	Deserialize(*srclient.Schema, []byte) ([]byte, error)
}

type protobufDeserializer struct {
	//nolint: unused // will be used later
	schemaManager protobufSchemaManager
}

type protobufWrapper struct {
	Schema             *srclient.Schema
	MessageTypeIndexes []int64
	CleanPayload       []byte
}

func newDeserializer() pbDeserializer {
	return &protobufDeserializer{
		schemaManager: newProtobufSchemaManager(),
	}
}

func (pd *protobufDeserializer) Deserialize(schema *srclient.Schema, payload []byte) ([]byte, error) {
	wrapper, err := pd.decodeProtobufStructures(schema, payload)
	if err != nil {
		return nil, err
	}

	// Get the message descriptor from the message
	messageDescriptor, err := pd.getMessageDescriptorFromMessage(wrapper)
	if err != nil {
		return nil, err
	}

	// Deserialize the message from write format into protobuf JSON
	message := dynamic.NewMessage(messageDescriptor)
	err = message.Unmarshal(wrapper.CleanPayload)
	if err != nil {
		return nil, fmt.Errorf("unmarshal to protobuf JSON: %w", err)
	}

	jsonBytes, err := message.MarshalJSON()
	if err != nil {
		return nil, fmt.Errorf("marshal json to protobuf bytes: %w", err)
	}

	return jsonBytes, nil
}

func (pd *protobufDeserializer) decodeProtobufStructures(schema *srclient.Schema, payload []byte) (*protobufWrapper, error) {
	payloadReader := bytes.NewReader(payload)
	arrayLength, err := binary.ReadVarint(payloadReader)
	if err != nil {
		return nil, fmt.Errorf("unable to read arrayLength: %w", err)
	}

	messageTypeIDs := make([]int64, arrayLength)
	// The array won't be sent if there is only one message type with default index 0
	if arrayLength == 0 {
		//nolint: makezero // TBD
		messageTypeIDs = append(messageTypeIDs, 0)
	}

	for i := range arrayLength {
		messageID, err := binary.ReadVarint(payloadReader)
		if err != nil {
			return nil, fmt.Errorf("unable to read messageTypeID: %w", err)
		}
		messageTypeIDs[i] = messageID
	}

	remainingPayload := make([]byte, payloadReader.Len())
	_, err = payloadReader.Read(remainingPayload)
	if err != nil {
		return nil, fmt.Errorf("unable to read remaining payload: %w", err)
	}

	return &protobufWrapper{
		Schema:             schema,
		MessageTypeIndexes: messageTypeIDs,
		CleanPayload:       remainingPayload,
	}, nil
}

func (pd *protobufDeserializer) getMessageDescriptorFromMessage(wrapper *protobufWrapper) (*desc.MessageDescriptor, error) {
	fd, err := schemaManager.getFileDescriptor(wrapper.Schema)
	if err != nil {
		return nil, err
	}

	// Traverse through the message types until we find the right type as pointed to by message array index. This array
	// of varints with each type indexed level by level.
	messageTypes := fd.GetMessageTypes()
	messageTypesLen := int64(len(messageTypes))
	var messageDescriptor *desc.MessageDescriptor

	for _, i := range wrapper.MessageTypeIndexes {
		if i > messageTypesLen {
			// This should never happen
			return nil, fmt.Errorf("failed to decode message type: message index is larger than message types array length")
		}
		messageDescriptor = messageTypes[i]
		messageTypes = messageDescriptor.GetNestedMessageTypes()
	}

	return messageDescriptor, nil
}
