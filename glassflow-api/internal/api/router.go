package api

import (
	"context"
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
		log.Error("error happened", "status", status, "message", message, "errors", errs)
		if len(errs) >= 1 {
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
	registerHumaHandler("/api/v2/healthz", h.healthzV2, log, HealthzSwaggerDocs(), humaAPI)
	registerHumaHandler("/api/v1/platform", h.platform, log, PlatformSwaggerDocs(), humaAPI)
	registerHumaHandler("/api/v1/pipeline/{id}/dlq/purge", h.purgeDLQ, log, PurgeDLQDocs(), humaAPI)
	registerHumaHandler("/api/v1/pipeline", h.createPipeline, log, CreatePipelineDocs(), humaAPI)
	registerHumaHandler("/api/v1/pipeline/{id}/stop", h.stopPipeline, log, StopPipelineDocs(), humaAPI)
	registerHumaHandler("/api/v1/pipeline/{id}/terminate", h.terminatePipeline, log, TerminatePipelineDocs(), humaAPI)
	registerHumaHandler("/api/v1/pipeline/{id}/metadata", h.updatePipelineMetadata, log, UpdatePipelineMetadataDocs(), humaAPI)
	registerHumaHandler("/api/v1/pipeline/{id}/health", h.getPipelineHealth, log, GetPipelineHealthDocs(), humaAPI)
	registerHumaHandler("/api/v1/filter/validate", h.validateFilter, log, ValidateFilterDocs(), humaAPI)
	registerHumaHandler("/api/v1/pipeline", h.getPipelines, log, GetPipelinesDocs(), humaAPI)
	registerHumaHandler("/api/v1/pipeline/{id}", h.getPipeline, log, GetPipelineDocs(), humaAPI)

	r.HandleFunc("/api/v1/docs", h.docs)
	r.HandleFunc("/api/v1/openapi.json", h.swaggerDocsJSON)

	r.HandleFunc("/api/v1/healthz", h.healthz).Methods("GET")
	r.HandleFunc("/api/v1/pipeline/{id}", h.updatePipelineName).Methods("PATCH")
	r.HandleFunc("/api/v1/pipeline/{id}", h.deletePipeline).Methods("DELETE")
	r.HandleFunc("/api/v1/pipeline/{id}/dlq/consume", h.consumeDLQ).Methods("GET")
	r.HandleFunc("/api/v1/pipeline/{id}/dlq/state", h.getDLQState).Methods("GET")
	r.HandleFunc("/api/v1/pipeline/{id}/resume", h.resumePipeline).Methods("POST")
	r.HandleFunc("/api/v1/pipeline/{id}/edit", h.editPipeline).Methods("POST")

	r.Use(Recovery(log), RouteContext(), RequestLogging(log), RequestMetrics(meter))

	return r
}

// to log all errors, it's a bit hard to implement it on middleware side
func registerHumaHandler[I, O any](
	path string,
	handler func(context.Context, *I) (*O, error),
	log *slog.Logger,
	op huma.Operation,
	api huma.API,
) {
	op.Path = path
	huma.Register(api, op, func(ctx context.Context, input *I) (*O, error) {
		output, err := handler(ctx, input)
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
