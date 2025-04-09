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

package conf

import (
	"encoding/base64"
	"os"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestDefaultConfig(t *testing.T) {
	config := DefaultBridgeConfig(true, true)
	require.False(t, config.Logging.Trace)
	require.Equal(t, 5000, config.Monitoring.ReadTimeout)
	require.Equal(t, 5000, config.NATS.ConnectTimeout)
}

func TestMakeTLSConfig(t *testing.T) {
	tlsC := &TLSConf{
		Cert: "../../resources/certs/client-cert.pem",
		Key:  "../../resources/certs/client-key.pem",
		Root: "../../resources/certs/ca-cert.pem",
	}
	_, err := tlsC.MakeTLSConfig()
	require.NoError(t, err)
}

func TestMakeTLSConfigFromEnv(t *testing.T) {
	clientCert, err := os.ReadFile("../../resources/certs/client-cert.pem")
	require.NoError(t, err)

	clientKey, err := os.ReadFile("../../resources/certs/client-key.pem")
	require.NoError(t, err)

	rootCert, err := os.ReadFile("../../resources/certs/ca-cert.pem")
	require.NoError(t, err)

	encodedClientCert := base64.StdEncoding.EncodeToString(clientCert)
	encodedClientKey := base64.StdEncoding.EncodeToString(clientKey)
	encodedRootCert := base64.StdEncoding.EncodeToString(rootCert)

	tlsC := &TLSConf{
		Cert: encodedClientCert,
		Key:  encodedClientKey,
		Root: encodedRootCert,
	}
	_, err = tlsC.MakeTLSConfigFromStrings()
	require.NoError(t, err)
}
