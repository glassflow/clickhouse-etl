package api

import (
	"log/slog"
	"net/http"

	"github.com/gorilla/mux"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/pkg/observability"
)

type handler struct {
	log *slog.Logger

	pipelineService PipelineService
	dlqSvc          DLQ
}

func NewRouter(
	log *slog.Logger,
	pipelineService PipelineService,
	dlqService DLQ,
	meter *observability.Meter,
) http.Handler {
	r := mux.NewRouter()

	h := handler{
		log:             log,
		pipelineService: pipelineService,
		dlqSvc:          dlqService,
	}

	r.HandleFunc("/api/v1/healthz", h.healthz).Methods("GET")
	r.HandleFunc("/api/v1/platform", h.platform).Methods("GET")
	r.HandleFunc("/api/v1/pipeline", h.createPipeline).Methods("POST")
	r.HandleFunc("/api/v1/pipeline/{id}", h.getPipeline).Methods("GET")
	r.HandleFunc("/api/v1/pipeline/{id}", h.updatePipelineName).Methods("PATCH")
	r.HandleFunc("/api/v1/pipeline/{id}", h.deletePipeline).Methods("DELETE")
	r.HandleFunc("/api/v1/pipeline", h.getPipelines).Methods("GET")
	r.HandleFunc("/api/v1/pipeline/{id}/health", h.getPipelineHealth).Methods("GET")
	r.HandleFunc("/api/v1/pipeline/{id}/dlq/consume", h.consumeDLQ).Methods("GET")
	r.HandleFunc("/api/v1/pipeline/{id}/dlq/state", h.getDLQState).Methods("GET")
	r.HandleFunc("/api/v1/pipeline/{id}/dlq/purge", h.purgeDLQ).Methods("POST")
	r.HandleFunc("/api/v1/pipeline/{id}/resume", h.resumePipeline).Methods("POST")
	r.HandleFunc("/api/v1/pipeline/{id}/stop", h.stopPipeline).Methods("POST")
	r.HandleFunc("/api/v1/pipeline/{id}/terminate", h.terminatePipeline).Methods("POST")
	r.HandleFunc("/api/v1/pipeline/{id}/edit", h.editPipeline).Methods("POST")

	r.HandleFunc("/ui-api/pipeline", h.createPipeline).Methods("POST")
	r.HandleFunc("/ui-api/pipeline/{id}", h.getPipeline).Methods("GET")
	r.HandleFunc("/ui-api/pipeline/{id}", h.updatePipelineName).Methods("PATCH")
	r.HandleFunc("/ui-api/pipeline/{id}", h.deletePipeline).Methods("DELETE")
	r.HandleFunc("/ui-api/pipeline", h.getPipelines).Methods("GET")
	r.HandleFunc("/ui-api/pipeline/pipeline/", h.getPipelines).Methods("GET")
	r.HandleFunc("/ui-api/pipeline/{id}/health", h.getPipelineHealth).Methods("GET")
	r.HandleFunc("/ui-api/pipeline/{id}/dlq/consume", h.consumeDLQ).Methods("GET")
	r.HandleFunc("/ui-api/pipeline/{id}/dlq/state", h.getDLQState).Methods("GET")
	r.HandleFunc("/ui-api/pipeline/{id}/dlq/purge", h.purgeDLQ).Methods("POST")
	r.HandleFunc("/ui-api/pipeline/{id}/resume", h.resumePipeline).Methods("POST")
	r.HandleFunc("/ui-api/pipeline/{id}/stop", h.stopPipeline).Methods("POST")
	r.HandleFunc("/ui-api/pipeline/{id}/terminate", h.terminatePipeline).Methods("POST")
	r.HandleFunc("/ui-api/pipeline/{id}/edit", h.editPipeline).Methods("POST")

	// UI API routes for ClickHouse and Kafka browsing (no /api/v1 prefix to match static UI calls)
	r.HandleFunc("/ui-api/healthz", h.healthz).Methods("GET")
	r.HandleFunc("/ui-api/healthz/healthz/", h.healthz).Methods("GET")
	r.HandleFunc("/ui-api/platform", h.platform).Methods("GET")
	r.HandleFunc("/ui-api/platform/platform/", h.platform).Methods("GET")
	r.HandleFunc("/ui-api/clickhouse/databases", h.clickhouseDatabases).Methods("POST")
	r.HandleFunc("/ui-api/clickhouse/tables", h.clickhouseTables).Methods("POST")
	r.HandleFunc("/ui-api/clickhouse/schema", h.clickhouseSchema).Methods("POST")
	r.HandleFunc("/ui-api/clickhouse/test-connection", h.clickhouseTestConnection).Methods("POST")
	//r.HandleFunc("/ui-api/kafka", h.kafkaTestConnection).Methods("GET")
	r.HandleFunc("/ui-api/kafka", h.kafkaTestConnection).Methods("POST")
	//r.HandleFunc("/ui-api/kafka/", h.kafkaTestConnection).Methods("GET")
	r.HandleFunc("/ui-api/kafka/", h.kafkaTestConnection).Methods("POST")
	r.HandleFunc("/ui-api/kafka/topics", h.kafkaTopics).Methods("POST")
	r.HandleFunc("/ui-api/kafka/topic-details", h.kafkaTopicDetails).Methods("POST")
	r.HandleFunc("/ui-api/kafka/events", h.kafkaEvents).Methods("POST")

	r.Use(Recovery(log), RequestLogging(log), RequestMetrics(meter))

	return r
}
