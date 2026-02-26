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

	if err := ValidateResourceQuantities(newResources); err != nil {
		return nil, &ErrorDetail{
			Status:  http.StatusUnprocessableEntity,
			Code:    "unprocessable_entity",
			Message: err.Error(),
		}
	}

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

	if err := ValidateImmutabilityPipelineResources(old.Resources, newResources); err != nil {
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
