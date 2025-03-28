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
	"testing"

	"github.com/riferrei/srclient"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSerializePayloadAvro(t *testing.T) {
	server := newMockSchemaServer(t)
	defer server.close()

	producer := &saramaProducer{
		schemaRegistryOn:     true,
		schemaRegistryClient: srclient.CreateSchemaRegistryClient(server.getServerURL()),
		subjectName:          avroSubjectName,
		schemaVersion:        avroSchemaVersion,
		schemaType:           srclient.Avro,
	}

	_, err := producer.serializePayload([]byte(avroMessage))
	assert.NoError(t, err)
}

func TestSerializePayloadJson(t *testing.T) {
	server := newMockSchemaServer(t)
	defer server.close()

	producer := &saramaProducer{
		schemaRegistryOn:     true,
		schemaRegistryClient: srclient.CreateSchemaRegistryClient(server.getServerURL()),
		subjectName:          jsonSubjectName,
		schemaVersion:        jsonSchemaVersion,
		schemaType:           srclient.Json,
	}

	_, err := producer.serializePayload([]byte(jsonMessage))
	assert.NoError(t, err)
}

func TestSerializePayloadProtobuf(t *testing.T) {
	server := newMockSchemaServer(t)
	defer server.close()
	srClient := srclient.CreateSchemaRegistryClient(server.getServerURL())

	producer := &saramaProducer{
		schemaRegistryOn:     true,
		schemaRegistryClient: srClient,
		subjectName:          protobufSubjectName,
		schemaVersion:        protobufSchemaVersion,
		schemaType:           srclient.Protobuf,
		pbSerializer:         newSerializer(),
	}
	schema, err := srClient.GetSchema(protobufSchemaID)
	require.NoError(t, err)

	message, err := producer.serializePayload([]byte(protobufMessage))
	require.NoError(t, err)

	_, err = newDeserializer().Deserialize(schema, message[5:])
	require.NoError(t, err)
}
