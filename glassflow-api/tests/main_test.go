package tests

import (
	"os"
	"testing"

	"github.com/cucumber/godog"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/tests/steps"
)

func TestFeatures(t *testing.T) {
	sinkSuite := steps.NewSinkTestSuite()
	joinSuite := steps.NewJoinOperatorTestSuite()

	testTags := os.Getenv("TEST_TAGS")

	paths := []string{"features"}

	opts := godog.Options{
		Format:   "pretty",
		Paths:    paths,
		TestingT: t,
		Tags:     testTags,
	}

	// Parse command line flags
	godog.BindCommandLineFlags("godog.", &opts)

	suite := godog.TestSuite{
		ScenarioInitializer: func(s *godog.ScenarioContext) {
			sinkSuite.RegisterSteps(s)
			joinSuite.RegisterSteps(s)
		},
		TestSuiteInitializer: func(ts *godog.TestSuiteContext) {
			ts.AfterSuite(func() {
				if err := sinkSuite.CleanupResources(); err != nil {
					t.Logf("Error cleaning up sink resources: %v", err)
				}
				if err := joinSuite.CleanupResources(); err != nil {
					t.Logf("Error cleaning up join resources: %v", err)
				}
			})
		},
		Options: &opts,
	}

	if suite.Run() != 0 {
		t.Fatal("non-zero status returned, failed to run feature tests")
	}
}
