package tracking

import (
	"bytes"
	"context"
	"crypto/md5"
	"encoding/json"
	"fmt"
	"io"
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

type AuthResponse struct {
	AccessToken string `json:"access_token"`
	TokenType   string `json:"token_type"`
	ExpiresIn   int    `json:"expires_in"`
}

type Event struct {
	InstallationID string                 `json:"installation_id"`
	EventName      string                 `json:"event_name"`
	EventSource    string                 `json:"event_source"`
	Timestamp      string                 `json:"timestamp"`
	Properties     map[string]interface{} `json:"properties"`
}

type TrackResponse struct {
	Success    bool   `json:"success"`
	Message    string `json:"message"`
	EventCount int    `json:"event_count"`
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

func (c *Client) authenticate(ctx context.Context) error {
	url := fmt.Sprintf("%s/auth/login", c.endpoint)

	reqBody := map[string]string{
		"username": c.username,
		"password": c.password,
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		if c.log != nil && c.log.Enabled(ctx, slog.LevelDebug) {
			c.log.Debug("tracking auth: failed to marshal request", "error", err)
		}
		return fmt.Errorf("marshal auth request: %w", err)
	}

	if c.log != nil && c.log.Enabled(ctx, slog.LevelDebug) {
		c.log.Debug("tracking auth: sending authentication request", "url", url, "endpoint", c.endpoint)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		if c.log != nil && c.log.Enabled(ctx, slog.LevelDebug) {
			c.log.Debug("tracking auth: failed to create request", "error", err)
		}
		return fmt.Errorf("create auth request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("accept", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		if c.log != nil && c.log.Enabled(ctx, slog.LevelDebug) {
			c.log.Debug("tracking auth: request failed", "error", err, "url", url)
		}
		return fmt.Errorf("auth request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		err := fmt.Errorf("auth failed with status %d: %s", resp.StatusCode, string(body))
		if c.log != nil && c.log.Enabled(ctx, slog.LevelDebug) {
			c.log.Debug("tracking auth: authentication failed", "status", resp.StatusCode, "response", string(body), "error", err)
		}
		return err
	}

	var authResp AuthResponse
	if err := json.NewDecoder(resp.Body).Decode(&authResp); err != nil {
		if c.log != nil && c.log.Enabled(ctx, slog.LevelDebug) {
			c.log.Debug("tracking auth: failed to decode response", "error", err)
		}
		return fmt.Errorf("decode auth response: %w", err)
	}

	c.tokenMu.Lock()
	c.token = authResp.AccessToken
	c.tokenExpiry = time.Now().Add(time.Duration(authResp.ExpiresIn) * time.Second)
	c.tokenMu.Unlock()

	if c.log != nil && c.log.Enabled(ctx, slog.LevelDebug) {
		c.log.Debug("tracking auth: authentication successful", "token_expires_in", authResp.ExpiresIn)
	}

	return nil
}

func (c *Client) getToken(ctx context.Context) (string, error) {
	c.tokenMu.RLock()
	token := c.token
	expiry := c.tokenExpiry
	c.tokenMu.RUnlock()

	if token != "" && time.Now().Before(expiry.Add(-30*time.Second)) {
		if c.log != nil && c.log.Enabled(ctx, slog.LevelDebug) {
			c.log.Debug("tracking: using cached token", "expires_at", expiry)
		}
		return token, nil
	}

	if c.log != nil && c.log.Enabled(ctx, slog.LevelDebug) {
		c.log.Debug("tracking: token expired or missing, authenticating")
	}

	if err := c.authenticate(ctx); err != nil {
		if c.log != nil && c.log.Enabled(ctx, slog.LevelDebug) {
			c.log.Debug("tracking: authentication failed", "error", err)
		}
		return "", err
	}

	c.tokenMu.RLock()
	token = c.token
	c.tokenMu.RUnlock()

	return token, nil
}

func (c *Client) SendEvent(ctx context.Context, eventName, eventSource string, properties map[string]interface{}) {
	if !c.enabled {
		return
	}

	if c.log != nil && c.log.Enabled(ctx, slog.LevelDebug) {
		c.log.Debug("tracking: sending event", "event", eventName, "source", eventSource, "properties", properties)
	}

	go func() {
		if err := c.sendEventSync(ctx, eventName, eventSource, properties); err != nil {
			if c.log != nil {
				c.log.Debug("tracking event send failed", "event", eventName, "source", eventSource, "error", err)
			}
		} else if c.log != nil && c.log.Enabled(ctx, slog.LevelDebug) {
			c.log.Debug("tracking: event sent successfully", "event", eventName, "source", eventSource)
		}
	}()
}

func (c *Client) sendEventSync(ctx context.Context, eventName, eventSource string, properties map[string]interface{}) error {
	token, err := c.getToken(ctx)
	if err != nil {
		if c.log != nil && c.log.Enabled(ctx, slog.LevelDebug) {
			c.log.Debug("tracking: failed to get token", "event", eventName, "error", err)
		}
		return fmt.Errorf("get token: %w", err)
	}

	event := Event{
		InstallationID: c.installationID,
		EventName:      eventName,
		EventSource:    eventSource,
		Timestamp:      time.Now().UTC().Format(time.RFC3339),
		Properties:     properties,
	}

	jsonData, err := json.Marshal(event)
	if err != nil {
		if c.log != nil && c.log.Enabled(ctx, slog.LevelDebug) {
			c.log.Debug("tracking: failed to marshal event", "event", eventName, "error", err)
		}
		return fmt.Errorf("marshal event: %w", err)
	}

	url := fmt.Sprintf("%s/track", c.endpoint)

	if c.log != nil && c.log.Enabled(ctx, slog.LevelDebug) {
		c.log.Debug("tracking: sending event request", "url", url, "event", eventName, "installation_id", c.installationID, "payload_size", len(jsonData))
	}

	maxRetries := 3
	for attempt := 1; attempt <= maxRetries; attempt++ {
		if attempt > 1 && c.log != nil && c.log.Enabled(ctx, slog.LevelDebug) {
			c.log.Debug("tracking: retrying event send", "event", eventName, "attempt", attempt, "max_retries", maxRetries)
		}

		req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonData))
		if err != nil {
			if c.log != nil && c.log.Enabled(ctx, slog.LevelDebug) {
				c.log.Debug("tracking: failed to create request", "event", eventName, "error", err)
			}
			return fmt.Errorf("create request: %w", err)
		}

		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("accept", "application/json")
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))

		resp, err := c.httpClient.Do(req)
		if err != nil {
			if attempt < maxRetries {
				if c.log != nil && c.log.Enabled(ctx, slog.LevelDebug) {
					c.log.Debug("tracking: request failed, will retry", "event", eventName, "attempt", attempt, "error", err, "retry_after", attempt)
				}
				time.Sleep(time.Duration(attempt) * time.Second)
				continue
			}
			if c.log != nil && c.log.Enabled(ctx, slog.LevelDebug) {
				c.log.Debug("tracking: request failed after max retries", "event", eventName, "attempt", attempt, "error", err)
			}
			return fmt.Errorf("request failed: %w", err)
		}

		if resp.StatusCode == http.StatusUnauthorized {
			if c.log != nil && c.log.Enabled(ctx, slog.LevelDebug) {
				c.log.Debug("tracking: received unauthorized, re-authenticating", "event", eventName, "attempt", attempt)
			}
			resp.Body.Close()

			if err := c.authenticate(ctx); err != nil {
				if c.log != nil && c.log.Enabled(ctx, slog.LevelDebug) {
					c.log.Debug("tracking: re-authentication failed", "event", eventName, "error", err)
				}
				return fmt.Errorf("re-authenticate: %w", err)
			}

			token, err = c.getToken(ctx)
			if err != nil {
				if c.log != nil && c.log.Enabled(ctx, slog.LevelDebug) {
					c.log.Debug("tracking: failed to get new token after re-auth", "event", eventName, "error", err)
				}
				return fmt.Errorf("get new token: %w", err)
			}

			req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
			resp, err = c.httpClient.Do(req)
			if err != nil {
				if attempt < maxRetries {
					if c.log != nil && c.log.Enabled(ctx, slog.LevelDebug) {
						c.log.Debug("tracking: retry request failed, will retry again", "event", eventName, "attempt", attempt, "error", err)
					}
					time.Sleep(time.Duration(attempt) * time.Second)
					continue
				}
				if c.log != nil && c.log.Enabled(ctx, slog.LevelDebug) {
					c.log.Debug("tracking: retry request failed after max retries", "event", eventName, "attempt", attempt, "error", err)
				}
				return fmt.Errorf("retry request failed: %w", err)
			}
		}

		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			body, _ := io.ReadAll(resp.Body)
			if attempt < maxRetries {
				if c.log != nil && c.log.Enabled(ctx, slog.LevelDebug) {
					c.log.Debug("tracking: non-OK status, will retry", "event", eventName, "status", resp.StatusCode, "response", string(body), "attempt", attempt)
				}
				time.Sleep(time.Duration(attempt) * time.Second)
				continue
			}
			if c.log != nil && c.log.Enabled(ctx, slog.LevelDebug) {
				c.log.Debug("tracking: failed after max retries", "event", eventName, "status", resp.StatusCode, "response", string(body), "attempt", attempt)
			}
			return fmt.Errorf("tracking failed with status %d: %s", resp.StatusCode, string(body))
		}

		var trackResp TrackResponse
		if err := json.NewDecoder(resp.Body).Decode(&trackResp); err != nil {
			if c.log != nil && c.log.Enabled(ctx, slog.LevelDebug) {
				c.log.Debug("tracking: failed to decode response", "event", eventName, "error", err)
			}
			return fmt.Errorf("decode response: %w", err)
		}

		if c.log != nil && c.log.Enabled(ctx, slog.LevelDebug) {
			c.log.Debug("tracking: event sent successfully", "event", eventName, "response", trackResp, "status", resp.StatusCode)
		}

		return nil
	}

	if c.log != nil && c.log.Enabled(ctx, slog.LevelDebug) {
		c.log.Debug("tracking: max retries exceeded", "event", eventName, "max_retries", maxRetries)
	}
	return fmt.Errorf("max retries exceeded")
}

func HashPipelineID(pipelineID string) string {
	hash := md5.Sum([]byte(pipelineID))
	return fmt.Sprintf("%x", hash)
}
