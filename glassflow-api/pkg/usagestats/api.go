package usagestats

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/avast/retry-go/v4"
)

func (c *Client) authenticate(ctx context.Context) error {
	url := fmt.Sprintf("%s/auth/login", c.endpoint)

	reqBody := map[string]string{
		"username": c.username,
		"password": c.password,
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return err
	}

	c.log.Debug("usage stats auth: sending authentication request", "url", url, "endpoint", c.endpoint)

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("create auth request: %s", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("accept", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("auth request failed: %s", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		err = fmt.Errorf("auth failed with status %d: %s", resp.StatusCode, string(body))
		return err
	}

	var authResp AuthResponse
	if err = json.NewDecoder(resp.Body).Decode(&authResp); err != nil {
		return fmt.Errorf("decode auth response: %s", err)
	}

	c.tokenMu.Lock()
	c.token = authResp.AccessToken
	c.tokenExpiry = time.Now().Add(time.Duration(authResp.ExpiresIn) * time.Second)
	c.tokenMu.Unlock()

	c.log.Debug("usage stats auth: authentication successful", "token_expires_in", authResp.ExpiresIn)

	return nil
}

func (c *Client) sendEventSync(ctx context.Context, eventName, eventSource string, properties map[string]interface{}) error {

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
		return fmt.Errorf("marshal event: %s", err)
	}

	url := fmt.Sprintf("%s/track", c.endpoint)

	c.log.Debug("usage stats: sending event request")

	err = retry.Do(func() error {
		token, err := c.getToken(ctx)
		if err != nil {
			return fmt.Errorf("get token: %s", err)
		}

		req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonData))
		if err != nil {
			return fmt.Errorf("create request: %s", err)
		}

		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("accept", "application/json")
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))

		resp, err := c.httpClient.Do(req)
		if err != nil {
			return fmt.Errorf("request failed: %s", err)
		}

		defer resp.Body.Close()
		if resp.StatusCode != http.StatusOK {
			body, _ := io.ReadAll(resp.Body)
			return fmt.Errorf("usage stats failed with status %d: %s", resp.StatusCode, string(body))
		}

		var trackResp TrackResponse
		if err := json.NewDecoder(resp.Body).Decode(&trackResp); err != nil {
			return fmt.Errorf("decode response: %s", err)
		}

		c.log.Debug("usage stats: event sent successfully", "event", eventName, "response", trackResp, "status", resp.StatusCode)

		return nil
	},
		retry.OnRetry(func(n uint, err error) {
			c.log.Debug("usage stats: retrying event send", "event", eventName, "attempt", n+1, "error", err)
		}),
		retry.Attempts(retryAttempts),
		retry.Delay(retryDelay),
		retry.DelayType(retry.BackOffDelay),
		retry.LastErrorOnly(true),
	)

	return err
}

const (
	retryAttempts = 3
	retryDelay    = 10 * time.Second
)

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
