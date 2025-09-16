package steps

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"net/http/httptest"

	"github.com/cucumber/godog"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/api"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/orchestrator"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/service"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/storage"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/tests/testutils"
)

type PlatformSteps struct {
	BaseTestSuite
	log              *slog.Logger
	pipelineManager  *service.PipelineManagerImpl
	orchestrator     service.Orchestrator
	orchestratorType string
	lastResponse     *http.Response
}

func NewPlatformSteps() *PlatformSteps {
	return &PlatformSteps{
		BaseTestSuite: BaseTestSuite{
			kafkaContainer: nil,
		},
		log: testutils.NewTestLogger(),
	}
}

func (p *PlatformSteps) RegisterSteps(ctx *godog.ScenarioContext) {
	ctx.Given(`^a running glassflow API server with local orchestrator$`, p.aRunningGlassflowAPIServerWithLocalOrchestrator)
	ctx.Given(`^a running glassflow API server with k8s orchestrator$`, p.aRunningGlassflowAPIServerWithK8sOrchestrator)
	ctx.When(`^I send a GET request to "([^"]*)"$`, p.iSendAGETRequestTo)
	ctx.Then(`^the response status should be (\d+)$`, p.theResponseStatusShouldBe)
	ctx.Then(`^the response should contain JSON:$`, p.theResponseShouldContainJSON)
	ctx.Then(`^the response should have content type "([^"]*)"$`, p.theResponseShouldHaveContentType)
}

func (p *PlatformSteps) SetupResources() error {
	if err := p.setupNATS(); err != nil {
		return fmt.Errorf("setup nats: %w", err)
	}
	return nil
}

func (p *PlatformSteps) CleanupResources() error {
	if err := p.cleanupNATS(); err != nil {
		return fmt.Errorf("cleanup nats: %w", err)
	}
	return nil
}

func (p *PlatformSteps) aRunningGlassflowAPIServerWithLocalOrchestrator() error {
	p.orchestratorType = "local"
	return p.setupServices()
}

func (p *PlatformSteps) aRunningGlassflowAPIServerWithK8sOrchestrator() error {
	p.orchestratorType = "k8s"
	return p.setupServices()
}

func (p *PlatformSteps) setupServices() error {
	// Create storage
	db, err := storage.New(context.Background(), "test-pipelines", p.natsClient.JetStream())
	if err != nil {
		return fmt.Errorf("create storage: %w", err)
	}

	// Create orchestrator based on type
	if p.orchestratorType == "local" {
		p.orchestrator = orchestrator.NewLocalOrchestrator(p.natsClient, p.log, "glassflow-pipelines")
	} else {
		// For k8s orchestrator, we'll create a mock one for testing
		p.orchestrator = &MockK8sOrchestrator{log: p.log}
	}

	// Create pipeline manager
	p.pipelineManager = service.NewPipelineManager(p.orchestrator, db)
	return nil
}

func (p *PlatformSteps) iSendAGETRequestTo(endpoint string) error {
	if endpoint != "/api/v1/platform" {
		return fmt.Errorf("unsupported endpoint: %s", endpoint)
	}

	// Create handler
	dlqSvc := service.NewDLQImpl(nil) // No DLQ client needed for platform tests
	handler := api.NewRouter(p.log, p.pipelineManager, dlqSvc)

	// Create request
	req := httptest.NewRequest("GET", endpoint, nil)
	w := httptest.NewRecorder()

	// Call handler
	handler.ServeHTTP(w, req)

	// Store response for assertions
	p.lastResponse = w.Result()
	return nil
}

func (p *PlatformSteps) theResponseStatusShouldBe(expectedStatus int) error {
	if p.lastResponse == nil {
		return fmt.Errorf("no response available")
	}

	if p.lastResponse.StatusCode != expectedStatus {
		return fmt.Errorf("expected status %d, got %d", expectedStatus, p.lastResponse.StatusCode)
	}

	return nil
}

func (p *PlatformSteps) theResponseShouldContainJSON(docString *godog.DocString) error {
	if p.lastResponse == nil {
		return fmt.Errorf("no response available")
	}

	var expectedResponse map[string]interface{}
	if err := json.Unmarshal([]byte(docString.Content), &expectedResponse); err != nil {
		return fmt.Errorf("parse expected JSON: %w", err)
	}

	var actualResponse map[string]interface{}
	if err := json.NewDecoder(p.lastResponse.Body).Decode(&actualResponse); err != nil {
		return fmt.Errorf("parse actual response: %w", err)
	}

	// Check if orchestrator type matches
	if expectedOrch, ok := expectedResponse["orchestrator"].(string); ok {
		if actualOrch, ok := actualResponse["orchestrator"].(string); ok {
			if expectedOrch != actualOrch {
				return fmt.Errorf("expected orchestrator %s, got %s", expectedOrch, actualOrch)
			}
		} else {
			return fmt.Errorf("orchestrator field not found in response")
		}
	}

	return nil
}

func (p *PlatformSteps) theResponseShouldHaveContentType(expectedContentType string) error {
	if p.lastResponse == nil {
		return fmt.Errorf("no response available")
	}

	contentType := p.lastResponse.Header.Get("Content-Type")
	if contentType != expectedContentType {
		return fmt.Errorf("expected content type %s, got %s", expectedContentType, contentType)
	}

	return nil
}

// MockK8sOrchestrator is a mock implementation for testing
type MockK8sOrchestrator struct {
	log *slog.Logger
}

func (m *MockK8sOrchestrator) GetType() string {
	return "k8s"
}

func (m *MockK8sOrchestrator) SetupPipeline(_ context.Context, _ *models.PipelineConfig) error {
	return fmt.Errorf("not implemented for testing")
}

func (m *MockK8sOrchestrator) StopPipeline(_ context.Context, _ string) error {
	return fmt.Errorf("not implemented for testing")
}

func (m *MockK8sOrchestrator) TerminatePipeline(_ context.Context, _ string) error {
	return fmt.Errorf("not implemented for testing")
}

func (m *MockK8sOrchestrator) PausePipeline(_ context.Context, _ string) error {
	return fmt.Errorf("not implemented for testing")
}

func (m *MockK8sOrchestrator) ResumePipeline(_ context.Context, _ string) error {
	return fmt.Errorf("not implemented for testing")
}
