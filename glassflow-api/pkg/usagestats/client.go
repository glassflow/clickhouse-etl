package usagestats

import (
	"context"
	"crypto/md5"
	"fmt"
	"log/slog"
	"net/http"
	"sync"
	"time"
)

type Client struct {
	endpoint       string
	username       string
	password       string
	installationID string

	token       string
	tokenExpiry time.Time
	tokenMu     sync.RWMutex

	httpClient *http.Client
	log        *slog.Logger
	enabled    bool
}

type Event struct {
	InstallationID string                 `json:"installation_id"`
	EventName      string                 `json:"event_name"`
	EventSource    string                 `json:"event_source"`
	Timestamp      string                 `json:"timestamp"`
	Properties     map[string]interface{} `json:"properties"`
}

func NewClient(endpoint, username, password, installationID string, enabled bool, log *slog.Logger) *Client {
	if !enabled {
		return &Client{enabled: false}
	}

	return &Client{
		endpoint:       endpoint,
		username:       username,
		password:       password,
		installationID: installationID,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
		log:     log,
		enabled: true,
	}
}

func (c *Client) IsEnabled() bool {
	return c.enabled
}

func MaskPipelineID(pipelineID string) string {
	hash := md5.Sum([]byte(pipelineID))
	return fmt.Sprintf("%x", hash)
}

func (c *Client) SendEvent(eventName, eventSource string, properties map[string]interface{}) {
	if c == nil || !c.enabled {
		return
	}

	c.log.Debug("usage stats: sending event", "event", eventName, "source", eventSource, "properties", properties)

	go func() {
		usageStatsCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		if err := c.sendEventSync(usageStatsCtx, eventName, eventSource, properties); err != nil {
			c.log.Debug("usage stats event send failed", "event", eventName, "source", eventSource, "error", err)
			return
		}

		c.log.Debug("usage stats: event sent successfully", "event", eventName, "source", eventSource)

	}()
}

func (c *Client) getToken(ctx context.Context) (string, error) {
	c.tokenMu.RLock()
	token := c.token
	expiry := c.tokenExpiry
	c.tokenMu.RUnlock()

	if token != "" && time.Now().Before(expiry.Add(-30*time.Second)) {
		return token, nil
	}

	c.log.Debug("usage stats: token expired or missing, authenticating")

	if err := c.authenticate(ctx); err != nil {
		return "", err
	}

	c.tokenMu.RLock()
	token = c.token
	c.tokenMu.RUnlock()

	return token, nil
}
