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
 */

//nolint:goconst // ignore const redeclarations in test
package core

import (
	"encoding/json"
	"log/slog"
	"strconv"
	"testing"
	"time"

	"github.com/nats-io/nats.go"
	"github.com/nats-io/nuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/glassflow/nats-kafka-bridge/server/conf"
)

func TestSimpleSendOnKafkaReceiveOnJetStream(t *testing.T) {
	subject := nuid.Next()
	topic := nuid.Next()
	msg := getHelloWorldMsgToSend(t)

	connect := []conf.ConnectorConfig{
		{
			Type:         "KafkaToJetStream",
			Subject:      subject,
			Topic:        topic,
			DedupKey:     "id",
			DedupKeyType: "string",
		},
	}

	tbs, err := StartTestEnvironment(connect)
	require.NoError(t, err)
	defer tbs.Close()

	tbs.Bridge.checkConnections()

	done := make(chan string)

	sub, err := tbs.JS.Subscribe(subject, func(msg *nats.Msg) {
		done <- string(msg.Data)
	})
	require.NoError(t, err)
	defer func() {
		err := sub.Unsubscribe()
		if err != nil {
			slog.Error("error unsubscribing to JS", slog.Any("error", err))
		}
	}()

	err = tbs.SendMessageToKafka(topic, msg, 5000)
	require.NoError(t, err)

	received := tbs.WaitForIt(1, done)
	require.Equal(t, string(msg), received)

	stats := tbs.Bridge.SafeStats()
	connStats := stats.Connections[0]
	require.Equal(t, int64(1), connStats.MessagesIn)
	require.Equal(t, int64(1), connStats.MessagesOut)
	require.Equal(t, int64(len(msg)), connStats.BytesIn)
	require.Equal(t, int64(len(msg)), connStats.BytesOut)
	require.Equal(t, int64(1), connStats.Connects)
	require.Equal(t, int64(0), connStats.Disconnects)
	require.True(t, connStats.Connected)
}

func TestSimpleSASLSendOnKafkaReceiveOnJetStream(t *testing.T) {
	subject := nuid.Next()
	topic := nuid.Next()
	msg := getHelloWorldMsgToSend(t)

	connect := []conf.ConnectorConfig{
		{
			Type:         "KafkaToJetStream",
			Subject:      subject,
			Topic:        topic,
			DedupKey:     "id",
			DedupKeyType: "string",
			SASL: conf.SASL{
				User:     saslUser,
				Password: saslPassword,
			},
		},
	}

	tbs, err := StartSASLTestEnvironment(connect)
	require.NoError(t, err)
	defer tbs.Close()

	tbs.Bridge.checkConnections()

	done := make(chan string)

	sub, err := tbs.JS.Subscribe(subject, func(msg *nats.Msg) {
		done <- string(msg.Data)
	})
	require.NoError(t, err)
	defer func() {
		err := sub.Unsubscribe()
		if err != nil {
			slog.Error("error unsubscribing to JS", slog.Any("error", err))
		}
	}()

	err = tbs.SendMessageToKafka(topic, msg, 5000)
	require.NoError(t, err)

	received := tbs.WaitForIt(1, done)
	require.Equal(t, string(msg), received)

	stats := tbs.Bridge.SafeStats()
	connStats := stats.Connections[0]
	require.Equal(t, int64(1), connStats.MessagesIn)
	require.Equal(t, int64(1), connStats.MessagesOut)
	require.Equal(t, int64(len(msg)), connStats.BytesIn)
	require.Equal(t, int64(len(msg)), connStats.BytesOut)
	require.Equal(t, int64(1), connStats.Connects)
	require.Equal(t, int64(0), connStats.Disconnects)
	require.True(t, connStats.Connected)
}

func TestSimpleSendOnKafkaReceiveOnJetStreamWithGroup(t *testing.T) {
	if testing.Short() {
		t.SkipNow()
	}

	subject := nuid.Next()
	topic := nuid.Next()
	group := "group-1"
	msg := getHelloWorldMsgToSend(t)

	connect := []conf.ConnectorConfig{
		{
			Type:          "KafkaToJetStream",
			Subject:       subject,
			Topic:         topic,
			DedupKey:      "id",
			DedupKeyType:  "string",
			GroupID:       group,
			InitialOffset: "newest",
		},
	}

	tbs, err := StartTestEnvironment(connect)
	require.NoError(t, err)
	defer tbs.Close()

	// This test almost always fails if we don't wait a bit here.
	// It has something to do with CG related initialization in Kafka;
	// This delay is not bullet proof but at least helps.
	time.Sleep(2 * time.Second)

	done := make(chan string)

	sub, err := tbs.JS.Subscribe(subject, func(msg *nats.Msg) {
		done <- string(msg.Data)
	})
	require.NoError(t, err)
	defer func() {
		err := sub.Unsubscribe()
		if err != nil {
			slog.Error("error unsubscribing to JS", slog.Any("error", err))
		}
	}()

	err = tbs.SendMessageToKafka(topic, msg, 5000)
	require.NoError(t, err)

	received := tbs.WaitForIt(1, done)
	require.Equal(t, string(msg), received)

	stats := tbs.Bridge.SafeStats()
	connStats := stats.Connections[0]
	require.Equal(t, int64(1), connStats.MessagesIn)
	require.Equal(t, int64(1), connStats.MessagesOut)
	require.Equal(t, int64(len(msg)), connStats.BytesIn)
	require.Equal(t, int64(len(msg)), connStats.BytesOut)
	require.Equal(t, int64(1), connStats.Connects)
	require.Equal(t, int64(0), connStats.Disconnects)
	require.True(t, connStats.Connected)
}

func TestSimpleSendOnKafkaReceiveOnJetStreamWithGroupIntegerDedupIDAndHeaders(t *testing.T) {
	if testing.Short() {
		t.SkipNow()
	}

	subject := nuid.Next()
	topic := nuid.Next()
	group := "group-1"

	type Message struct {
		ID      int64  `json:"id"`
		Message string `json:"msg"`
	}

	dedupliatedID := 1234

	msg, err := json.Marshal(Message{
		ID:      int64(dedupliatedID),
		Message: "hello world",
	})
	require.NoError(t, err)

	connect := []conf.ConnectorConfig{
		{
			Type:          "KafkaToJetStream",
			Subject:       subject,
			Topic:         topic,
			DedupKey:      "id",
			DedupKeyType:  "int",
			GroupID:       group,
			InitialOffset: "newest",
		},
	}

	tbs, err := StartTestEnvironment(connect)
	require.NoError(t, err)
	defer tbs.Close()

	// This test almost always fails if we don't wait a bit here.
	// It has something to do with CG related initialization in Kafka;
	// This delay is not bullet proof but at least helps.
	time.Sleep(2 * time.Second)

	done := make(chan string)

	sub, err := tbs.JS.Subscribe(subject, func(msg *nats.Msg) {
		natsIDHdr, ok := msg.Header["Nats-Msg-Id"]
		assert.True(t, ok)
		assert.Len(t, natsIDHdr, 1)
		assert.Equal(t, strconv.Itoa(dedupliatedID), natsIDHdr[0])
		done <- string(msg.Data)
	})
	require.NoError(t, err)
	defer func() {
		err := sub.Unsubscribe()
		if err != nil {
			slog.Error("error unsubscribing to JS", slog.Any("error", err))
		}
	}()

	err = tbs.SendMessageToKafka(topic, msg, 5000)
	require.NoError(t, err)

	received := tbs.WaitForIt(1, done)
	require.Equal(t, string(msg), received)

	stats := tbs.Bridge.SafeStats()
	connStats := stats.Connections[0]
	require.Equal(t, int64(1), connStats.MessagesIn)
	require.Equal(t, int64(1), connStats.MessagesOut)
	require.Equal(t, int64(len(msg)), connStats.BytesIn)
	require.Equal(t, int64(len(msg)), connStats.BytesOut)
	require.Equal(t, int64(1), connStats.Connects)
	require.Equal(t, int64(0), connStats.Disconnects)
	require.True(t, connStats.Connected)
}

func TestSimpleSASLSendOnKafkaReceiveOnJetStreamWithGroup(t *testing.T) {
	if testing.Short() {
		t.SkipNow()
	}

	subject := nuid.Next()
	topic := nuid.Next()
	group := "group-1"
	msg := getHelloWorldMsgToSend(t)

	connect := []conf.ConnectorConfig{
		{
			Type:          "KafkaToJetStream",
			Subject:       subject,
			Topic:         topic,
			GroupID:       group,
			DedupKey:      "id",
			DedupKeyType:  "string",
			InitialOffset: "newest",
			SASL: conf.SASL{
				User:     saslUser,
				Password: saslPassword,
			},
		},
	}

	tbs, err := StartSASLTestEnvironment(connect)
	require.NoError(t, err)
	defer tbs.Close()

	done := make(chan string)

	sub, err := tbs.NC.Subscribe(subject, func(msg *nats.Msg) {
		done <- string(msg.Data)
	})
	require.NoError(t, err)
	defer func() {
		err := sub.Unsubscribe()
		if err != nil {
			slog.Error("error unsubscribing to JS", slog.Any("error", err))
		}
	}()

	err = tbs.SendMessageToKafka(topic, msg, 5000)
	require.NoError(t, err)

	received := tbs.WaitForIt(1, done)
	require.Equal(t, string(msg), received)

	stats := tbs.Bridge.SafeStats()
	connStats := stats.Connections[0]
	require.Equal(t, int64(1), connStats.MessagesIn)
	require.Equal(t, int64(1), connStats.MessagesOut)
	require.Equal(t, int64(len(msg)), connStats.BytesIn)
	require.Equal(t, int64(len(msg)), connStats.BytesOut)
	require.Equal(t, int64(1), connStats.Connects)
	require.Equal(t, int64(0), connStats.Disconnects)
	require.True(t, connStats.Connected)
}

func TestSimpleSendOnQueueReceiveOnJetStreamWithTLS(t *testing.T) {
	subject := nuid.Next()
	topic := nuid.Next()
	msg := getHelloWorldMsgToSend(t)

	connect := []conf.ConnectorConfig{
		{
			Type:         "KafkaToJetStream",
			Subject:      subject,
			Topic:        topic,
			DedupKey:     "id",
			DedupKeyType: "string",
		},
	}

	tbs, err := StartTLSTestEnvironment(connect)
	require.NoError(t, err)
	defer tbs.Close()

	done := make(chan string)

	sub, err := tbs.JS.Subscribe(subject, func(msg *nats.Msg) {
		done <- string(msg.Data)
	})
	require.NoError(t, err)
	defer func() {
		err := sub.Unsubscribe()
		if err != nil {
			slog.Error("error unsubscribing to JS", slog.Any("error", err))
		}
	}()

	err = tbs.SendMessageToKafka(topic, msg, 5000)
	require.NoError(t, err)

	received := tbs.WaitForIt(1, done)
	require.Equal(t, string(msg), received)
}

func getHelloWorldMsgToSend(t *testing.T) []byte {
	t.Helper()
	type Message struct {
		ID  string `json:"id"`
		Msg string `json:"msg"`
	}

	msg := Message{
		ID:  nuid.Next(),
		Msg: "hello world",
	}

	kmsg, err := json.Marshal(msg)
	require.NoError(t, err)

	return kmsg
}
