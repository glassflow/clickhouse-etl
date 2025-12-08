package service

import (
	"context"
	"log/slog"
	"time"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/client"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/dlq"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/pkg/tracking"
)

type MetricsTracker struct {
	db             PipelineStore
	nc             *client.NATSClient
	dlqClient      *dlq.Client
	trackingClient *tracking.Client
	log            *slog.Logger
	interval       time.Duration
}

func NewMetricsTracker(
	db PipelineStore,
	nc *client.NATSClient,
	dlqClient *dlq.Client,
	trackingClient *tracking.Client,
	log *slog.Logger,
) *MetricsTracker {
	return &MetricsTracker{
		db:             db,
		nc:             nc,
		dlqClient:      dlqClient,
		trackingClient: trackingClient,
		log:            log,
		interval:       5 * time.Minute,
	}
}

func (m *MetricsTracker) Start(ctx context.Context) {
	if m.trackingClient == nil || !m.trackingClient.IsEnabled() {
		return
	}

	ticker := time.NewTicker(m.interval)
	defer ticker.Stop()

	m.sendMetrics(ctx)

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			m.sendMetrics(ctx)
		}
	}
}

func (m *MetricsTracker) sendMetrics(ctx context.Context) {
	pipelines, err := m.db.GetPipelines(ctx)
	if err != nil {
		m.log.Debug("failed to get pipelines for metrics tracking", "error", err)
		return
	}

	for _, pipeline := range pipelines {
		m.sendPipelineMetrics(ctx, pipeline)
	}
}

func (m *MetricsTracker) sendPipelineMetrics(ctx context.Context, pipeline models.PipelineConfig) {
	js := m.nc.JetStream()
	pipelineID := pipeline.ID

	// Helper function to get stream metrics
	getStreamMetrics := func(streamName string) map[string]interface{} {
		metrics := map[string]interface{}{
			"message_count": 0,
			"size":          0,
			"last_received": nil,
		}

		if streamName == "" {
			return metrics
		}

		stream, err := js.Stream(ctx, streamName)
		if err == nil {
			info, err := stream.Info(ctx)
			if err == nil {
				metrics["message_count"] = info.State.Msgs
				metrics["size"] = info.State.Bytes
				if !info.State.LastTime.IsZero() {
					metrics["last_received"] = info.State.LastTime.Format(time.RFC3339)
				}
			}
		}

		return metrics
	}

	// Collect ingestor stream metrics
	ingestorMetrics := []map[string]interface{}{}
	for _, topic := range pipeline.Ingestor.KafkaTopics {
		streamName := topic.OutputStreamID
		if streamName == "" {
			// If OutputStreamID is not present, send null
			ingestorMetrics = append(ingestorMetrics, map[string]interface{}{
				"topic_name":    topic.Name,
				"stream_name":   nil,
				"message_count": nil,
				"size":          nil,
				"last_received": nil,
			})
		} else {
			metrics := getStreamMetrics(streamName)
			metrics["topic_name"] = topic.Name
			metrics["stream_name"] = streamName
			ingestorMetrics = append(ingestorMetrics, metrics)
		}
	}

	// Collect dedup stream metrics
	dedupMetrics := []map[string]interface{}{}
	for _, topic := range pipeline.Ingestor.KafkaTopics {
		if !topic.Deduplication.Enabled {
			continue
		}

		streamName := models.GetDedupOutputStreamName(pipelineID, topic.Name)
		if streamName == "" {
			// If stream name cannot be generated, send null
			dedupMetrics = append(dedupMetrics, map[string]interface{}{
				"topic_name":    topic.Name,
				"stream_name":   nil,
				"message_count": nil,
				"size":          nil,
				"last_received": nil,
			})
		} else {
			metrics := getStreamMetrics(streamName)
			metrics["topic_name"] = topic.Name
			metrics["stream_name"] = streamName
			dedupMetrics = append(dedupMetrics, metrics)
		}
	}

	// Collect join stream metrics (only if join is enabled)
	var joinMetrics map[string]interface{}
	if pipeline.Join.Enabled {
		joinedStreamName := models.GetJoinedStreamName(pipelineID)
		joinMetrics = getStreamMetrics(joinedStreamName)
		joinMetrics["stream_name"] = joinedStreamName
	} else {
		joinMetrics = nil
	}

	// Collect DLQ stream metrics
	dlqStreamName := models.GetDLQStreamName(pipelineID)
	dlqMetrics := map[string]interface{}{
		"message_count": 0,
		"size":          0,
		"last_received": nil,
		"pending":       0,
		"unacked":       0,
	}

	dlqStream, err := js.Stream(ctx, dlqStreamName)
	if err == nil {
		dlqInfo, err := dlqStream.Info(ctx)
		if err == nil {
			dlqMetrics["message_count"] = dlqInfo.State.Msgs
			dlqMetrics["size"] = dlqInfo.State.Bytes
			if !dlqInfo.State.LastTime.IsZero() {
				dlqMetrics["last_received"] = dlqInfo.State.LastTime.Format(time.RFC3339)
			}

			consumer, err := dlqStream.Consumer(ctx, dlqStreamName+"-consumer")
			if err == nil {
				consumerInfo, err := consumer.Info(ctx)
				if err == nil {
					dlqMetrics["pending"] = consumerInfo.NumPending
					dlqMetrics["unacked"] = consumerInfo.NumAckPending
				}
			}
		}
	}

	m.trackingClient.SendEvent(ctx, "pipeline_metrics", "api", map[string]interface{}{
		"pipeline_id_hash": tracking.HashPipelineID(pipelineID),
		"ingestor_metrics": ingestorMetrics,
		"dedup_metrics":    dedupMetrics,
		"join_metrics":     joinMetrics,
		"dlq_metrics":      dlqMetrics,
	})
}
