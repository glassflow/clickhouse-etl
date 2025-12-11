package steps

import (
	"context"
	"log/slog"

	"github.com/cucumber/godog"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/api"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/pkg/tracking"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/tests/testutils"
)

type APISteps struct {
	BaseTestSuite
	log *slog.Logger
}

func NewAPISteps() *APISteps {
	return &APISteps{
		BaseTestSuite: BaseTestSuite{
			kafkaContainer: nil,
		},
		log: testutils.NewTestLogger(),
	}
}

func (a *APISteps) RegisterSteps(sc *godog.ScenarioContext) {
	logElapsedTime(sc)

	sc.Step(`^a running glassflow API server with local orchestrator$`, a.aRunningGlassflowAPIServer)
	sc.Step(`^I send a (GET|POST|PUT|DELETE|PATCH) request to "([^"]*)"$`,
		func(ctx context.Context, method, path string) (context.Context, error) {
			return a.iSendHTTPRequest(ctx, method, path, nil)
		})
	sc.Step(`^I send a (GET|POST|PUT|DELETE|PATCH) request to "([^"]*)" with body:$`, a.iSendHTTPRequest)
	sc.Step(`^the response status should be (\d+)$`, a.theResponseStatusShouldBe)
}

func (a *APISteps) SetupResources() error {
	return nil
}

func (a *APISteps) CleanupResources() error {
	return nil
}

func (a *APISteps) aRunningGlassflowAPIServer() error {
	// Create a minimal router for API-only tests
	trackingClient := tracking.NewClient("", "", "", "", false, a.log)
	a.httpRouter = api.NewRouter(a.log, nil, nil, nil, trackingClient)
	return nil
}
