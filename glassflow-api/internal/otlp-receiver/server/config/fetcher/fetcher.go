package fetcher

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

type Fetcher struct {
	baseURL string
}

func New(baseURL string) *Fetcher {
	return &Fetcher{baseURL: baseURL}
}

func (f *Fetcher) GetOTLPConfig(
	ctx context.Context,
	pipelineID string,
) (models.OTLPConfig, error) {
	url := fmt.Sprintf("%s/internal/pipelines/%s/otlp-config", f.baseURL, pipelineID)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return models.OTLPConfig{}, fmt.Errorf("create request: %w", err)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return models.OTLPConfig{}, fmt.Errorf("fetch otlp config: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return models.OTLPConfig{}, fmt.Errorf("unexpected status %d", resp.StatusCode)
	}

	var config models.OTLPConfig
	if err := json.NewDecoder(resp.Body).Decode(&config); err != nil {
		return models.OTLPConfig{}, fmt.Errorf("decode response: %w", err)
	}

	return config, nil
}
