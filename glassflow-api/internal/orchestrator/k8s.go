package orchestrator

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"

	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/kubernetes"
	"sigs.k8s.io/controller-runtime/pkg/client/config"

	operator "github.com/glassflow/glassflow-etl-k8s-operator/api/v1alpha1"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/service"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/status"
)

type K8sOrchestrator struct {
	client         *dynamic.DynamicClient // for CRDs
	clientSet      *kubernetes.Clientset  // regular k8 resources
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

	clientSet, err := kubernetes.NewForConfig(kcfg)
	if err != nil {
		log.Error("failed to create k8s clientSet", "error", err)
		return nil, fmt.Errorf("new k8s clientSet: %w", err)
	}

	return &K8sOrchestrator{
		client:         client,
		clientSet:      clientSet,
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
	// Create the pipeline config secret in the glassflow namespace FIRST
	err := k.createPipelineConfigSecret(ctx, cfg)
	if err != nil {
		k.log.ErrorContext(ctx, "failed to create pipeline config secret", "pipeline_id", cfg.ID, "error", err)
		return fmt.Errorf("create pipeline config secret: %w", err)
	}

	specMap, err := k.buildPipelineSpec(ctx, cfg)
	if err != nil {
		_ = k.deletePipelineConfigSecret(ctx, cfg.ID)
		return err
	}

	obj := &unstructured.Unstructured{
		Object: map[string]any{
			"metadata": map[string]any{
				"name": cfg.ID,
				"annotations": map[string]any{
					internal.PipelineCreateAnnotation: "true",
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
		k.log.ErrorContext(ctx, "failed to create custom resource, cleaning up secret", "pipeline_id", cfg.ID, "namespace", k.namespace, "error", err)
		_ = k.deletePipelineConfigSecret(ctx, cfg.ID)
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
	annotations[internal.PipelineStopAnnotation] = "true"
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
		internal.PipelineCreateAnnotation,
		internal.PipelinePauseAnnotation,
		internal.PipelineResumeAnnotation,
		internal.PipelineStopAnnotation,
		internal.PipelineEditAnnotation,
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
	annotations[internal.PipelineTerminateAnnotation] = "true"
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
		internal.PipelineCreateAnnotation,
		internal.PipelinePauseAnnotation,
		internal.PipelineResumeAnnotation,
		internal.PipelineTerminateAnnotation,
		internal.PipelineStopAnnotation,
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
	annotations[internal.PipelineDeleteAnnotation] = "true"
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

	err = k.deletePipelineConfigSecret(ctx, pipelineID)
	if err != nil {
		k.log.ErrorContext(ctx, "failed to delete pipeline config secret", "pipeline_id", pipelineID, "error", err)
		// Continue with deletion process
	}

	k.log.InfoContext(ctx, "requested deletion of k8s pipeline",
		"pipeline_id", pipelineID,
		"deletion_timestamp", customResource.GetDeletionTimestamp(),
	)

	k.log.InfoContext(ctx, "requested termination of k8s pipeline", "pipeline_id", pipelineID)
	return nil
}

// ResumePipeline implements Orchestrator.
func (k *K8sOrchestrator) ResumePipeline(ctx context.Context, pipelineID string, pipelineCfg *models.PipelineConfig) error {
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

	// Build new spec using the same logic as SetupPipeline
	specMap, err := k.buildPipelineSpec(ctx, pipelineCfg)
	if err != nil {
		return err
	}

	// Replace the entire spec
	customResource.Object["spec"] = specMap

	annotations := customResource.GetAnnotations()
	if annotations == nil {
		annotations = make(map[string]string)
	}

	// Add resume annotation
	annotations[internal.PipelineResumeAnnotation] = "true"
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

// EditPipeline implements Orchestrator.
func (k *K8sOrchestrator) EditPipeline(ctx context.Context, pipelineID string, newCfg *models.PipelineConfig) error {
	k.log.InfoContext(ctx, "editing k8s pipeline", "pipeline_id", pipelineID)

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
		k.log.ErrorContext(ctx, "failed to get pipeline CRD for edit", "pipeline_id", pipelineID, "namespace", k.namespace, "error", err)
		return fmt.Errorf("get pipeline CRD: %w", err)
	}

	// Create pipeline config for status validation
	pipelineConfig := k.getPipelineConfigFromK8sResource(customResource)

	// Validate pipeline is stopped
	if pipelineConfig.Status.OverallStatus != internal.PipelineStatusStopped && pipelineConfig.Status.OverallStatus != internal.PipelineStatusFailed {
		k.log.ErrorContext(ctx, "pipeline must be stopped before editing", "pipeline_id", pipelineID, "current_status", pipelineConfig.Status.OverallStatus)
		return status.NewPipelineNotStoppedForEditError(models.PipelineStatus(pipelineConfig.Status.OverallStatus))
	}

	err = k.updatePipelineConfigSecret(ctx, newCfg)
	if err != nil {
		k.log.ErrorContext(ctx, "failed to update pipeline config secret", "pipeline_id", pipelineID, "error", err)
		return fmt.Errorf("update pipeline config secret: %w", err)
	}

	// Build new spec using the same logic as SetupPipeline
	specMap, err := k.buildPipelineSpec(ctx, newCfg)
	if err != nil {
		return err
	}

	// Replace the entire spec
	customResource.Object["spec"] = specMap

	// Add edit annotation
	annotations := customResource.GetAnnotations()
	if annotations == nil {
		annotations = make(map[string]string)
	}
	annotations["pipeline.etl.glassflow.io/edit"] = "true"
	customResource.SetAnnotations(annotations)

	// Update the resource with the edit annotation and new config
	_, err = k.client.Resource(schema.GroupVersionResource{
		Group:    k.customResource.APIGroup,
		Version:  k.customResource.Version,
		Resource: k.customResource.Resource,
	}).Namespace(k.namespace).Update(ctx, customResource, metav1.UpdateOptions{})
	if err != nil {
		k.log.ErrorContext(ctx, "failed to update pipeline CRD with edit annotation", "pipeline_id", pipelineID, "namespace", k.namespace, "error", err)
		return fmt.Errorf("update pipeline CRD with edit annotation: %w", err)
	}

	k.log.InfoContext(ctx, "requested edit of k8s pipeline", "pipeline_id", pipelineID)
	return nil
}

// buildPipelineSpec creates a complete PipelineSpec from a PipelineConfig
func (k *K8sOrchestrator) buildPipelineSpec(ctx context.Context, cfg *models.PipelineConfig) (map[string]any, error) {
	// Build source streams
	src := make([]operator.SourceStream, 0, len(cfg.Ingestor.KafkaTopics))
	for _, s := range cfg.Ingestor.KafkaTopics {
		src = append(src, operator.SourceStream{
			TopicName:    s.Name,
			OutputStream: s.OutputStreamID,
			DedupWindow:  s.Deduplication.Window.Duration(),
			Replicas:     s.Replicas,
			Deduplication: &operator.Deduplication{
				Enabled:          s.Deduplication.Enabled || cfg.StatelessTransformation.Enabled || cfg.Filter.Enabled,
				OutputStream:     models.GetDedupOutputStreamName(cfg.ID, s.Name),
				NATSConsumerName: models.GetNATSDedupConsumerName(cfg.ID),
				Replicas:         s.Deduplication.Replicas,
			},
		})
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
			Replicas:         cfg.Sink.Replicas,
			NATSConsumerName: cfg.Sink.NATSConsumerName,
		},
		// Config field is intentionally omitted - stored in secret instead
	}

	// Convert spec to map[string]interface{}
	var specMap map[string]any
	jsonSpec, err := json.Marshal(spec)
	if err != nil {
		k.log.ErrorContext(ctx, "failed to marshal k8s pipeline spec", "pipeline_id", cfg.ID, "error", err)
		return nil, fmt.Errorf("marshal k8s pipeline spec: %w", err)
	}

	err = json.Unmarshal(jsonSpec, &specMap)
	if err != nil {
		k.log.ErrorContext(ctx, "failed to unmarshal k8s pipeline spec to spec map", "pipeline_id", cfg.ID, "error", err)
		return nil, fmt.Errorf("unmarshal k8s pipeline spec to spec map: %w", err)
	}

	return specMap, nil
}

// getPipelineConfigSecretName returns the name of the secret for a pipeline
func (k *K8sOrchestrator) getPipelineConfigSecretName(pipelineID string) string {
	return fmt.Sprintf("pipeline-config-%s", pipelineID)
}

// createPipelineConfigSecret creates a secret in the glassflow namespace with pipeline.json
func (k *K8sOrchestrator) createPipelineConfigSecret(ctx context.Context, cfg *models.PipelineConfig) error {
	// Marshal config to JSON string
	configJSON, err := json.Marshal(cfg)
	if err != nil {
		return fmt.Errorf("marshal pipeline config: %w", err)
	}

	secretName := k.getPipelineConfigSecretName(cfg.ID)
	secret := &corev1.Secret{
		ObjectMeta: metav1.ObjectMeta{
			Name:      secretName,
			Namespace: k.namespace,
			Labels: map[string]string{
				"etl.glassflow.io/pipeline-id": cfg.ID,
				"etl.glassflow.io/managed-by":  "glassflow-api",
			},
		},
		Type: corev1.SecretTypeOpaque,
		StringData: map[string]string{
			"pipeline.json": string(configJSON),
		},
	}

	_, err = k.clientSet.CoreV1().Secrets(k.namespace).Create(ctx, secret, metav1.CreateOptions{})
	if err != nil {
		if errors.IsAlreadyExists(err) {
			// Secret already exists, update it instead
			return k.updatePipelineConfigSecret(ctx, cfg)
		}
		return fmt.Errorf("create pipeline config secret: %w", err)
	}

	return nil
}

// updatePipelineConfigSecret updates the secret in the glassflow namespace with new pipeline.json
func (k *K8sOrchestrator) updatePipelineConfigSecret(ctx context.Context, cfg *models.PipelineConfig) error {
	// Marshal config to JSON string
	configJSON, err := json.Marshal(cfg)
	if err != nil {
		return fmt.Errorf("marshal pipeline config: %w", err)
	}

	secretName := k.getPipelineConfigSecretName(cfg.ID)

	// Get existing secret
	existingSecret, err := k.clientSet.CoreV1().Secrets(k.namespace).Get(ctx, secretName, metav1.GetOptions{})
	if err != nil {
		if errors.IsNotFound(err) {
			// Secret doesn't exist, create it
			return k.createPipelineConfigSecret(ctx, cfg)
		}
		return fmt.Errorf("get pipeline config secret: %w", err)
	}

	// Update the secret data
	existingSecret.StringData = map[string]string{
		"pipeline.json": string(configJSON),
	}

	// Ensure labels are up to date
	if existingSecret.Labels == nil {
		existingSecret.Labels = make(map[string]string)
	}
	existingSecret.Labels["etl.glassflow.io/pipeline-id"] = cfg.ID
	existingSecret.Labels["etl.glassflow.io/managed-by"] = "glassflow-api"

	// Update the secret
	_, err = k.clientSet.CoreV1().Secrets(k.namespace).Update(ctx, existingSecret, metav1.UpdateOptions{})
	if err != nil {
		return fmt.Errorf("update pipeline config secret: %w", err)
	}

	return nil
}

// deletePipelineConfigSecret deletes the secret from the glassflow namespace
func (k *K8sOrchestrator) deletePipelineConfigSecret(ctx context.Context, pipelineID string) error {
	secretName := k.getPipelineConfigSecretName(pipelineID)

	err := k.clientSet.CoreV1().Secrets(k.namespace).Delete(ctx, secretName, metav1.DeleteOptions{})
	if err != nil {
		if errors.IsNotFound(err) {
			// Secret already deleted, that's fine
			return nil
		}
		return fmt.Errorf("delete pipeline config secret: %w", err)
	}

	return nil
}
