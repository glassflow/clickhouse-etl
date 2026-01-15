package usagestats

import (
	"context"
	"crypto/md5"
	"fmt"
	"log/slog"
	"net/http"
	"sync"
	"time"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

// PipelineGetter is a minimal interface for fetching pipeline configurations
type PipelineGetter interface {
	GetPipeline(ctx context.Context, pid string) (*models.PipelineConfig, error)
}

// PipelineEvent represents an API operation event that needs usage stats tracking
type PipelineEvent struct {
	PipelineID string
	EventName  string // huma OperationID (e.g., "create-pipeline", "delete-pipeline")
}

type Client struct {
	endpoint       string
	username       string
	password       string
	installationID string

	token       string
	tokenExpiry time.Time
	tokenMu     sync.RWMutex

	httpClient    *http.Client
	log           *slog.Logger
	enabled       bool
	pipelineStore PipelineGetter
	eventChan     chan PipelineEvent
}

type Event struct {
	InstallationID string                 `json:"installation_id"`
	EventName      string                 `json:"event_name"`
	EventSource    string                 `json:"event_source"`
	Timestamp      string                 `json:"timestamp"`
	Properties     map[string]interface{} `json:"properties"`
}

func NewClient(endpoint, username, password, installationID string, enabled bool, log *slog.Logger, pipelineStore PipelineGetter) *Client {
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
		log:           log,
		enabled:       true,
		pipelineStore: pipelineStore,
		eventChan:     make(chan PipelineEvent, 100), // buffered channel
	}
}

// GetEventChannel returns the event channel for external consumption
func (c *Client) GetEventChannel() <-chan PipelineEvent {
	return c.eventChan
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
		usageStatsCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
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

// RecordPipelineEvent records a pipeline operation event for async processing
func (c *Client) RecordPipelineEvent(pipelineID, eventName string) {
	if c == nil || !c.enabled {
		return
	}

	select {
	case c.eventChan <- PipelineEvent{PipelineID: pipelineID, EventName: eventName}:
		c.log.Debug("usage stats: pipeline event queued", "pipeline_id", pipelineID, "event", eventName)
	default:
		c.log.Debug("usage stats: channel full, dropping event", "pipeline_id", pipelineID, "event", eventName)
	}
}

// checkTransformations checks if the pipeline has deduplication, join, filter, or stateless transformation
func (c *Client) checkTransformations(cfg *models.PipelineConfig) (hasDedup, hasJoin, hasFilter, hasStatelessTransform bool) {
	for _, topic := range cfg.Ingestor.KafkaTopics {
		if topic.Deduplication.Enabled {
			hasDedup = true
			break
		}
	}

	hasJoin = cfg.Join.Enabled
	hasFilter = cfg.Filter.Enabled
	hasStatelessTransform = cfg.StatelessTransformation.Enabled

	return hasDedup, hasJoin, hasFilter, hasStatelessTransform
}

// buildPipelineEventProperties builds the properties map for a pipeline event
func (c *Client) buildPipelineEventProperties(cfg *models.PipelineConfig, pipelineID string) map[string]interface{} {
	hasDedup, hasJoin, hasFilter, hasStatelessTransform := c.checkTransformations(cfg)

	chBatchSize := 0
	chSyncDelay := ""
	if cfg.Sink.Batch.MaxBatchSize > 0 {
		chBatchSize = cfg.Sink.Batch.MaxBatchSize
	}
	if cfg.Sink.Batch.MaxDelayTime.Duration() > 0 {
		chSyncDelay = cfg.Sink.Batch.MaxDelayTime.String()
	}

	properties := map[string]interface{}{
		"pipeline_id_hash":        MaskPipelineID(pipelineID),
		"has_dedup":               hasDedup,
		"has_join":                hasJoin,
		"has_filter":              hasFilter,
		"has_stateless_transform": hasStatelessTransform,
		"ch_batch_size":           chBatchSize,
		"ch_sync_delay":           chSyncDelay,
	}

	// Add ingestor replica counts for each topic
	for i, topic := range cfg.Ingestor.KafkaTopics {
		replicaKey := fmt.Sprintf("ingestor_replicas_t%d", i+1)
		properties[replicaKey] = topic.Replicas
	}

	return properties
}

// ProcessPipelineEvent processes a pipeline event by fetching pipeline data and sending usage stats
func (c *Client) ProcessPipelineEvent(ctx context.Context, event PipelineEvent) {
	if c == nil || !c.enabled {
		return
	}

	// For delete-pipeline event, skip DB lookup and send event with only pipeline_id_hash
	if event.EventName == "delete-pipeline" {
		properties := map[string]interface{}{
			"pipeline_id_hash": MaskPipelineID(event.PipelineID),
		}
		c.SendEvent(event.EventName, "api", properties)
		c.log.Debug("usage stats: processed delete pipeline event", "pipeline_id", event.PipelineID)
		return
	}

	// For other events, fetch pipeline from DB
	if c.pipelineStore == nil {
		c.log.Debug("usage stats: pipeline store not available, skipping event", "pipeline_id", event.PipelineID, "event", event.EventName)
		return
	}

	pipeline, err := c.pipelineStore.GetPipeline(ctx, event.PipelineID)
	if err != nil {
		c.log.Debug("usage stats: failed to get pipeline for event", "pipeline_id", event.PipelineID, "event", event.EventName, "error", err)
		return
	}

	properties := c.buildPipelineEventProperties(pipeline, event.PipelineID)
	c.SendEvent(event.EventName, "api", properties)
	c.log.Debug("usage stats: processed pipeline event", "pipeline_id", event.PipelineID, "event", event.EventName)
}
