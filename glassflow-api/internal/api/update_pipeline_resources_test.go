package api

import (
	"testing"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

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
			err := models.ValidateResourceQuantities(tt.r)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateResourceQuantities() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestTransformReplicasImmutable_WhenDedupEnabled(t *testing.T) {
	replicas1 := int64(1)
	replicas2 := int64(3)
	old := models.PipelineResources{
		Transform: &models.ComponentResources{Replicas: &replicas1},
	}
	newRes := models.PipelineResources{
		Transform: &models.ComponentResources{Replicas: &replicas2},
	}

	immutableFields := models.GetImmutableFields(&models.PipelineConfig{
		Ingestor: models.IngestorComponentConfig{
			KafkaTopics: []models.KafkaTopicsConfig{
				{Deduplication: models.DeduplicationConfig{Enabled: true}},
			},
		},
	})

	err := models.ValidateImmutabilityPipelineResources(old, newRes, immutableFields)
	if err == nil {
		t.Error("expected error when changing transform/replicas with dedup enabled")
	}
}

func TestTransformReplicasMutable_WhenDedupDisabled(t *testing.T) {
	replicas1 := int64(1)
	replicas2 := int64(3)
	old := models.PipelineResources{
		Transform: &models.ComponentResources{Replicas: &replicas1},
	}
	newRes := models.PipelineResources{
		Transform: &models.ComponentResources{Replicas: &replicas2},
	}

	immutableFields := models.GetImmutableFields(&models.PipelineConfig{})

	err := models.ValidateImmutabilityPipelineResources(old, newRes, immutableFields)
	if err != nil {
		t.Errorf("expected no error when changing transform/replicas without dedup, got: %v", err)
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
	}

	old := baseResources()
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			newResources := baseResources()
			tt.modifier(&newResources)
			if err := models.ValidateImmutabilityPipelineResources(old, newResources, models.PipelineResourcesImmutable); err == nil {
				t.Errorf("expected error for changed immutable field %q, got nil", tt.name)
			}
		})
	}
}
