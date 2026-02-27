package api

import (
	"testing"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

func replicas(v int64) *int64 {
	return &v
}

func baseResources() models.PipelineResources {
	replicas := int64(2)
	return models.PipelineResources{
		Nats: &models.NatsResources{
			Stream: &models.NatsStreamResources{
				MaxAge:   "24h",
				MaxBytes: "1GB",
			},
		},
		Transform: &models.ComponentResources{
			Storage: &models.StorageConfig{Size: "10Gi"},
		},
		Join: &models.ComponentResources{
			Replicas: &replicas,
		},
	}
}

func TestValidateResourceQuantities(t *testing.T) {
	validList := &models.ResourceList{CPU: "500m", Memory: "256Mi"}
	validStorage := &models.StorageConfig{Size: "10Gi"}
	validReqs := &models.ComponentResources{
		Requests: validList,
		Limits:   &models.ResourceList{CPU: "2", Memory: "1Gi"},
		Storage:  validStorage,
	}

	tests := []struct {
		name    string
		r       models.PipelineResources
		wantErr bool
	}{
		{
			name: "valid quantities",
			r: models.PipelineResources{
				Join:      validReqs,
				Sink:      validReqs,
				Transform: validReqs,
			},
		},
		{
			name:    "empty cpu is rejected",
			r:       models.PipelineResources{Join: &models.ComponentResources{Requests: &models.ResourceList{CPU: "", Memory: "256Mi"}}},
			wantErr: true,
		},
		{
			name:    "invalid cpu in requests",
			r:       models.PipelineResources{Join: &models.ComponentResources{Requests: &models.ResourceList{CPU: "bad"}}},
			wantErr: true,
		},
		{
			name:    "invalid memory in limits",
			r:       models.PipelineResources{Sink: &models.ComponentResources{Limits: &models.ResourceList{Memory: "1GB"}}},
			wantErr: true,
		},
		{
			name:    "invalid storage size",
			r:       models.PipelineResources{Transform: &models.ComponentResources{Storage: &models.StorageConfig{Size: "10gigs"}}},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateResourceQuantities(tt.r)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateResourceQuantities() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestValidatePipelineResources_DetectsImmutableFieldChanges(t *testing.T) {
	tests := []struct {
		name     string
		modifier func(*models.PipelineResources)
	}{
		{
			name:     "nats/stream/maxAge",
			modifier: func(r *models.PipelineResources) { r.Nats.Stream.MaxAge = "48h" },
		},
		{
			name:     "nats/stream/maxBytes",
			modifier: func(r *models.PipelineResources) { r.Nats.Stream.MaxBytes = "2GB" },
		},
		{
			name:     "transform/storage/size",
			modifier: func(r *models.PipelineResources) { r.Transform.Storage.Size = "20Gi" },
		},
		{
			name: "join/replicas",
			modifier: func(r *models.PipelineResources) {
				n := int64(5)
				r.Join.Replicas = &n
			},
		},
	}

	old := baseResources()
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			newResources := baseResources()
			tt.modifier(&newResources)
			if err := ValidateImmutabilityPipelineResources(old, newResources); err == nil {
				t.Errorf("expected error for changed immutable field %q, got nil", tt.name)
			}
		})
	}
}

func TestValidateResourceConfig_ReplicaHierarchy(t *testing.T) {
	t.Run("ingestor replicas must be >= transform replicas", func(t *testing.T) {
		r := models.PipelineResources{
			Ingestor: &models.IngestorResources{
				Base: &models.ComponentResources{Replicas: replicas(1)},
			},
			Transform: &models.ComponentResources{Replicas: replicas(2)},
			Sink:      &models.ComponentResources{Replicas: replicas(1)},
		}
		err := ValidateResourceConfig(r, false)
		if err == nil {
			t.Fatal("expected validation error, got nil")
		}
	})

	t.Run("transform replicas must be >= sink replicas", func(t *testing.T) {
		r := models.PipelineResources{
			Ingestor: &models.IngestorResources{
				Base: &models.ComponentResources{Replicas: replicas(3)},
			},
			Transform: &models.ComponentResources{Replicas: replicas(1)},
			Sink:      &models.ComponentResources{Replicas: replicas(2)},
		}
		err := ValidateResourceConfig(r, false)
		if err == nil {
			t.Fatal("expected validation error, got nil")
		}
	})

	t.Run("valid hierarchy passes", func(t *testing.T) {
		r := models.PipelineResources{
			Ingestor: &models.IngestorResources{
				Base: &models.ComponentResources{Replicas: replicas(3)},
			},
			Transform: &models.ComponentResources{Replicas: replicas(2)},
			Sink:      &models.ComponentResources{Replicas: replicas(1)},
		}
		if err := ValidateResourceConfig(r, false); err != nil {
			t.Fatalf("expected no error, got %v", err)
		}
	})
}

func TestValidateResourceConfig_JoinReplicaRules(t *testing.T) {
	t.Run("join replicas must be 1 when join enabled", func(t *testing.T) {
		r := models.PipelineResources{
			Join: &models.ComponentResources{Replicas: replicas(2)},
			Sink: &models.ComponentResources{Replicas: replicas(2)},
		}
		err := ValidateResourceConfig(r, true)
		if err == nil {
			t.Fatal("expected validation error, got nil")
		}
	})

	t.Run("transform replicas must be 1 when join enabled", func(t *testing.T) {
		r := models.PipelineResources{
			Transform: &models.ComponentResources{Replicas: replicas(2)},
			Join:      &models.ComponentResources{Replicas: replicas(1)},
			Sink:      &models.ComponentResources{Replicas: replicas(1)},
		}
		err := ValidateResourceConfig(r, true)
		if err == nil {
			t.Fatal("expected validation error, got nil")
		}
	})

	t.Run("sink replicas must match join replicas when join enabled", func(t *testing.T) {
		r := models.PipelineResources{
			Transform: &models.ComponentResources{Replicas: replicas(1)},
			Join:      &models.ComponentResources{Replicas: replicas(1)},
			Sink:      &models.ComponentResources{Replicas: replicas(2)},
		}
		err := ValidateResourceConfig(r, true)
		if err == nil {
			t.Fatal("expected validation error, got nil")
		}
	})

	t.Run("join enabled with matching replicas passes", func(t *testing.T) {
		r := models.PipelineResources{
			Transform: &models.ComponentResources{Replicas: replicas(1)},
			Join:      &models.ComponentResources{Replicas: replicas(1)},
			Sink:      &models.ComponentResources{Replicas: replicas(1)},
		}
		if err := ValidateResourceConfig(r, true); err != nil {
			t.Fatalf("expected no error, got %v", err)
		}
	})
}

func TestValidateTransformReplicasImmutability(t *testing.T) {
	t.Run("allows changes when dedup disabled", func(t *testing.T) {
		old := models.PipelineResources{
			Transform: &models.ComponentResources{Replicas: replicas(1)},
		}
		newResources := models.PipelineResources{
			Transform: &models.ComponentResources{Replicas: replicas(3)},
		}

		if err := validateTransformReplicasImmutability(old, newResources, false); err != nil {
			t.Fatalf("expected no error, got %v", err)
		}
	})

	t.Run("rejects changes when dedup enabled", func(t *testing.T) {
		old := models.PipelineResources{
			Transform: &models.ComponentResources{Replicas: replicas(1)},
		}
		newResources := models.PipelineResources{
			Transform: &models.ComponentResources{Replicas: replicas(3)},
		}

		err := validateTransformReplicasImmutability(old, newResources, true)
		if err == nil {
			t.Fatal("expected validation error, got nil")
		}
	})
}
