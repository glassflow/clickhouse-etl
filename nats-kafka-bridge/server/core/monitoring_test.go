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

import (
	"crypto/tls"
	"encoding/json"
	"io"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/glassflow/nats-kafka-bridge/server/conf"
)

func TestMonitoringPages(t *testing.T) {
	start := time.Now()

	connect := []conf.ConnectorConfig{
		{
			Type:    "NATSToKafka",
			Topic:   "test3",
			Subject: "test.*",
		},
	}

	tbs, err := StartTestEnvironment(connect)
	require.NoError(t, err)
	defer tbs.Close()

	client := http.Client{}
	//nolint:noctx // allow in testing
	response, err := client.Get(tbs.Bridge.GetMonitoringRootURL())
	require.NoError(t, err)
	defer response.Body.Close()
	contents, err := io.ReadAll(response.Body)
	require.NoError(t, err)
	html := string(contents)
	require.Contains(t, html, "/varz")
	require.Contains(t, html, "/healthz")

	//nolint:noctx // allow in testing
	response, err = client.Get(tbs.Bridge.GetMonitoringRootURL() + "healthz")
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, response.StatusCode)
	defer response.Body.Close()

	//nolint:noctx // allow in testing
	response, err = client.Get(tbs.Bridge.GetMonitoringRootURL() + "varz")
	require.NoError(t, err)
	defer response.Body.Close()
	contents, err = io.ReadAll(response.Body)
	require.NoError(t, err)

	bridgeStats := BridgeStats{}
	err = json.Unmarshal(contents, &bridgeStats)
	require.NoError(t, err)

	now := time.Now()
	require.GreaterOrEqual(t, bridgeStats.StartTime, start.Unix())
	require.LessOrEqual(t, bridgeStats.StartTime, now.Unix())
	require.GreaterOrEqual(t, bridgeStats.ServerTime, start.Unix())
	require.LessOrEqual(t, bridgeStats.ServerTime, now.Unix())

	require.Equal(t, int64(1), bridgeStats.HTTPRequests["/"])
	require.Equal(t, int64(1), bridgeStats.HTTPRequests["/varz"])
	require.Equal(t, int64(1), bridgeStats.HTTPRequests["/healthz"])

	require.Len(t, bridgeStats.Connections, 1)
	require.True(t, bridgeStats.Connections[0].Connected)
	require.Equal(t, int64(1), bridgeStats.Connections[0].Connects)
	require.Equal(t, int64(0), bridgeStats.Connections[0].MessagesIn)
	require.Equal(t, int64(0), bridgeStats.Connections[0].MessagesOut)
	require.Equal(t, int64(0), bridgeStats.Connections[0].BytesIn)
	require.Equal(t, int64(0), bridgeStats.Connections[0].BytesOut)
}

func TestHealthzWithTLS(t *testing.T) {
	connect := []conf.ConnectorConfig{}

	tbs, err := StartTLSTestEnvironment(connect)
	require.NoError(t, err)
	defer tbs.Close()

	tr := &http.Transport{
		//nolint:gosec // testing config
		TLSClientConfig: &tls.Config{
			InsecureSkipVerify: true,
		},
	}
	client := &http.Client{Transport: tr}
	//nolint:noctx // allow in testing
	response, err := client.Get(tbs.Bridge.GetMonitoringRootURL() + "healthz")
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, response.StatusCode)
	defer response.Body.Close()
}
