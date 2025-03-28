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
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"github.com/riferrei/srclient"
	"github.com/stretchr/testify/assert"
)

// schemas for testing
const avroSchema = `{
		"type": "record",
		"name": "snack",
		"fields": [
			{"name": "name", "type": "string"},
			{"name": "manufacturer", "type": "string"},
			{"name": "calories", "type": "float"},
			{"name": "color", "type": ["null", "string"], "default": null}
		]
	}`

const jsonSchema = `{
		"$schema": "https://json-schema.org/draft/2020-12/schema",
		"title": "Snack",
		"type": "object",
		"properties": {
			"name": {"type": "string"},
			"manufacturer": {"type": "string"},
			"calories": {"type": "number"},
			"color": {"type": "string"}
		},
		"required": ["name", "manufacturer", "calories"]
	}`

const protobufSchema = `message Snack {
		required string name = 1;
		required string manufacturer = 2;
		required float calories = 3;
		optional string color = 4;
	}`

// sample messages for testing
const (
	avroMessage     = `{"name":"cookie", "manufacturer": "cadbury", "calories": 100.0}`
	jsonMessage     = `{"name":"candy", "manufacturer": "nestle", "calories": 200.0}`
	protobufMessage = `{"name":"chocolate", "manufacturer": "hersheys", "calories": 300.0}`
)

// schema registry subject names
const (
	avroSubjectName     = "snack_avro-value"
	jsonSubjectName     = "snack_json-value"
	protobufSubjectName = "snack_protobuf-value"
)

// schema ids
const (
	avroSchemaID     = 1
	jsonSchemaID     = 2
	protobufSchemaID = 3
)

// schema versions
const (
	avroSchemaVersion     = 1
	jsonSchemaVersion     = 1
	protobufSchemaVersion = 1
)

type schemaResponse struct {
	Subject string `json:"subject"`
	Version int    `json:"version"`
	Schema  string `json:"schema"`
	//nolint:tagliatelle // allow in test
	SchemaType *srclient.SchemaType `json:"schemaType"`
	ID         int                  `json:"id"`
	References []srclient.Reference `json:"references"`
}

type mockSchemaRegistry struct {
	instance *httptest.Server
	t        *testing.T
}

func newMockSchemaServer(t *testing.T) mockSchemaRegistry {
	t.Helper()
	mcs := new(mockSchemaRegistry)
	mcs.instance = httptest.NewServer(http.HandlerFunc(mcs.schemaRequestHandler))
	mcs.t = t
	return *mcs
}

func (s mockSchemaRegistry) close() {
	s.instance.Close()
}

func (s mockSchemaRegistry) schemaRequestHandler(rw http.ResponseWriter, req *http.Request) {
	var responsePayload *schemaResponse
	switch req.URL.String() {
	case "/subjects/" + avroSubjectName + "/versions/latest",
		"/subjects/" + avroSubjectName + "/versions/" + strconv.Itoa(avroSchemaVersion),
		"/schemas/ids/" + strconv.Itoa(avroSchemaID):
		avroSchemaType := srclient.Avro
		//nolint: exhaustruct // testing
		responsePayload = &schemaResponse{
			Subject:    avroSubjectName,
			Version:    avroSchemaVersion,
			Schema:     avroSchema,
			ID:         avroSchemaID,
			SchemaType: &avroSchemaType,
		}

	case "/subjects/" + jsonSubjectName + "/versions/latest",
		"/subjects/" + jsonSubjectName + "/versions/" + strconv.Itoa(jsonSchemaVersion),
		"/schemas/ids/" + strconv.Itoa(jsonSchemaID):
		jsonSchemaType := srclient.Json
		//nolint: exhaustruct // testing
		responsePayload = &schemaResponse{
			Subject:    jsonSubjectName,
			Version:    jsonSchemaVersion,
			Schema:     jsonSchema,
			ID:         jsonSchemaID,
			SchemaType: &jsonSchemaType,
		}

	case "/subjects/" + protobufSubjectName + "/versions/latest",
		"/subjects/" + protobufSubjectName + "/versions/" + strconv.Itoa(protobufSchemaVersion),
		"/schemas/ids/" + strconv.Itoa(protobufSchemaID):
		protobufSchemaType := srclient.Protobuf
		//nolint: exhaustruct // testing
		responsePayload = &schemaResponse{
			Subject:    protobufSubjectName,
			Version:    protobufSchemaVersion,
			Schema:     protobufSchema,
			ID:         protobufSchemaID,
			SchemaType: &protobufSchemaType,
		}

	default:
		//nolint: err113 // static errors not required for testing
		assert.Error(s.t, errors.New("unhandled request"))
	}

	response, err := json.Marshal(responsePayload)
	assert.NoError(s.t, err)
	_, err = rw.Write(response)
	assert.NoError(s.t, err)
}

func (s mockSchemaRegistry) getServerURL() string {
	return s.instance.URL
}
