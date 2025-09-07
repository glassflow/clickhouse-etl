package orchestrator

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	"sigs.k8s.io/controller-runtime/pkg/client/config"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/service"
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
		return nil, fmt.Errorf("unable to get kubeconfig: %w", err)
	}

	log.Info("connected to cluster", slog.String("kubeconfig", kcfg.Host))

	client, err := dynamic.NewForConfig(kcfg)
	if err != nil {
		return nil, fmt.Errorf("new k8s client: %w", err)
	}

	return &K8sOrchestrator{
		client:         client,
		log:            log,
		namespace:      namespace,
		customResource: agv,
	}, nil
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
		})
	}

	pcfg, err := json.Marshal(*cfg)
	if err != nil {
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
			Type:         cfg.Join.Type,
			OutputStream: cfg.Join.OutputStreamID,
			Enabled:      cfg.Join.Enabled,
		},
		Sink:   cfg.Sink.Type,
		Config: string(pcfg),
	}

	var specMap map[string]any

	jsonSpec, err := json.Marshal(spec)
	if err != nil {
		return fmt.Errorf("marshal k8s pipeline spec: %w", err)
	}

	err = json.Unmarshal(jsonSpec, &specMap)
	if err != nil {
		return fmt.Errorf("unmarshal k8s pipeline spec to spec map: %w", err)
	}

	obj := &unstructured.Unstructured{
		Object: map[string]any{
			"metadata": map[string]any{
				"name": cfg.ID,
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
		return fmt.Errorf("create custom resource: %w", err)
	}

	k.log.Info("created k8s pipeline", slog.String("pipeline_id", cfg.ID))

	return nil
}

// ShutdownPipeline implements Orchestrator.
func (k *K8sOrchestrator) ShutdownPipeline(_ context.Context, _ string) error {
	return service.ErrNotImplemented
	// annotate deletion-type: shutdown
}

func (k *K8sOrchestrator) TerminatePipeline(ctx context.Context, pipelineID string) error {
	k.log.Info("terminating k8s pipeline", slog.String("pipeline_id", pipelineID))

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
		return fmt.Errorf("get pipeline CRD: %w", err)
	}

	annotations := customResource.GetAnnotations()
	if annotations == nil {
		annotations = make(map[string]string)
	}

	// TODO - replace with annotation constant from operator:glassflow-cloud branch
	annotations["pipeline.etl.glassflow.io/deletion-type"] = "terminate"
	customResource.SetAnnotations(annotations)

	// Update the resource with the annotation
	_, err = k.client.Resource(schema.GroupVersionResource{
		Group:    k.customResource.APIGroup,
		Version:  k.customResource.Version,
		Resource: k.customResource.Resource,
	}).Namespace(k.namespace).Update(ctx, customResource, metav1.UpdateOptions{})
	if err != nil {
		return fmt.Errorf("update pipeline CRD with termination annotation: %w", err)
	}

	// Now delete the resource
	err = k.client.Resource(schema.GroupVersionResource{
		Group:    k.customResource.APIGroup,
		Version:  k.customResource.Version,
		Resource: k.customResource.Resource,
	}).Namespace(k.namespace).Delete(ctx, pipelineID, metav1.DeleteOptions{})
	if err != nil {
		return fmt.Errorf("delete pipeline CRD: %w", err)
	}

	// get resource to check if marked for deletion
	customResource, err = k.client.Resource(schema.GroupVersionResource{
		Group:    k.customResource.APIGroup,
		Version:  k.customResource.Version,
		Resource: k.customResource.Resource,
	}).Namespace(k.namespace).Get(ctx, pipelineID, metav1.GetOptions{})
	if err != nil {
		return fmt.Errorf("get pipeline CRD: %w", err)
	}

	if customResource.GetDeletionTimestamp().IsZero() {
		k.log.Error("error deleting pipeline",
			slog.String("pipeline_id", pipelineID),
			slog.Any(" deletion_timestamp", customResource.GetDeletionTimestamp()),
		)
		return fmt.Errorf("failed to send pipeline: %s termination to operator", pipelineID)
	}

	k.log.Info("requested termination of k8s pipeline",
		slog.String("pipeline_id", pipelineID),
		slog.Any(" deletion_timestamp", customResource.GetDeletionTimestamp()),
	)

	k.log.Info("requested termination of k8s pipeline", slog.String("pipeline_id", pipelineID))
	return nil
}

// PausePipeline implements Orchestrator.
func (k *K8sOrchestrator) PausePipeline(ctx context.Context, pipelineID string) error {
	k.log.Info("pausing k8s pipeline", slog.String("pipeline_id", pipelineID))

	// Get the existing pipeline resource
	customResource, err := k.client.Resource(schema.GroupVersionResource{
		Group:    k.customResource.APIGroup,
		Version:  k.customResource.Version,
		Resource: k.customResource.Resource,
	}).Namespace(k.namespace).Get(ctx, pipelineID, metav1.GetOptions{})
	if err != nil {
		if errors.IsNotFound(err) {
			return service.ErrPipelineNotFound
		}
		return fmt.Errorf("get pipeline CRD: %w", err)
	}

	// Add pause annotation
	annotations := customResource.GetAnnotations()
	if annotations == nil {
		annotations = make(map[string]string)
	}

	annotations["pipeline.etl.glassflow.io/pause-requested"] = "true"
	customResource.SetAnnotations(annotations)

	// Update the resource with the pause annotation
	_, err = k.client.Resource(schema.GroupVersionResource{
		Group:    k.customResource.APIGroup,
		Version:  k.customResource.Version,
		Resource: k.customResource.Resource,
	}).Namespace(k.namespace).Update(ctx, customResource, metav1.UpdateOptions{})
	if err != nil {
		return fmt.Errorf("update pipeline CRD with pause annotation: %w", err)
	}

	k.log.Info("requested pause of k8s pipeline", slog.String("pipeline_id", pipelineID))
	return nil
}

// ResumePipeline implements Orchestrator.
func (k *K8sOrchestrator) ResumePipeline(ctx context.Context, pipelineID string) error {
	k.log.Info("resuming k8s pipeline", slog.String("pipeline_id", pipelineID))

	// Get the existing pipeline resource
	customResource, err := k.client.Resource(schema.GroupVersionResource{
		Group:    k.customResource.APIGroup,
		Version:  k.customResource.Version,
		Resource: k.customResource.Resource,
	}).Namespace(k.namespace).Get(ctx, pipelineID, metav1.GetOptions{})
	if err != nil {
		if errors.IsNotFound(err) {
			return service.ErrPipelineNotFound
		}
		return fmt.Errorf("get pipeline CRD: %w", err)
	}

	// Add resume annotation
	annotations := customResource.GetAnnotations()
	if annotations == nil {
		annotations = make(map[string]string)
	}

	annotations["pipeline.etl.glassflow.io/resume-requested"] = "true"
	customResource.SetAnnotations(annotations)

	// Update the resource with the resume annotation
	_, err = k.client.Resource(schema.GroupVersionResource{
		Group:    k.customResource.APIGroup,
		Version:  k.customResource.Version,
		Resource: k.customResource.Resource,
	}).Namespace(k.namespace).Update(ctx, customResource, metav1.UpdateOptions{})
	if err != nil {
		return fmt.Errorf("update pipeline CRD with resume annotation: %w", err)
	}

	k.log.Info("requested resume of k8s pipeline", slog.String("pipeline_id", pipelineID))
	return nil
}

// CheckComponentHealth implements Orchestrator.
func (k *K8sOrchestrator) CheckComponentHealth(ctx context.Context, pipelineID string) (*models.PipelineHealth, error) {
	k.log.Info("checking component health for k8s pipeline", slog.String("pipeline_id", pipelineID))

	// Get the pipeline resource to check component status
	customResource, err := k.client.Resource(schema.GroupVersionResource{
		Group:    k.customResource.APIGroup,
		Version:  k.customResource.Version,
		Resource: k.customResource.Resource,
	}).Namespace(k.namespace).Get(ctx, pipelineID, metav1.GetOptions{})
	if err != nil {
		if errors.IsNotFound(err) {
			return nil, service.ErrPipelineNotFound
		}
		return nil, fmt.Errorf("get pipeline CRD: %w", err)
	}

	// Extract status from the custom resource
	statusObj, found, err := unstructured.NestedMap(customResource.Object, "status")
	if err != nil {
		return nil, fmt.Errorf("extract status from CRD: %w", err)
	}
	if !found {
		return nil, fmt.Errorf("status not found in pipeline CRD")
	}

	// Create simplified health status
	health := &models.PipelineHealth{
		PipelineID:   pipelineID,
		PipelineName: customResource.GetName(),
		CreatedAt:    customResource.GetCreationTimestamp().Time,
		UpdatedAt:    time.Now().UTC(),
	}

	// Set overall status from phase
	if phase, found := statusObj["phase"]; found {
		if phaseStr, ok := phase.(string); ok {
			health.OverallStatus = models.PipelineStatus(phaseStr)
		}
	}

	k.log.Info("component health check completed",
		slog.String("pipeline_id", pipelineID),
		slog.String("overall_status", string(health.OverallStatus)),
	)

	return health, nil
}
