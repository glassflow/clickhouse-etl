package orchestrator

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	"sigs.k8s.io/controller-runtime/pkg/client/config"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/service"
)

type K8sOrchestrator struct {
	client         *dynamic.DynamicClient
	log            *slog.Logger
	customResource CustomResourceAPIGroupVersion
}

type CustomResourceAPIGroupVersion struct {
	Resource string
	Kind     string
	APIGroup string
	Version  string
}

func NewK8sOrchestrator(
	log *slog.Logger,
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
		customResource: agv,
	}, nil
}

var _ service.Orchestrator = (*K8sOrchestrator)(nil)

// SetupPipeline implements Orchestrator.
func (k *K8sOrchestrator) SetupPipeline(ctx context.Context, cfg *models.PipelineConfig) error {
	src := make([]sourceStreams, 0, len(cfg.Ingestor.KafkaTopics))

	for _, s := range cfg.Ingestor.KafkaTopics {
		src = append(src, sourceStreams{
			TopicName:    s.Name,
			OutputStream: s.Name,
			DedupWindow:  s.Deduplication.Window.Duration(),
		})
	}

	pcfg, err := json.Marshal(*cfg)
	if err != nil {
		return fmt.Errorf("marshal pipeline config: %w", err)
	}

	spec := pipelineSpec{
		ID:  cfg.ID,
		DLQ: models.GetDLQStreamName(cfg.ID),
		Ingestor: sources{
			Type:    cfg.Ingestor.Type,
			Streams: src,
		},
		Join: join{
			Type:         "temporal",
			OutputStream: models.GetJoinedStreamName(cfg.ID),
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

	//TODO: discuss namespace
	//nolint: exhaustruct // optional config
	_, err = k.client.Resource(schema.GroupVersionResource{
		Group:    k.customResource.APIGroup,
		Version:  k.customResource.Version,
		Resource: k.customResource.Resource,
	}).
		Namespace("default").
		Create(ctx, obj, metav1.CreateOptions{})
	if err != nil {
		return fmt.Errorf("create custom resource: %w", err)
	}

	k.log.Info("created k8s pipeline", slog.String("pipeline_id", cfg.ID))

	return nil
}

// ShutdownPipeline implements Orchestrator.
func (k *K8sOrchestrator) ShutdownPipeline(_ context.Context, _ string) error {
	panic("unimplemented")
}

// TODO: include via operator library instead of copy pasting
// pipelineSpec defines the desired custom resource
type pipelineSpec struct {
	ID       string  `json:"pipeline_id"`
	DLQ      string  `json:"dlq"`
	Ingestor sources `json:"sources"`
	Join     join    `json:"join"`
	Sink     string  `json:"sink"`
	Config   string  `json:"config"`
}

type sources struct {
	Type    string          `json:"type"`
	Streams []sourceStreams `json:"topics"`
}

type sourceStreams struct {
	TopicName    string        `json:"topic_name"`
	OutputStream string        `json:"stream"`
	DedupWindow  time.Duration `json:"dedup_window"`
}

type join struct {
	Type         string `json:"type"`
	OutputStream string `json:"stream"`
	Enabled      bool   `json:"enabled"`
}
