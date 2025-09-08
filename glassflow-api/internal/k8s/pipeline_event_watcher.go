package k8s

import (
	"context"
	"fmt"
	"log/slog"
	"os"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
)

// PipelineEventWatcher watches Kubernetes events for pipeline pause/resume signals
type PipelineEventWatcher struct {
	clientset    *kubernetes.Clientset
	namespace    string
	pipelineName string
	log          *slog.Logger
	onPause      func() error
	onResume     func() error
	stopCh       chan struct{}
}

// NewPipelineEventWatcher creates a new pipeline event watcher
func NewPipelineEventWatcher(pipelineName string, log *slog.Logger, onPause, onResume func() error) (*PipelineEventWatcher, error) {
	// Get Kubernetes config
	config, err := getKubernetesConfig()
	if err != nil {
		return nil, fmt.Errorf("failed to get kubernetes config: %w", err)
	}

	// Create clientset
	clientset, err := kubernetes.NewForConfig(config)
	if err != nil {
		return nil, fmt.Errorf("failed to create kubernetes clientset: %w", err)
	}

	// Events are associated with the Pipeline resource, which is in the default namespace
	// regardless of where the component pods are running
	namespace := "default"

	return &PipelineEventWatcher{
		clientset:    clientset,
		namespace:    namespace,
		pipelineName: pipelineName,
		log:          log,
		onPause:      onPause,
		onResume:     onResume,
		stopCh:       make(chan struct{}),
	}, nil
}

// Start starts watching for pipeline events
func (w *PipelineEventWatcher) Start(ctx context.Context) error {
	w.log.Info("starting pipeline event watcher",
		slog.String("pipeline_name", w.pipelineName),
		slog.String("namespace", w.namespace))

	// Watch events for our specific pipeline
	watcher, err := w.clientset.CoreV1().Events(w.namespace).Watch(ctx, metav1.ListOptions{
		FieldSelector: fields.OneTermEqualSelector("involvedObject.name", w.pipelineName).String(),
	})
	if err != nil {
		return fmt.Errorf("failed to create event watcher: %w", err)
	}
	defer watcher.Stop()

	// Handle events
	for {
		select {
		case event := <-watcher.ResultChan():
			if event.Type == watch.Added || event.Type == watch.Modified {
				k8sEvent := event.Object.(*corev1.Event)
				w.processEvent(k8sEvent)
			}
		case <-w.stopCh:
			w.log.Info("pipeline event watcher stopped")
			return nil
		case <-ctx.Done():
			w.log.Info("pipeline event watcher context cancelled")
			return ctx.Err()
		}
	}
}

// Stop stops the event watcher
func (w *PipelineEventWatcher) Stop() {
	close(w.stopCh)
}

// processEvent processes a Kubernetes event
func (w *PipelineEventWatcher) processEvent(event *corev1.Event) {
	w.log.Info("received pipeline event",
		slog.String("reason", event.Reason),
		slog.String("type", event.Type),
		slog.String("message", event.Message))

	switch event.Reason {
	case "PauseRequested":
		w.log.Info("pause request received from operator")
		if err := w.onPause(); err != nil {
			w.log.Error("failed to pause pipeline", slog.Any("error", err))
		} else {
			w.log.Info("pipeline paused successfully")
		}

	case "Paused":
		w.log.Info("pipeline pause completed", slog.String("message", event.Message))

	case "ResumeRequested":
		w.log.Info("resume request received from operator")
		if err := w.onResume(); err != nil {
			w.log.Error("failed to resume pipeline", slog.Any("error", err))
		} else {
			w.log.Info("pipeline resumed successfully")
		}

	case "Resumed":
		w.log.Info("pipeline resume completed", slog.String("message", event.Message))

	default:
		w.log.Debug("ignoring event", slog.String("reason", event.Reason))
	}
}

// getKubernetesConfig gets the Kubernetes configuration
func getKubernetesConfig() (*rest.Config, error) {
	// Try in-cluster config first
	if config, err := rest.InClusterConfig(); err == nil {
		return config, nil
	}

	// Fall back to kubeconfig file
	kubeconfig := os.Getenv("KUBECONFIG")
	if kubeconfig == "" {
		kubeconfig = os.Getenv("HOME") + "/.kube/config"
	}

	return clientcmd.BuildConfigFromFlags("", kubeconfig)
}
