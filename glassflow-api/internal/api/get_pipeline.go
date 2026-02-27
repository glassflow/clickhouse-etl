package api

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/danielgtaylor/huma/v2"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/service"
)

func GetPipelineDocs() huma.Operation {
	return huma.Operation{
		OperationID: "get-pipeline",
		Method:      http.MethodGet,
		Summary:     "Get pipeline",
		Description: "Returns the configuration of a specific pipeline",
	}
}

type GetPipelineInput struct {
	ID     string   `path:"id" minLength:"1" doc:"Pipeline ID"`
	Schema []string `query:"schema,explode" doc:"Optional schema overrides in sourceId:version format. Repeat this parameter for multiple sources, for example: ?schema=topicA:1001&schema=topicB:2001"`
}

type GetPipelineResponse struct {
	Body pipelineJSON
}

func (h *handler) getPipeline(ctx context.Context, input *GetPipelineInput) (*GetPipelineResponse, error) {
	sourceSchemaVersions, err := parseSchemaQueryParams(input.Schema)
	if err != nil {
		return nil, &ErrorDetail{
			Status:  http.StatusBadRequest,
			Code:    "bad_request",
			Message: err.Error(),
			Details: map[string]any{
				"pipeline_id": input.ID,
				"schema":      input.Schema,
			},
		}
	}

	p, err := h.pipelineService.GetPipeline(ctx, input.ID, sourceSchemaVersions)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrPipelineNotExists):
			return nil, &ErrorDetail{
				Status:  http.StatusNotFound,
				Code:    "not_found",
				Message: fmt.Sprintf("pipeline with id %q does not exist", input.ID),
				Details: map[string]any{
					"pipeline_id": input.ID,
					"error":       err.Error(),
				},
			}
		case errors.Is(err, service.ErrInvalidSchemaSelection):
			return nil, &ErrorDetail{
				Status:  http.StatusBadRequest,
				Code:    "bad_request",
				Message: "Invalid schema selection for this pipeline",
				Details: map[string]any{
					"pipeline_id": input.ID,
					"schema":      sourceSchemaVersions,
					"error":       err.Error(),
				},
			}
		default:
			return nil, &ErrorDetail{
				Status:  http.StatusInternalServerError,
				Code:    "internal_error",
				Message: "Unable to load pipeline",
				Details: map[string]any{
					"pipeline_id": input.ID,
					"error":       err.Error(),
				},
			}
		}
	}

	return &GetPipelineResponse{Body: toPipelineJSON(p)}, nil
}

func parseSchemaQueryParams(values []string) (map[string]string, error) {
	if len(values) == 0 {
		return nil, nil
	}

	parsed := make(map[string]string, len(values))
	for _, raw := range values {
		entry := strings.TrimSpace(raw)
		if entry == "" {
			return nil, fmt.Errorf("invalid schema query parameter: empty value")
		}

		sourceID, versionID, ok := strings.Cut(entry, ":")
		if !ok {
			return nil, fmt.Errorf("invalid schema query parameter %q: expected sourceId:version", raw)
		}

		sourceID = strings.TrimSpace(sourceID)
		versionID = strings.TrimSpace(versionID)
		if sourceID == "" || versionID == "" {
			return nil, fmt.Errorf("invalid schema query parameter %q: sourceId and version are required", raw)
		}

		if existing, exists := parsed[sourceID]; exists && existing != versionID {
			return nil, fmt.Errorf("conflicting schema versions for source %q", sourceID)
		}

		parsed[sourceID] = versionID
	}

	return parsed, nil
}
