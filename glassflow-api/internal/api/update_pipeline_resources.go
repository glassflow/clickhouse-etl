package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/tidwall/gjson"
	"k8s.io/apimachinery/pkg/api/resource"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/service"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/status"
)

func ValidateResourceQuantities(r models.PipelineResources) error {
	if r.Ingestor != nil {
		for _, inst := range []*models.ComponentResources{
			r.Ingestor.Base, r.Ingestor.Left, r.Ingestor.Right,
		} {
			if err := validateResourceRequirements(inst); err != nil {
				return err
			}
		}
	}
	for _, c := range []*models.ComponentResources{r.Join, r.Sink, r.Transform} {
		if c == nil {
			continue
		}

		if err := validateResourceRequirements(c); err != nil {
			return err
		}
	}

	if err := validateNatsResources(r.Nats); err != nil {
		return err
	}

	return nil
}

func ValidateResourceConfig(r models.PipelineResources, joinEnabled bool) error {
	if err := ValidateResourceQuantities(r); err != nil {
		return err
	}

	return validateReplicaConstraints(r, joinEnabled)
}

func validateReplicaConstraints(r models.PipelineResources, joinEnabled bool) error {
	transformReplicas := componentReplicas(r.Transform)
	sinkReplicas := componentReplicas(r.Sink)

	if transformReplicas < sinkReplicas {
		return fmt.Errorf("transform replicas (%d) must be greater than or equal to sink replicas (%d)", transformReplicas, sinkReplicas)
	}

	for _, ingestorComp := range ingestorComponents(r.Ingestor) {
		if ingestorComp.replicas < transformReplicas {
			return fmt.Errorf("%s replicas (%d) must be greater than or equal to transform replicas (%d)", ingestorComp.name, ingestorComp.replicas, transformReplicas)
		}
	}

	if !joinEnabled {
		return nil
	}

	joinReplicas := componentReplicas(r.Join)
	if joinReplicas != 1 {
		return fmt.Errorf("join replicas must be 1 when join is enabled")
	}

	if sinkReplicas != joinReplicas {
		return fmt.Errorf("sink replicas (%d) must match join replicas (%d) when join is enabled", sinkReplicas, joinReplicas)
	}

	return nil
}

type namedReplicaCount struct {
	name     string
	replicas int64
}

func ingestorComponents(ingestor *models.IngestorResources) []namedReplicaCount {
	if ingestor == nil {
		return []namedReplicaCount{{name: "ingestor.base", replicas: 1}}
	}

	components := make([]namedReplicaCount, 0, 3)
	if ingestor.Base != nil || (ingestor.Left == nil && ingestor.Right == nil) {
		components = append(components, namedReplicaCount{name: "ingestor.base", replicas: componentReplicas(ingestor.Base)})
	}
	if ingestor.Left != nil {
		components = append(components, namedReplicaCount{name: "ingestor.left", replicas: componentReplicas(ingestor.Left)})
	}
	if ingestor.Right != nil {
		components = append(components, namedReplicaCount{name: "ingestor.right", replicas: componentReplicas(ingestor.Right)})
	}

	return components
}

func componentReplicas(component *models.ComponentResources) int64 {
	if component == nil || component.Replicas == nil {
		return 1
	}
	return *component.Replicas
}

func validateNatsResources(n *models.NatsResources) error {
	if n == nil || n.Stream == nil {
		return nil
	}

	if n.Stream.MaxAge != "" {
		if _, err := time.ParseDuration(n.Stream.MaxAge); err != nil {
			return fmt.Errorf("invalid nats stream maxAge %q: %w", n.Stream.MaxAge, err)
		}
	}

	if n.Stream.MaxBytes != "" {
		if _, err := resource.ParseQuantity(n.Stream.MaxBytes); err != nil {
			return fmt.Errorf("invalid nats stream maxBytes %q: %w", n.Stream.MaxBytes, err)
		}
	}

	return nil
}

func validateResourceRequirements(r *models.ComponentResources) error {
	if r == nil {
		return nil
	}

	if r.Requests != nil {
		if err := validateQuantity(r.Requests.CPU, "cpu"); err != nil {
			return err
		}
		if err := validateQuantity(r.Requests.Memory, "memory"); err != nil {
			return err
		}
	}

	if r.Limits != nil {
		if err := validateQuantity(r.Limits.CPU, "cpu"); err != nil {
			return err
		}
		if err := validateQuantity(r.Limits.Memory, "memory"); err != nil {
			return err
		}
	}

	if r.Storage != nil {
		if err := validateQuantity(r.Storage.Size, "storage size"); err != nil {
			return err
		}
	}

	return nil
}

func validateQuantity(val, field string) error {
	if val == "" {
		return fmt.Errorf("%s must be set", field)
	}

	if _, err := resource.ParseQuantity(val); err != nil {
		return fmt.Errorf("invalid %s quantity %q: %w", field, val, err)
	}

	return nil
}

func UpdatePipelineResourcesDocs() huma.Operation {
	return huma.Operation{
		OperationID: "update-pipeline-resources",
		Method:      http.MethodPut,
		Summary:     "Update pipeline resources",
		Description: "Updates resource configuration for a stopped pipeline",
	}
}

type UpdatePipelineResourcesInput struct {
	ID   string `path:"id" minLength:"1" doc:"Pipeline ID"`
	Body struct {
		PipelineResources models.PipelineResources `json:"pipeline_resources"`
	}
}

type UpdatePipelineResourcesResponse struct {
	Body pipelineResourcesBody
}

func (h *handler) updatePipelineResources(ctx context.Context, input *UpdatePipelineResourcesInput) (*UpdatePipelineResourcesResponse, error) {
	newResources := input.Body.PipelineResources

	old, err := h.pipelineService.GetPipelineResources(ctx, input.ID)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrPipelineNotExists):
			return nil, &ErrorDetail{
				Status:  http.StatusNotFound,
				Code:    "not_found",
				Message: fmt.Sprintf("resources for pipeline %q not found", input.ID),
				Details: map[string]any{"pipeline_id": input.ID},
			}
		default:
			return nil, &ErrorDetail{
				Status:  http.StatusInternalServerError,
				Code:    "internal_error",
				Message: "unable to load pipeline resources",
				Details: map[string]any{"pipeline_id": input.ID, "error": err.Error()},
			}
		}
	}

	pipelineConfig, err := h.pipelineService.GetPipeline(ctx, input.ID)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrPipelineNotExists):
			return nil, &ErrorDetail{
				Status:  http.StatusNotFound,
				Code:    "not_found",
				Message: fmt.Sprintf("pipeline %q not found", input.ID),
				Details: map[string]any{"pipeline_id": input.ID},
			}
		default:
			return nil, &ErrorDetail{
				Status:  http.StatusInternalServerError,
				Code:    "internal_error",
				Message: "unable to load pipeline",
				Details: map[string]any{"pipeline_id": input.ID, "error": err.Error()},
			}
		}
	}

	if err := ValidateResourceConfig(newResources, pipelineConfig.Join.Enabled); err != nil {
		return nil, &ErrorDetail{
			Status:  http.StatusUnprocessableEntity,
			Code:    "unprocessable_entity",
			Message: err.Error(),
		}
	}

	if err := ValidateImmutabilityPipelineResources(old.Resources, newResources); err != nil {
		return nil, &ErrorDetail{
			Status:  http.StatusUnprocessableEntity,
			Code:    "unprocessable_entity",
			Message: err.Error(),
		}
	}

	if err := validateTransformReplicasImmutability(old.Resources, newResources, isDedupEnabled(pipelineConfig)); err != nil {
		return nil, &ErrorDetail{
			Status:  http.StatusUnprocessableEntity,
			Code:    "unprocessable_entity",
			Message: err.Error(),
		}
	}

	if err := h.pipelineService.UpdatePipelineResources(ctx, input.ID, newResources); err != nil {
		switch {
		case errors.Is(err, service.ErrPipelineNotExists):
			return nil, &ErrorDetail{
				Status:  http.StatusNotFound,
				Code:    "not_found",
				Message: fmt.Sprintf("pipeline %q not found", input.ID),
				Details: map[string]any{"pipeline_id": input.ID},
			}
		default:
			if statusErr, ok := status.GetStatusValidationError(err); ok {
				return nil, &ErrorDetail{
					Status:  http.StatusConflict,
					Code:    statusErr.Code,
					Message: statusErr.Message,
					Details: map[string]any{
						"pipeline_id":    input.ID,
						"current_status": string(statusErr.CurrentStatus),
					},
				}
			}
			return nil, &ErrorDetail{
				Status:  http.StatusInternalServerError,
				Code:    "internal_error",
				Message: "unable to update pipeline resources",
				Details: map[string]any{"pipeline_id": input.ID, "error": err.Error()},
			}
		}
	}

	return &UpdatePipelineResourcesResponse{
		Body: pipelineResourcesBody{
			PipelineResources: newResources,
			FieldsPolicy:      FieldsPolicy{Immutable: PipelineResourcesImmutableFields},
		},
	}, nil
}

func ValidateImmutabilityPipelineResources(old, new models.PipelineResources) error {
	oldJSON, err := json.Marshal(old)
	if err != nil {
		return fmt.Errorf("marshal old resources: %w", err)
	}
	newJSON, err := json.Marshal(new)
	if err != nil {
		return fmt.Errorf("marshal new resources: %w", err)
	}

	for _, field := range PipelineResourcesImmutableFields {
		gjsonPath := strings.ReplaceAll(field, "/", ".")
		oldVal := gjson.GetBytes(oldJSON, gjsonPath)
		newVal := gjson.GetBytes(newJSON, gjsonPath)
		if oldVal.Exists() && oldVal.Raw != newVal.Raw {
			return fmt.Errorf("immutable field %q cannot be changed", field)
		}
	}
	return nil
}

func validateTransformReplicasImmutability(old, new models.PipelineResources, dedupEnabled bool) error {
	if !dedupEnabled {
		return nil
	}

	if componentReplicas(old.Transform) != componentReplicas(new.Transform) {
		return fmt.Errorf("transform replicas cannot be changed when deduplication is enabled")
	}

	return nil
}

func isDedupEnabled(cfg models.PipelineConfig) bool {
	for _, topic := range cfg.Ingestor.KafkaTopics {
		if topic.Deduplication.Enabled {
			return true
		}
	}
	return false
}
