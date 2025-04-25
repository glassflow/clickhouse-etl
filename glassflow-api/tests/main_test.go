package tests

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/cucumber/godog"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/tests/steps"
)

type TestConfig struct {
	FeaturePaths []string
	Tags         string
	Format       string
}

func runSingleSuite(
	t *testing.T,
	name string,
	testSuite interface {
		RegisterSteps(*godog.ScenarioContext)
		SetupResources() error
		CleanupResources() error
	},
	config TestConfig,
) {
	t.Helper()

	// Allow overriding tags with environment variables
	envTags := os.Getenv("TEST_TAGS")
	if envTags != "" {
		config.Tags = envTags
	}

	opts := godog.Options{
		Format:   config.Format,
		Paths:    config.FeaturePaths,
		TestingT: t,
		Tags:     config.Tags,
	}

	suite := godog.TestSuite{
		ScenarioInitializer: func(s *godog.ScenarioContext) {
			testSuite.RegisterSteps(s)
		},
		TestSuiteInitializer: func(ts *godog.TestSuiteContext) {
			ts.BeforeSuite(func() {
				if err := testSuite.SetupResources(); err != nil {
					t.Fatalf("Error setting up %s resources: %v", name, err)
				}
			})
			ts.AfterSuite(func() {
				if err := testSuite.CleanupResources(); err != nil {
					t.Logf("Error cleaning up %s resources: %v", name, err)
				}
			})
		},
		Options: &opts,
	}

	if suite.Run() != 0 {
		t.Fatalf("non-zero status returned, failed to run %s tests", name)
	}
}

// TestSinkFeatures tests only sink-related features
func testSinkFeatures(t *testing.T) {
	sinkSuite := steps.NewSinkTestSuite()

	config := TestConfig{
		FeaturePaths: []string{filepath.Join("features", "sink")},
		Tags:         "@sink",
		Format:       "pretty",
	}

	runSingleSuite(t, "sink", sinkSuite, config)
}

// TestJoinOperatorFeatures tests only join-operator-related features
func testJoinFeatures(t *testing.T) {
	joinSuite := steps.NewJoinTestSuite()

	config := TestConfig{
		FeaturePaths: []string{filepath.Join("features", "join")},
		Tags:         "@join",
		Format:       "pretty",
	}

	runSingleSuite(t, "join", joinSuite, config)
}

// TestFeatures runs all feature tests but in separate contexts
func TestFeatures(t *testing.T) {
	// Run tests in subtests to isolate them
	t.Run("SinkFeatures", testSinkFeatures)
	t.Run("JoinOperatorFeatures", testJoinFeatures)
}
