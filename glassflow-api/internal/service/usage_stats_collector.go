package service

import (
	"context"
	"log/slog"
	"time"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/client"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/dlq"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/pkg/usagestats"
)

type UsageStatsCollector struct {
	db               PipelineStore
	nc               *client.NATSClient
	dlqClient        *dlq.Client
	usageStatsClient *usagestats.Client
	orch             Orchestrator
	log              *slog.Logger
	interval         time.Duration
	eventChan        <-chan usagestats.PipelineEvent
}

func NewUsageStatsCollector(
	db PipelineStore,
	nc *client.NATSClient,
	dlqClient *dlq.Client,
	usageStatsClient *usagestats.Client,
	orch Orchestrator,
	log *slog.Logger,
) *UsageStatsCollector {
	var eventChan <-chan usagestats.PipelineEvent
	if usageStatsClient != nil {
		eventChan = usageStatsClient.GetEventChannel()
	}
	return &UsageStatsCollector{
		db:               db,
		nc:               nc,
		dlqClient:        dlqClient,
		usageStatsClient: usageStatsClient,
		orch:             orch,
		log:              log,
		interval:         10 * time.Minute,
		eventChan:        eventChan,
	}
}

func (m *UsageStatsCollector) Start(ctx context.Context) {
	if m.usageStatsClient == nil || !m.usageStatsClient.IsEnabled() {
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
		case event := <-m.eventChan:
			m.processAPIEvent(ctx, event)
		}
	}
}

func (m *UsageStatsCollector) processAPIEvent(ctx context.Context, event usagestats.PipelineEvent) {
	m.usageStatsClient.ProcessPipelineEvent(ctx, event)
}

func (m *UsageStatsCollector) sendMetrics(ctx context.Context) {
	pipelines, err := m.db.GetPipelines(ctx)
	if err != nil {
		m.log.Debug("failed to get pipelines for metrics usage stats", "error", err)
		return
	}

	for _, pipeline := range pipelines {
		m.sendPipelineMetrics(ctx, pipeline)
	}
}

func (m *UsageStatsCollector) sendPipelineMetrics(ctx context.Context, pipeline models.PipelineConfig) {
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

	// Resolve stream names through the orchestrator so the collector sees what
	// the runtime actually deployed. T13 S-10 / ETL-1066: previously this used
	// the local-mode helpers in models/ unconditionally, which produced the
	// wrong names in K8s production and the collector silently returned zeros.
	streamNames, err := m.orch.GetStreamNames(ctx, pipeline)
	if err != nil {
		m.log.Debug("failed to resolve pipeline stream names for usage stats",
			"pipeline_id", pipelineID, "error", err)
		return
	}

	// Collect ingestor stream metrics
	ingestorMetrics := []map[string]interface{}{}
	for i, streamName := range streamNames.IngestorStreams {
		if streamName == "" {
			// If stream name cannot be determined, send null.
			ingestorMetrics = append(ingestorMetrics, map[string]interface{}{
				"component":     "ingestor",
				"topic_index":   i + 1,
				"message_count": nil,
				"size":          nil,
				"last_received": nil,
			})
		} else {
			metrics := getStreamMetrics(streamName)
			metrics["component"] = "ingestor"
			metrics["topic_index"] = i + 1
			ingestorMetrics = append(ingestorMetrics, metrics)
		}
	}

	// Collect dedup stream metrics
	dedupMetrics := []map[string]interface{}{}
	for _, dedup := range streamNames.DedupStreams {
		if dedup.StreamName == "" {
			dedupMetrics = append(dedupMetrics, map[string]interface{}{
				"component":     "dedup",
				"topic_index":   dedup.TopicIndex + 1,
				"message_count": nil,
				"size":          nil,
				"last_received": nil,
			})
		} else {
			metrics := getStreamMetrics(dedup.StreamName)
			metrics["component"] = "dedup"
			metrics["topic_index"] = dedup.TopicIndex + 1
			dedupMetrics = append(dedupMetrics, metrics)
		}
	}

	// Collect join stream metrics (only if join is enabled)
	var joinMetrics map[string]interface{}
	if streamNames.JoinStream != "" {
		joinMetrics = getStreamMetrics(streamNames.JoinStream)
		joinMetrics["component"] = "join"
	}

	// Collect DLQ stream metrics
	dlqStreamName := streamNames.DLQStream
	dlqMetrics := map[string]interface{}{
		"component":     "dlq",
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

	m.usageStatsClient.SendEvent("pipeline_metrics", "api", map[string]interface{}{
		"pipeline_id_hash": usagestats.MaskPipelineID(pipelineID),
		"ingestor_metrics": ingestorMetrics,
		"dedup_metrics":    dedupMetrics,
		"join_metrics":     joinMetrics,
		"dlq_metrics":      dlqMetrics,
	})
}
