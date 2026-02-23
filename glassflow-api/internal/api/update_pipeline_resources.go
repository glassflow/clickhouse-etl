package api

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/tidwall/gjson"
	"k8s.io/apimachinery/pkg/api/resource"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

func ValidateResourceQuantities(r models.PipelineResources) error {
	if r.Ingestor != nil {
		for _, inst := range []*models.IngestorInstanceResources{
			r.Ingestor.Base, r.Ingestor.Left, r.Ingestor.Right,
		} {
			if err := validateResourceRequirements(inst.Resources); err != nil {
				return err
			}
		}
	}
	for _, c := range []*models.ComponentResources{r.Join, r.Sink, r.Dedup} {
		if c == nil {
			continue
		}
		if err := validateResourceRequirements(c.Resources); err != nil {
			return err
		}
	}
	return nil
}

func validateResourceRequirements(r *models.ResourceRequirements) error {
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

func ValidatePipelineResources(old, new models.PipelineResources) error {
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
