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

//nolint:wrapcheck // errors need not be wrapped in tests
package kafka

import (
	"encoding/binary"
	"fmt"
	"os"
	"strconv"
	"testing"
	"time"

	"github.com/IBM/sarama"
	//nolint:staticcheck // will remove deprecated once start supporting pb
	"github.com/jhump/protoreflect/desc/protoparse"
	//nolint:staticcheck // will remove deprecated once start supporting pb
	"github.com/jhump/protoreflect/dynamic"
	"github.com/linkedin/goavro/v2"
	"github.com/riferrei/srclient"
	"github.com/stretchr/testify/require"
)

func TestDeserializePayloadAvro(t *testing.T) {
	server := newMockSchemaServer(t)
	defer server.close()

	consumer := saramaConsumer{
		schemaRegistryOn:     true,
		schemaRegistryClient: srclient.CreateSchemaRegistryClient(server.getServerURL()),
		schemaType:           srclient.Avro,
	}

	avroCodec, err := goavro.NewCodec(avroSchema)
	require.NoError(t, err)
	native, _, err := avroCodec.NativeFromTextual([]byte(avroMessage))
	require.NoError(t, err)
	avroBytes, err := avroCodec.BinaryFromNative(nil, native)
	require.NoError(t, err)

	schemaIDBytes := make([]byte, 4)
	binary.BigEndian.PutUint32(schemaIDBytes, uint32(avroSchemaID))

	var payload []byte
	payload = append(payload, byte(0))
	payload = append(payload, schemaIDBytes...)
	payload = append(payload, avroBytes...)

	_, err = consumer.deserializePayload(payload)
	require.NoError(t, err)
}

func TestDeserializePayloadJson(t *testing.T) {
	server := newMockSchemaServer(t)
	defer server.close()

	consumer := &saramaConsumer{
		schemaRegistryOn:     true,
		schemaRegistryClient: srclient.CreateSchemaRegistryClient(server.getServerURL()),
		schemaType:           srclient.Json,
	}

	schemaIDBytes := make([]byte, 4)
	binary.BigEndian.PutUint32(schemaIDBytes, uint32(jsonSchemaID))

	var payload []byte
	payload = append(payload, byte(0))
	payload = append(payload, schemaIDBytes...)
	payload = append(payload, []byte(jsonMessage)...)

	_, err := consumer.deserializePayload(payload)
	require.NoError(t, err)
}

func TestDeserializePayloadProtobuf(t *testing.T) {
	server := newMockSchemaServer(t)
	defer server.close()

	consumer := &saramaConsumer{
		schemaRegistryOn:     true,
		schemaRegistryClient: srclient.CreateSchemaRegistryClient(server.getServerURL()),
		schemaType:           srclient.Protobuf,
		pbDeserializer:       newDeserializer(),
	}

	schemaIDBytes := make([]byte, 4)
	binary.BigEndian.PutUint32(schemaIDBytes, uint32(protobufSchemaID))

	msgIndexBytes := make([]byte, 16)
	length := binary.PutVarint(msgIndexBytes, 1)
	binary.PutVarint(msgIndexBytes[length:], 0)

	protoBytes, err := createProtobufMessage()
	require.NoError(t, err)

	var payload []byte
	payload = append(payload, byte(0))
	payload = append(payload, schemaIDBytes...)
	payload = append(payload, msgIndexBytes...)
	payload = append(payload, protoBytes...)

	_, err = consumer.deserializePayload(payload)
	require.NoError(t, err)
}

func TestConvertToMsgHeaderOK(t *testing.T) {
	consumerHdrs := make([]*sarama.RecordHeader, 3)
	for i := range consumerHdrs {
		keyString := fmt.Sprintf("key-%d", i)
		valueString := fmt.Sprintf("value-%d", i)
		entry := sarama.RecordHeader{
			Key:   []byte(keyString),
			Value: []byte(valueString),
		}
		element := &entry
		consumerHdrs[i] = element
	}

	sc := saramaConsumer{}
	messageHeaders := sc.convertToMessageHeaders(consumerHdrs)
	require.Equal(t, len(messageHeaders), len(consumerHdrs))
	for i, element := range messageHeaders {
		require.Equal(t, string(consumerHdrs[i].Value), string(element.Value))
		require.Equal(t, string(consumerHdrs[i].Key), string(element.Key))
	}
}

func TestConvertToMsgHeaderNull(t *testing.T) {
	sc := saramaConsumer{}
	messageHeaders := sc.convertToMessageHeaders(nil)
	require.Equal(t, []sarama.RecordHeader{}, messageHeaders)
}

func createProtobufMessage() ([]byte, error) {
	errorReporter := func(err protoparse.ErrorWithPos) error {
		position := err.GetPosition()
		return fmt.Errorf("unable to parse file descriptor %s %d: %w", position.Filename, position.Line, err.Unwrap())
	}

	nanoTS := strconv.FormatInt(time.Now().UnixNano(), 10)
	schemaFileName := "test-" + nanoTS + ".proto"
	file, err := os.CreateTemp("", schemaFileName)
	if err != nil {
		return nil, err
	}

	_, err = file.WriteString(protobufSchema)
	if err != nil {
		return nil, err
	}

	err = file.Close()
	if err != nil {
		return nil, err
	}
	defer os.Remove(file.Name())

	schemaMap := make(map[string]string, 1)
	schemaMap[schemaFileName] = protobufSchema
	var schemaFilePaths []string
	schemaFilePaths = append(schemaFilePaths, schemaFileName)
	protobufParser := &protoparse.Parser{
		Accessor:              protoparse.FileContentsFromMap(schemaMap),
		ImportPaths:           []string{"."},
		InferImportPaths:      true,
		ValidateUnlinkedFiles: true,
		ErrorReporter:         errorReporter,
	}
	fds, err := protobufParser.ParseFiles(schemaFilePaths...)
	if err != nil {
		return nil, err
	}

	dynamicMessage := dynamic.NewMessage(fds[0].GetMessageTypes()[0])
	err = dynamicMessage.UnmarshalJSON([]byte(protobufMessage))
	if err != nil {
		return nil, err
	}

	bytes, err := dynamicMessage.Marshal()
	if err != nil {
		return nil, err
	}

	return bytes, nil
}
