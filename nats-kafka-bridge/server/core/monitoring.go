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
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"strconv"
	"time"
)

// HTTP endpoints
const (
	RootPath    = "/"
	VarzPath    = "/varz"
	HealthzPath = "/healthz"
)

// startMonitoring starts the HTTP or HTTPs server if needed.
// expects the lock to be held
func (server *NATSKafkaBridge) startMonitoring() error {
	config := server.config.Monitoring

	if config.HTTPPort != 0 && config.HTTPSPort != 0 {
		return fmt.Errorf("can't specify both HTTP (%v) and HTTPs (%v) ports", config.HTTPPort, config.HTTPSPort)
	}

	if config.HTTPPort == 0 && config.HTTPSPort == 0 {
		server.logger.Debugf("monitoring is disabled")
		return nil
	}

	secure := false

	if config.HTTPSPort != 0 {
		if config.TLS.Cert == "" || config.TLS.Key == "" {
			return fmt.Errorf("TLS cert and key required for HTTPS")
		}
		secure = true
	}

	// Used to track HTTP requests
	server.httpReqStats = map[string]int64{
		RootPath:    0,
		VarzPath:    0,
		HealthzPath: 0,
	}

	var (
		hp       string
		err      error
		listener net.Listener
		port     int
		cer      tls.Certificate
	)

	monitorProtocol := "http"

	if secure {
		monitorProtocol += "s"
		port = config.HTTPSPort
		if port == -1 {
			port = 0
		}
		hp = net.JoinHostPort(config.HTTPHost, strconv.Itoa(port))

		cer, err = tls.LoadX509KeyPair(config.TLS.Cert, config.TLS.Key)
		if err != nil {
			return fmt.Errorf("load tls config: %w", err)
		}

		//nolint:gosec,exhaustruct // ignore tls min version for test, test config
		config := &tls.Config{Certificates: []tls.Certificate{cer}}
		config.ClientAuth = tls.NoClientCert
		listener, err = tls.Listen("tcp", hp, config)
	} else {
		port = config.HTTPPort
		if port == -1 {
			port = 0
		}
		hp = net.JoinHostPort(config.HTTPHost, strconv.Itoa(port))
		listener, err = net.Listen("tcp", hp)
	}

	if err != nil {
		return fmt.Errorf("can't listen to the monitor port: %w", err)
	}

	tcpAddr, ok := listener.Addr().(*net.TCPAddr)
	if !ok {
		return fmt.Errorf("listener address is not of type TCPAddr")
	}

	server.logger.Noticef("starting %s monitor on %s", monitorProtocol,
		net.JoinHostPort(config.HTTPHost, strconv.Itoa(tcpAddr.Port)))

	mhp := net.JoinHostPort(config.HTTPHost, strconv.Itoa(tcpAddr.Port))
	if config.HTTPHost == "" {
		mhp = "localhost" + mhp
	}
	server.monitoringURL = fmt.Sprintf("%s://%s/", monitorProtocol, mhp)

	mux := http.NewServeMux()

	mux.HandleFunc(RootPath, server.HandleRoot)
	mux.HandleFunc(VarzPath, server.HandleVarz)
	mux.HandleFunc(HealthzPath, server.HandleHealthz)

	// Do not set a WriteTimeout because it could cause cURL/browser
	// to return empty response or unable to display page if the
	// server needs more time to build the response.
	//nolint:gosec, exhaustruct // unexposed monitoring - no Slowloris Attack,
	srv := &http.Server{
		Addr:           hp,
		Handler:        mux,
		MaxHeaderBytes: 1 << 20,
	}

	server.listener = listener
	server.httpHandler = mux
	server.http = srv

	go func() {
		if err := srv.Serve(listener); err != nil {
			server.logger.Errorf("unable to serve monitoring: %v", err)
		}
		srv.Handler = nil
	}()

	return nil
}

// StopMonitoring shuts down the http server used for monitoring
// expects the lock to be held
func (server *NATSKafkaBridge) StopMonitoring() error {
	server.logger.Tracef("stopping monitoring")
	if server.http != nil && server.httpHandler != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		if err := server.http.Shutdown(ctx); err != nil {
			return fmt.Errorf("stop monitoring server: %w", err)
		}

		server.http = nil
		server.httpHandler = nil
	}

	if server.listener != nil {
		server.listener.Close() // ignore the error
		server.listener = nil
	}
	server.logger.Debugf("http monitoring stopped")

	return nil
}

// HandleRoot will show basic info and links to others handlers.
func (server *NATSKafkaBridge) HandleRoot(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}
	server.statsLock.Lock()
	server.httpReqStats[RootPath]++
	server.statsLock.Unlock()
	fmt.Fprintf(w, `<html lang="en">
   <head>
    <link rel="shortcut icon" href="http://nats.io/img/favicon.ico">
    <style type="text/css">
      body { font-family: "Century Gothic", CenturyGothic, AppleGothic, sans-serif; font-size: 22; }
      a { margin-left: 32px; }
    </style>
  </head>
  <body>
    <img src="http://nats.io/img/logo.png" alt="NATS">
    <br/>
		<a href=/varz>varz</a><br/>
		<a href=/healthz>healthz</a><br/>
    <br/>
  </body>
</html>`)
}

// HandleVarz returns statistics about the server.
func (server *NATSKafkaBridge) HandleVarz(w http.ResponseWriter, _ *http.Request) {
	server.statsLock.Lock()
	server.httpReqStats[VarzPath]++
	server.statsLock.Unlock()

	stats := server.stats()

	varzJSON, err := json.Marshal(stats)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	//nolint:errcheck // testing handler
	w.Write(varzJSON)
}

// HandleHealthz returns status 200.
func (server *NATSKafkaBridge) HandleHealthz(w http.ResponseWriter, _ *http.Request) {
	server.statsLock.Lock()
	server.httpReqStats[HealthzPath]++
	server.statsLock.Unlock()
	w.WriteHeader(http.StatusOK)
}

// stats calculates the stats for the server and connectors
// assumes that the running lock is held by the caller
func (server *NATSKafkaBridge) stats() BridgeStats {
	now := time.Now()

	//nolint:exhaustruct // conditional population of stats
	stats := BridgeStats{}
	stats.StartTime = server.startTime.Unix()
	stats.UpTime = now.Sub(server.startTime).String()
	stats.ServerTime = now.Unix()

	for _, connector := range server.connectors {
		cstats := connector.Stats()
		stats.Connections = append(stats.Connections, cstats)
		stats.RequestCount += cstats.RequestCount
	}

	stats.HTTPRequests = map[string]int64{}

	server.statsLock.Lock()
	for k, v := range server.httpReqStats {
		stats.HTTPRequests[k] = v
	}
	server.statsLock.Unlock()

	return stats
}

// SafeStats grabs the lock then calls stats(), useful for tests
func (server *NATSKafkaBridge) SafeStats() BridgeStats {
	server.Lock()
	defer server.Unlock()
	return server.stats()
}

// GetMonitoringRootURL returns the protocol://host:port for the monitoring server, useful for testing
func (server *NATSKafkaBridge) GetMonitoringRootURL() string {
	server.Lock()
	defer server.Unlock()
	return server.monitoringURL
}
