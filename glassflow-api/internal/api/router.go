package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humamux"
	"github.com/gorilla/mux"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/pkg/observability"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/pkg/usagestats"
)

// trackedOperationIDs contains the set of operation IDs that should trigger usage stats tracking
var trackedOperationIDs = map[string]bool{
	"create-pipeline":    true,
	"delete-pipeline":    true,
	"terminate-pipeline": true,
	"resume-pipeline":    true,
	"stop-pipeline":      true,
	"edit-pipeline":      true,
}

type handler struct {
	log *slog.Logger

	pipelineService  PipelineService
	dlqSvc           DLQ
	api              huma.API
	usageStatsClient *usagestats.Client
}

func NewRouter(
	log *slog.Logger,
	pipelineService PipelineService,
	dlqService DLQ,
	meter *observability.Meter,
	usageStatsClient *usagestats.Client,
) http.Handler {
	r := mux.NewRouter()

	config := huma.DefaultConfig("GlassFlow API", "1.0.0")
	config.Info.Description = "GlassFlow ClickHouse ETL API"

	// Remove $schema from all schemas
	// https://github.com/danielgtaylor/huma/issues/428
	config.CreateHooks = nil
	config.OpenAPIPath = ""
	config.DocsPath = ""

	huma.NewError = func(status int, message string, errs ...error) huma.StatusError {
		if len(errs) >= 1 {
			log.Error("error happened", "status", status, "message", message, "errors", errs)
			message = fmt.Sprintf("%s: %s", message, errs[0])
		}
		return &ErrorDetail{
			Status:  status,
			Message: message,
		}
	}

	humaAPI := humamux.New(r, config)

	h := handler{
		log:              log,
		pipelineService:  pipelineService,
		dlqSvc:           dlqService,
		api:              humaAPI,
		usageStatsClient: usageStatsClient,
	}

	// we need to support v1 and v2 for healthz since it's backward incompatible
	// TODO delete v1 when Vlad migrates to v2 on FE
	registerHumaHandler("/api/v2/healthz", h.healthzV2, log, HealthzSwaggerDocs(), humaAPI, h.usageStatsClient)
	registerHumaHandler("/api/v1/platform", h.platform, log, PlatformSwaggerDocs(), humaAPI, h.usageStatsClient)
	registerHumaHandler("/api/v1/pipeline/{id}/dlq/purge", h.purgeDLQ, log, PurgeDLQDocs(), humaAPI, h.usageStatsClient)
	registerHumaHandler("/api/v1/pipeline/{id}/dlq/consume", h.consumeDLQ, log, ConsumeDLQDocs(), humaAPI, h.usageStatsClient)
	registerHumaHandler("/api/v1/pipeline/{id}/dlq/state", h.getDLQState, log, GetDLQStateDocs(), humaAPI, h.usageStatsClient)
	registerHumaHandler("/api/v1/pipeline", h.createPipeline, log, CreatePipelineDocs(), humaAPI, h.usageStatsClient)
	registerHumaHandler("/api/v1/pipeline/{id}/stop", h.stopPipeline, log, StopPipelineDocs(), humaAPI, h.usageStatsClient)
	registerHumaHandler("/api/v1/pipeline/{id}/terminate", h.terminatePipeline, log, TerminatePipelineDocs(), humaAPI, h.usageStatsClient)
	registerHumaHandler("/api/v1/pipeline/{id}/metadata", h.updatePipelineMetadata, log, UpdatePipelineMetadataDocs(), humaAPI, h.usageStatsClient)
	registerHumaHandler("/api/v1/pipeline/{id}/health", h.getPipelineHealth, log, GetPipelineHealthDocs(), humaAPI, h.usageStatsClient)
	registerHumaHandler("/api/v1/filter/validate", h.validateFilter, log, ValidateFilterDocs(), humaAPI, h.usageStatsClient)
	registerHumaHandler("/api/v1/transform/expression/evaluate", h.evaluateTransform, log, EvaluateTransformDocs(), humaAPI, h.usageStatsClient)
	registerHumaHandler("/api/v1/pipeline", h.getPipelines, log, GetPipelinesDocs(), humaAPI, h.usageStatsClient)
	registerHumaHandler("/api/v1/pipeline/{id}/resources", h.getPipelineResources, log, GetPipelineResourcesDocs(), humaAPI, h.usageStatsClient)
	registerHumaHandler("/api/v1/pipeline/{id}/resources", h.updatePipelineResources, log, UpdatePipelineResourcesDocs(), humaAPI, h.usageStatsClient)
	registerHumaHandler("/api/v1/pipeline/{id}", h.getPipeline, log, GetPipelineDocs(), humaAPI, h.usageStatsClient)
	registerHumaHandler("/api/v1/pipeline/{id}", h.updatePipelineName, log, UpdatePipelineNameDocs(), humaAPI, h.usageStatsClient)
	registerHumaHandler("/api/v1/pipeline/{id}", h.deletePipeline, log, DeletePipelineDocs(), humaAPI, h.usageStatsClient)
	registerHumaHandler("/api/v1/pipeline/{id}/resume", h.resumePipeline, log, ResumePipelineDocs(), humaAPI, h.usageStatsClient)
	registerHumaHandler("/api/v1/pipeline/{id}/edit", h.editPipeline, log, EditPipelineDocs(), humaAPI, h.usageStatsClient)

	r.HandleFunc("/api/v1/docs", h.docs)
	r.HandleFunc("/api/v1/openapi.json", h.swaggerDocsJSON)

	r.HandleFunc("/api/v1/healthz", h.healthz).Methods("GET")

	r.Use(Recovery(log), RequestLogging(log), RequestMetrics(meter))

	return r
}

// to log all errors, it's a bit hard to implement it on middleware side
func registerHumaHandler[I, O any](
	path string,
	handler func(context.Context, *I) (*O, error),
	log *slog.Logger,
	op huma.Operation,
	api huma.API,
	usageStatsClient *usagestats.Client,
) {
	op.Path = path
	huma.Register(api, op, func(ctx context.Context, input *I) (*O, error) {
		output, err := handler(ctx, input)
		usageStatsReporting(usageStatsClient, op, input)
		if err == nil {
			return output, nil
		}
		var errDetails *ErrorDetail
		ok := errors.As(err, &errDetails)
		if !ok {
			log.ErrorContext(ctx, err.Error())
			return output, err
		}

		log.ErrorContext(
			ctx,
			errDetails.Error(),
			slog.Any("details", errDetails.Details),
			slog.Any("errors", errDetails.Errors),
			slog.Int("status", errDetails.Status),
		)

		// do we want to expose this to user?
		if errDetails.Status == http.StatusInternalServerError {
			errDetails.Details = nil
			errDetails.Message = "Internal server error"
		}

		return output, err
	})
}

func usageStatsReporting(usageStatsClient *usagestats.Client, op huma.Operation, input any) {
	if usageStatsClient == nil {
		return
	}

	// Check if this operation should be tracked
	if !trackedOperationIDs[op.OperationID] {
		return
	}

	id, err := extractPipelineID(op, input)
	if err != nil {
		return
	}

	// Send pipeline event to usage stats client channel
	usageStatsClient.RecordPipelineEvent(id, op.OperationID)
}

func extractPipelineID(op huma.Operation, input any) (string, error) {
	reqBytes, err := json.Marshal(input)
	if err != nil {
		return "", err
	}

	if op.OperationID == "create-pipeline" {
		var reqBody CreatePipelineInput
		err = json.Unmarshal(reqBytes, &reqBody)
		if err != nil || reqBody.Body.PipelineID == "" {
			return "", err
		}
		return reqBody.Body.PipelineID, nil
	}

	var reqBody struct {
		ID string
	}
	err = json.Unmarshal(reqBytes, &reqBody)
	if err != nil || reqBody.ID == "" {
		return "", err
	}
	return reqBody.ID, nil
}
