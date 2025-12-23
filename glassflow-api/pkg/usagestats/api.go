package usagestats

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"time"
)

func (c *Client) authenticate(ctx context.Context) error {
	url := fmt.Sprintf("%s/auth/login", c.endpoint)

	reqBody := map[string]string{
		"username": c.username,
		"password": c.password,
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		if c.log != nil && c.log.Enabled(ctx, slog.LevelDebug) {
			c.log.Debug("usage stats auth: failed to marshal request", "error", err)
		}
		return fmt.Errorf("marshal auth request: %w", err)
	}

	if c.log != nil && c.log.Enabled(ctx, slog.LevelDebug) {
		c.log.Debug("usage stats auth: sending authentication request", "url", url, "endpoint", c.endpoint)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		if c.log != nil && c.log.Enabled(ctx, slog.LevelDebug) {
			c.log.Debug("usage stats auth: failed to create request", "error", err)
		}
		return fmt.Errorf("create auth request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("accept", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		if c.log != nil && c.log.Enabled(ctx, slog.LevelDebug) {
			c.log.Debug("usage stats auth: request failed", "error", err, "url", url)
		}
		return fmt.Errorf("auth request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		err := fmt.Errorf("auth failed with status %d: %s", resp.StatusCode, string(body))
		if c.log != nil && c.log.Enabled(ctx, slog.LevelDebug) {
			c.log.Debug("usage stats auth: authentication failed", "status", resp.StatusCode, "response", string(body), "error", err)
		}
		return err
	}

	var authResp AuthResponse
	if err := json.NewDecoder(resp.Body).Decode(&authResp); err != nil {
		if c.log != nil && c.log.Enabled(ctx, slog.LevelDebug) {
			c.log.Debug("usage stats auth: failed to decode response", "error", err)
		}
		return fmt.Errorf("decode auth response: %w", err)
	}

	c.tokenMu.Lock()
	c.token = authResp.AccessToken
	c.tokenExpiry = time.Now().Add(time.Duration(authResp.ExpiresIn) * time.Second)
	c.tokenMu.Unlock()

	if c.log != nil && c.log.Enabled(ctx, slog.LevelDebug) {
		c.log.Debug("usage stats auth: authentication successful", "token_expires_in", authResp.ExpiresIn)
	}

	return nil
}

func (c *Client) sendEventSync(ctx context.Context, eventName, eventSource string, properties map[string]interface{}) error {
	token, err := c.getToken(ctx)
	if err != nil {
		if c.log != nil && c.log.Enabled(ctx, slog.LevelDebug) {
			c.log.Debug("usage stats: failed to get token", "event", eventName, "error", err)
		}
		return fmt.Errorf("get token: %w", err)
	}

	if properties == nil {
		properties = make(map[string]interface{})
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
			c.log.Debug("usage stats: failed to marshal event", "event", eventName, "error", err)
		}
		return fmt.Errorf("marshal event: %w", err)
	}

	url := fmt.Sprintf("%s/track", c.endpoint)

	if c.log != nil && c.log.Enabled(ctx, slog.LevelDebug) {
		c.log.Debug("usage stats: sending event request", "url", url, "event", eventName, "installation_id", c.installationID, "payload_size", len(jsonData))
	}

	maxRetries := 3
	for attempt := 1; attempt <= maxRetries; attempt++ {
		if attempt > 1 && c.log != nil && c.log.Enabled(ctx, slog.LevelDebug) {
			c.log.Debug("usage stats: retrying event send", "event", eventName, "attempt", attempt, "max_retries", maxRetries)
		}

		req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonData))
		if err != nil {
			if c.log != nil && c.log.Enabled(ctx, slog.LevelDebug) {
				c.log.Debug("usage stats: failed to create request", "event", eventName, "error", err)
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
					c.log.Debug("usage stats: request failed, will retry", "event", eventName, "attempt", attempt, "error", err, "retry_after", attempt)
				}
				time.Sleep(time.Duration(attempt) * time.Second)
				continue
			}
			if c.log != nil && c.log.Enabled(ctx, slog.LevelDebug) {
				c.log.Debug("usage stats: request failed after max retries", "event", eventName, "attempt", attempt, "error", err)
			}
			return fmt.Errorf("request failed: %w", err)
		}

		if resp.StatusCode == http.StatusUnauthorized {
			if c.log != nil && c.log.Enabled(ctx, slog.LevelDebug) {
				c.log.Debug("usage stats: received unauthorized, re-authenticating", "event", eventName, "attempt", attempt)
			}
			resp.Body.Close()

			if err := c.authenticate(ctx); err != nil {
				if c.log != nil && c.log.Enabled(ctx, slog.LevelDebug) {
					c.log.Debug("usage stats: re-authentication failed", "event", eventName, "error", err)
				}
				return fmt.Errorf("re-authenticate: %w", err)
			}

			token, err = c.getToken(ctx)
			if err != nil {
				if c.log != nil && c.log.Enabled(ctx, slog.LevelDebug) {
					c.log.Debug("usage stats: failed to get new token after re-auth", "event", eventName, "error", err)
				}
				return fmt.Errorf("get new token: %w", err)
			}

			req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
			resp, err = c.httpClient.Do(req)
			if err != nil {
				if attempt < maxRetries {
					if c.log != nil && c.log.Enabled(ctx, slog.LevelDebug) {
						c.log.Debug("usage stats: retry request failed, will retry again", "event", eventName, "attempt", attempt, "error", err)
					}
					time.Sleep(time.Duration(attempt) * time.Second)
					continue
				}
				if c.log != nil && c.log.Enabled(ctx, slog.LevelDebug) {
					c.log.Debug("usage stats: retry request failed after max retries", "event", eventName, "attempt", attempt, "error", err)
				}
				return fmt.Errorf("retry request failed: %w", err)
			}
		}

		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			body, _ := io.ReadAll(resp.Body)
			if attempt < maxRetries {
				if c.log != nil && c.log.Enabled(ctx, slog.LevelDebug) {
					c.log.Debug("usage stats: non-OK status, will retry", "event", eventName, "status", resp.StatusCode, "response", string(body), "attempt", attempt)
				}
				time.Sleep(time.Duration(attempt) * time.Second)
				continue
			}
			if c.log != nil && c.log.Enabled(ctx, slog.LevelDebug) {
				c.log.Debug("usage stats: failed after max retries", "event", eventName, "status", resp.StatusCode, "response", string(body), "attempt", attempt)
			}
			return fmt.Errorf("usage stats failed with status %d: %s", resp.StatusCode, string(body))
		}

		var trackResp TrackResponse
		if err := json.NewDecoder(resp.Body).Decode(&trackResp); err != nil {
			if c.log != nil && c.log.Enabled(ctx, slog.LevelDebug) {
				c.log.Debug("usage stats: failed to decode response", "event", eventName, "error", err)
			}
			return fmt.Errorf("decode response: %w", err)
		}

		if c.log != nil && c.log.Enabled(ctx, slog.LevelDebug) {
			c.log.Debug("usage stats: event sent successfully", "event", eventName, "response", trackResp, "status", resp.StatusCode)
		}

		return nil
	}

	if c.log != nil && c.log.Enabled(ctx, slog.LevelDebug) {
		c.log.Debug("usage stats: max retries exceeded", "event", eventName, "max_retries", maxRetries)
	}
	return fmt.Errorf("max retries exceeded")
}

type AuthResponse struct {
	AccessToken string `json:"access_token"`
	TokenType   string `json:"token_type"`
	ExpiresIn   int    `json:"expires_in"`
}

type TrackResponse struct {
	Success    bool   `json:"success"`
	Message    string `json:"message"`
	EventCount int    `json:"event_count"`
}
