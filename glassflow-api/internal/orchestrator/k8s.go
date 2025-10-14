package orchestrator

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"

	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	"sigs.k8s.io/controller-runtime/pkg/client/config"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/service"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/status"
	operator "github.com/glassflow/glassflow-etl-k8s-operator/api/v1alpha1"
)

type K8sOrchestrator struct {
	client         *dynamic.DynamicClient
	log            *slog.Logger
	customResource CustomResourceAPIGroupVersion
	namespace      string
}

type CustomResourceAPIGroupVersion struct {
	Resource string
	Kind     string
	APIGroup string
	Version  string
}

func NewK8sOrchestrator(
	log *slog.Logger,
	namespace string,
	agv CustomResourceAPIGroupVersion,
) (service.Orchestrator, error) {
	kcfg, err := config.GetConfig()
	if err != nil {
		log.Error("unable to get kubeconfig", "error", err)
		return nil, fmt.Errorf("unable to get kubeconfig: %w", err)
	}

	log.Info("connected to cluster", slog.String("kubeconfig", kcfg.Host))

	client, err := dynamic.NewForConfig(kcfg)
	if err != nil {
		log.Error("failed to create k8s client", "error", err)
		return nil, fmt.Errorf("new k8s client: %w", err)
	}

	return &K8sOrchestrator{
		client:         client,
		log:            log,
		namespace:      namespace,
		customResource: agv,
	}, nil
}

// TODO - centralize status validation
// getPipelineConfigFromK8sResource creates a PipelineConfig from K8s resource for status validation
func (k *K8sOrchestrator) getPipelineConfigFromK8sResource(customResource *unstructured.Unstructured) *models.PipelineConfig {
	// Get the pipeline ID from the resource name
	pipelineID := customResource.GetName()

	// Get current status
	statusStr, exists, _ := unstructured.NestedString(customResource.Object, "status")
	var currentStatus models.PipelineStatus
	if exists {
		// Convert K8s status string to internal status
		switch statusStr {
		case "Created":
			currentStatus = internal.PipelineStatusCreated
		case "Running":
			currentStatus = internal.PipelineStatusRunning
		case "Resuming":
			currentStatus = internal.PipelineStatusResuming
		case "Stopping":
			currentStatus = internal.PipelineStatusStopping
		case "Stopped":
			currentStatus = internal.PipelineStatusStopped
		case "Terminating":
			currentStatus = internal.PipelineStatusTerminating
		case "Failed":
			currentStatus = internal.PipelineStatusFailed
		default:
			currentStatus = internal.PipelineStatusCreated
		}
	} else {
		currentStatus = internal.PipelineStatusCreated
	}

	return &models.PipelineConfig{
		ID: pipelineID,
		Status: models.PipelineHealth{
			OverallStatus: currentStatus,
		},
	}
}

var _ service.Orchestrator = (*K8sOrchestrator)(nil)

// GetType implements Orchestrator.
func (k *K8sOrchestrator) GetType() string {
	return "k8s"
}

// SetupPipeline implements Orchestrator.
func (k *K8sOrchestrator) SetupPipeline(ctx context.Context, cfg *models.PipelineConfig) error {
	src := make([]operator.SourceStream, 0, len(cfg.Ingestor.KafkaTopics))

	for _, s := range cfg.Ingestor.KafkaTopics {
		src = append(src, operator.SourceStream{
			TopicName:    s.Name,
			OutputStream: s.OutputStreamID,
			DedupWindow:  s.Deduplication.Window.Duration(),
			Replicas:     s.Replicas,
		})
	}

	pcfg, err := json.Marshal(*cfg)
	if err != nil {
		k.log.ErrorContext(ctx, "failed to marshal pipeline config", "pipeline_id", cfg.ID, "error", err)
		return fmt.Errorf("marshal pipeline config: %w", err)
	}

	spec := operator.PipelineSpec{
		ID:  cfg.ID,
		DLQ: models.GetDLQStreamName(cfg.ID),
		Ingestor: operator.Sources{
			Type:    cfg.Ingestor.Type,
			Streams: src,
		},
		Join: operator.Join{
			Type:                  cfg.Join.Type,
			OutputStream:          cfg.Join.OutputStreamID,
			Enabled:               cfg.Join.Enabled,
			Replicas:              internal.DefaultReplicasCount,
			LeftBufferTTL:         cfg.Join.LeftBufferTTL.Duration(),
			RightBufferTTL:        cfg.Join.RightBufferTTL.Duration(),
			NATSLeftConsumerName:  cfg.Join.NATSLeftConsumerName,
			NATSRightConsumerName: cfg.Join.NATSRightConsumerName,
		},
		Sink: operator.Sink{
			Type:             cfg.Sink.Type,
			Replicas:         internal.DefaultReplicasCount,
			NATSConsumerName: cfg.Sink.NATSConsumerName,
		},
		Config: string(pcfg),
	}

	var specMap map[string]any

	jsonSpec, err := json.Marshal(spec)
	if err != nil {
		k.log.ErrorContext(ctx, "failed to marshal k8s pipeline spec", "pipeline_id", cfg.ID, "error", err)
		return fmt.Errorf("marshal k8s pipeline spec: %w", err)
	}

	err = json.Unmarshal(jsonSpec, &specMap)
	if err != nil {
		k.log.ErrorContext(ctx, "failed to unmarshal k8s pipeline spec to spec map", "pipeline_id", cfg.ID, "error", err)
		return fmt.Errorf("unmarshal k8s pipeline spec to spec map: %w", err)
	}

	obj := &unstructured.Unstructured{
		Object: map[string]any{
			"metadata": map[string]any{
				"name": cfg.ID,
				"annotations": map[string]any{
					"pipeline.etl.glassflow.io/create": "true",
				},
			},
			"spec": specMap,
		},
	}

	obj.SetGroupVersionKind(schema.GroupVersionKind{
		Group:   k.customResource.APIGroup,
		Version: k.customResource.Version,
		Kind:    k.customResource.Kind,
	})

	//nolint: exhaustruct // optional config
	_, err = k.client.Resource(schema.GroupVersionResource{
		Group:    k.customResource.APIGroup,
		Version:  k.customResource.Version,
		Resource: k.customResource.Resource,
	}).
		Namespace(k.namespace).
		Create(ctx, obj, metav1.CreateOptions{})
	if err != nil {
		k.log.ErrorContext(ctx, "failed to create custom resource", "pipeline_id", cfg.ID, "namespace", k.namespace, "error", err)
		return fmt.Errorf("create custom resource: %w", err)
	}

	k.log.InfoContext(ctx, "created k8s pipeline", "pipeline_id", cfg.ID)

	return nil
}

// StopPipeline implements Orchestrator.
func (k *K8sOrchestrator) StopPipeline(ctx context.Context, pipelineID string) error {
	k.log.InfoContext(ctx, "stopping k8s pipeline", "pipeline_id", pipelineID)

	// Get the pipeline CRD
	customResource, err := k.client.Resource(schema.GroupVersionResource{
		Group:    k.customResource.APIGroup,
		Version:  k.customResource.Version,
		Resource: k.customResource.Resource,
	}).Namespace(k.namespace).Get(ctx, pipelineID, metav1.GetOptions{})
	if err != nil {
		if errors.IsNotFound(err) {
			return service.ErrPipelineNotFound
		}
		k.log.ErrorContext(ctx, "failed to get pipeline CRD for stop", "pipeline_id", pipelineID, "namespace", k.namespace, "error", err)
		return fmt.Errorf("get pipeline CRD: %w", err)
	}

	// Create pipeline config for status validation
	pipelineConfig := k.getPipelineConfigFromK8sResource(customResource)

	// Validate status transition using the centralized validation system
	err = status.ValidatePipelineOperation(pipelineConfig, internal.PipelineStatusStopping)
	if err != nil {
		return err
	}

	annotations := customResource.GetAnnotations()
	if annotations == nil {
		annotations = make(map[string]string)
	}

	// Add stop annotation
	annotations["pipeline.etl.glassflow.io/stop"] = "true"
	customResource.SetAnnotations(annotations)

	// Update the resource with the stop annotation
	_, err = k.client.Resource(schema.GroupVersionResource{
		Group:    k.customResource.APIGroup,
		Version:  k.customResource.Version,
		Resource: k.customResource.Resource,
	}).Namespace(k.namespace).Update(ctx, customResource, metav1.UpdateOptions{})
	if err != nil {
		k.log.ErrorContext(ctx, "failed to update pipeline CRD with stop annotation", "pipeline_id", pipelineID, "namespace", k.namespace, "error", err)
		return fmt.Errorf("update pipeline CRD with stop annotation: %w", err)
	}

	k.log.InfoContext(ctx, "requested stop of k8s pipeline", "pipeline_id", pipelineID)
	return nil
}

func (k *K8sOrchestrator) TerminatePipeline(ctx context.Context, pipelineID string) error {
	k.log.InfoContext(ctx, "terminating k8s pipeline", "pipeline_id", pipelineID)

	// add annotation to indicate deletion type (terminate/shutdown)
	customResource, err := k.client.Resource(schema.GroupVersionResource{
		Group:    k.customResource.APIGroup,
		Version:  k.customResource.Version,
		Resource: k.customResource.Resource,
	}).Namespace(k.namespace).Get(ctx, pipelineID, metav1.GetOptions{})
	if err != nil {
		if errors.IsNotFound(err) {
			return service.ErrPipelineNotFound
		}
		k.log.ErrorContext(ctx, "failed to get pipeline CRD for terminate", "pipeline_id", pipelineID, "namespace", k.namespace, "error", err)
		return fmt.Errorf("get pipeline CRD: %w", err)
	}

	// Create pipeline config for status validation
	pipelineConfig := k.getPipelineConfigFromK8sResource(customResource)

	// Validate status transition using the centralized validation system
	err = status.ValidatePipelineOperation(pipelineConfig, internal.PipelineStatusTerminating)
	if err != nil {
		k.log.ErrorContext(ctx, "pipeline status validation failed for terminate", "pipeline_id", pipelineID, "current_status", pipelineConfig.Status.OverallStatus, "error", err)
		return err
	}

	annotations := customResource.GetAnnotations()
	if annotations == nil {
		annotations = make(map[string]string)
	}

	// Clear any conflicting operation annotations to ensure terminate takes precedence
	// This prevents stuck pipelines from ignoring terminate requests
	conflictingAnnotations := []string{
		"pipeline.etl.glassflow.io/create",
		"pipeline.etl.glassflow.io/pause",
		"pipeline.etl.glassflow.io/resume",
		"pipeline.etl.glassflow.io/stop",
	}

	for _, annotation := range conflictingAnnotations {
		if _, exists := annotations[annotation]; exists {
			k.log.Info("clearing conflicting annotation for terminate",
				slog.String("pipeline_id", pipelineID),
				slog.String("annotation", annotation))
			delete(annotations, annotation)
		}
	}

	// Add terminate annotation
	annotations["pipeline.etl.glassflow.io/terminate"] = "true"
	customResource.SetAnnotations(annotations)

	// Update the resource with the annotation
	_, err = k.client.Resource(schema.GroupVersionResource{
		Group:    k.customResource.APIGroup,
		Version:  k.customResource.Version,
		Resource: k.customResource.Resource,
	}).Namespace(k.namespace).Update(ctx, customResource, metav1.UpdateOptions{})
	if err != nil {
		k.log.ErrorContext(ctx, "failed to update pipeline CRD with termination annotation", "pipeline_id", pipelineID, "namespace", k.namespace, "error", err)
		return fmt.Errorf("update pipeline CRD with termination annotation: %w", err)
	}

	k.log.InfoContext(ctx, "requested termination of k8s pipeline",
		"pipeline_id", pipelineID,
		"deletion_timestamp", customResource.GetDeletionTimestamp(),
	)

	k.log.InfoContext(ctx, "requested termination of k8s pipeline", "pipeline_id", pipelineID)
	return nil
}

func (k *K8sOrchestrator) DeletePipeline(ctx context.Context, pipelineID string) error {
	k.log.InfoContext(ctx, "deleting k8s pipeline", "pipeline_id", pipelineID)

	// add annotation to indicate deletion
	customResource, err := k.client.Resource(schema.GroupVersionResource{
		Group:    k.customResource.APIGroup,
		Version:  k.customResource.Version,
		Resource: k.customResource.Resource,
	}).Namespace(k.namespace).Get(ctx, pipelineID, metav1.GetOptions{})
	if err != nil {
		if errors.IsNotFound(err) {
			return service.ErrPipelineNotFound
		}
		k.log.ErrorContext(ctx, "failed to get pipeline CRD for terminate", "pipeline_id", pipelineID, "namespace", k.namespace, "error", err)
		return fmt.Errorf("get pipeline CRD: %w", err)
	}

	annotations := customResource.GetAnnotations()
	if annotations == nil {
		annotations = make(map[string]string)
	}

	// Clear any conflicting operation annotations to ensure deletion takes precedence
	conflictingAnnotations := []string{
		"pipeline.etl.glassflow.io/create",
		"pipeline.etl.glassflow.io/pause",
		"pipeline.etl.glassflow.io/resume",
		"pipeline.etl.glassflow.io/terminate",
		"pipeline.etl.glassflow.io/stop",
	}

	for _, annotation := range conflictingAnnotations {
		if _, exists := annotations[annotation]; exists {
			k.log.Info("clearing conflicting annotation for terminate",
				slog.String("pipeline_id", pipelineID),
				slog.String("annotation", annotation))
			delete(annotations, annotation)
		}
	}

	// Add deletion annotation
	annotations["pipeline.etl.glassflow.io/delete"] = "true"
	customResource.SetAnnotations(annotations)

	// Update the resource with the annotation
	_, err = k.client.Resource(schema.GroupVersionResource{
		Group:    k.customResource.APIGroup,
		Version:  k.customResource.Version,
		Resource: k.customResource.Resource,
	}).Namespace(k.namespace).Update(ctx, customResource, metav1.UpdateOptions{})
	if err != nil {
		k.log.ErrorContext(ctx, "failed to update pipeline CRD with termination annotation", "pipeline_id", pipelineID, "namespace", k.namespace, "error", err)
		return fmt.Errorf("update pipeline CRD with termination annotation: %w", err)
	}

	k.log.InfoContext(ctx, "requested deletion of k8s pipeline",
		"pipeline_id", pipelineID,
		"deletion_timestamp", customResource.GetDeletionTimestamp(),
	)

	k.log.InfoContext(ctx, "requested termination of k8s pipeline", "pipeline_id", pipelineID)
	return nil
}

// ResumePipeline implements Orchestrator.
func (k *K8sOrchestrator) ResumePipeline(ctx context.Context, pipelineID string) error {
	k.log.InfoContext(ctx, "resuming k8s pipeline", "pipeline_id", pipelineID)

	// Get the pipeline CRD
	customResource, err := k.client.Resource(schema.GroupVersionResource{
		Group:    k.customResource.APIGroup,
		Version:  k.customResource.Version,
		Resource: k.customResource.Resource,
	}).Namespace(k.namespace).Get(ctx, pipelineID, metav1.GetOptions{})
	if err != nil {
		if errors.IsNotFound(err) {
			return service.ErrPipelineNotFound
		}
		k.log.ErrorContext(ctx, "failed to get pipeline CRD for resume", "pipeline_id", pipelineID, "namespace", k.namespace, "error", err)
		return fmt.Errorf("get pipeline CRD: %w", err)
	}

	// Create pipeline config for status validation
	pipelineConfig := k.getPipelineConfigFromK8sResource(customResource)

	// Validate status transition using the centralized validation system
	err = status.ValidatePipelineOperation(pipelineConfig, internal.PipelineStatusResuming)
	if err != nil {
		k.log.ErrorContext(ctx, "pipeline status validation failed for resume", "pipeline_id", pipelineID, "current_status", pipelineConfig.Status.OverallStatus, "error", err)
		return err
	}

	annotations := customResource.GetAnnotations()
	if annotations == nil {
		annotations = make(map[string]string)
	}

	// Add resume annotation
	annotations["pipeline.etl.glassflow.io/resume"] = "true"
	customResource.SetAnnotations(annotations)

	// Update the resource with the resume annotation
	_, err = k.client.Resource(schema.GroupVersionResource{
		Group:    k.customResource.APIGroup,
		Version:  k.customResource.Version,
		Resource: k.customResource.Resource,
	}).Namespace(k.namespace).Update(ctx, customResource, metav1.UpdateOptions{})
	if err != nil {
		k.log.ErrorContext(ctx, "failed to update pipeline CRD with resume annotation", "pipeline_id", pipelineID, "namespace", k.namespace, "error", err)
		return fmt.Errorf("update pipeline CRD with resume annotation: %w", err)
	}

	k.log.InfoContext(ctx, "requested resume of k8s pipeline", "pipeline_id", pipelineID)
	return nil
}
