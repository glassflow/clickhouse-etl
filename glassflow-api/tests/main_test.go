package tests

import (
	"testing"

	"github.com/cucumber/godog"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/tests/steps"
)

func TestFeatures(t *testing.T) {
	sinkSuite := steps.NewSinkTestSuite()
	suite := godog.TestSuite{
		ScenarioInitializer: func(s *godog.ScenarioContext) {
			sinkSuite.RegisterSteps(s)
		},
		TestSuiteInitializer: func(ts *godog.TestSuiteContext) {
			ts.AfterSuite(func() {
				if err := sinkSuite.CleanupResources(); err != nil {
					t.Logf("Error cleaning up resources: %v", err)
				}
			})
		},
		Options: &godog.Options{
			Format:   "pretty",
			Paths:    []string{"features"},
			TestingT: t,
		},
	}

	if suite.Run() != 0 {
		t.Fatal("non-zero status returned, failed to run feature tests")
	}
}
