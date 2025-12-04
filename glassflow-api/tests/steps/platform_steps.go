package steps

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
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
	pipelineService  *service.PipelineService
	orchestrator     service.Orchestrator
	orchestratorType string
}

func NewPlatformSteps() *PlatformSteps {
	return &PlatformSteps{
		BaseTestSuite: BaseTestSuite{
			kafkaContainer: nil,
		},
		log: testutils.NewTestLogger(),
	}
}

func (p *PlatformSteps) RegisterSteps(sc *godog.ScenarioContext) {
	logElapsedTime(sc)
	sc.Given(`^a running glassflow API server with local orchestrator$`, p.aRunningGlassflowAPIServerWithLocalOrchestrator)
	sc.Given(`^a running glassflow API server with k8s orchestrator$`, p.aRunningGlassflowAPIServerWithK8sOrchestrator)
	sc.Step(`^I send a (GET|POST|PUT|DELETE|PATCH) request to "([^"]*)"$`,
		func(ctx context.Context, method, path string) (context.Context, error) {
			return p.iSendHTTPRequest(ctx, method, path, nil)
		})
	sc.Step(`^I send a (GET|POST|PUT|DELETE|PATCH) request to "([^"]*)" with body:$`, p.iSendHTTPRequest)
	sc.Then(`^the response status should be (\d+)$`, p.theResponseStatusShouldBe)
	sc.Then(`^the response should contain JSON:$`, p.theResponseShouldContainJSON)
	sc.Then(`^the response should have content type "([^"]*)"$`, p.theResponseShouldHaveContentType)
}

func (p *PlatformSteps) SetupResources() error {
	if err := p.setupNATS(); err != nil {
		return fmt.Errorf("setup nats: %w", err)
	}
	return nil
}

func (p *PlatformSteps) CleanupResources() error {
	var errs []error

	if err := p.cleanupNATS(); err != nil {
		errs = append(errs, fmt.Errorf("cleanup nats: %w", err))
	}

	if err := p.cleanupPostgres(); err != nil {
		errs = append(errs, fmt.Errorf("cleanup postgres: %w", err))
	}

	err := testutils.CombineErrors(errs)
	if err != nil {
		return fmt.Errorf("cleanup resources: %w", err)
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
	// Setup Postgres container if not already set up
	if p.postgresContainer == nil {
		postgresContainer, err := testutils.StartPostgresContainer(context.Background())
		if err != nil {
			return fmt.Errorf("start postgres container: %w", err)
		}
		p.postgresContainer = postgresContainer
		// Migrations are automatically run in StartPostgresContainer()
	}

	// Create storage
	db, err := storage.NewPipelineStore(context.Background(), p.postgresContainer.GetDSN(), p.log)
	if err != nil {
		return fmt.Errorf("create postgres storage: %w", err)
	}

	// Create orchestrator based on type
	if p.orchestratorType == "local" {
		p.orchestrator = orchestrator.NewLocalOrchestrator(p.natsClient, p.log)
	} else {
		// For k8s orchestrator, we'll create a mock one for testing
		p.orchestrator = &MockK8sOrchestrator{log: p.log}
	}

	// Create pipeline manager
	p.pipelineService = service.NewPipelineService(p.orchestrator, db, p.log)

	// Create HTTP router
	p.httpRouter = api.NewRouter(p.log, p.pipelineService, nil, nil)

	return nil
}

func (p *PlatformSteps) theResponseShouldContainJSON(ctx context.Context, docString *godog.DocString) error {
	w, ok := ctx.Value(httpResponseKey{}).(*httptest.ResponseRecorder)
	if !ok || w == nil {
		return fmt.Errorf("no HTTP response found in context")
	}

	var expectedResponse map[string]interface{}
	if err := json.Unmarshal([]byte(docString.Content), &expectedResponse); err != nil {
		return fmt.Errorf("parse expected JSON: %w", err)
	}

	var actualResponse map[string]interface{}
	if err := json.NewDecoder(w.Body).Decode(&actualResponse); err != nil {
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

func (p *PlatformSteps) theResponseShouldHaveContentType(ctx context.Context, expectedContentType string) error {
	w, ok := ctx.Value(httpResponseKey{}).(*httptest.ResponseRecorder)
	if !ok || w == nil {
		return fmt.Errorf("no HTTP response found in context")
	}

	contentType := w.Header().Get("Content-Type")
	if contentType != expectedContentType {
		return fmt.Errorf("expected content type %s, got %s", expectedContentType, contentType)
	}

	return nil
}

// MockK8sOrchestrator is a mock implementation for testing
type MockK8sOrchestrator struct {
	log *slog.Logger
}

func (m *MockK8sOrchestrator) DeletePipeline(ctx context.Context, pid string) error {
	//TODO implement me
	panic("implement me")
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

func (m *MockK8sOrchestrator) ResumePipeline(_ context.Context, _ string, _ *models.PipelineConfig) error {
	return fmt.Errorf("not implemented for testing")
}

func (m *MockK8sOrchestrator) EditPipeline(_ context.Context, _ string, _ *models.PipelineConfig) error {
	return fmt.Errorf("not implemented for testing")
}
