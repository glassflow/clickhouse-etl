package tests

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/cucumber/godog"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/tests/steps"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/tests/testutils"
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
		if !testutils.CheckTags(envTags, config.Tags) {
			t.Logf("Skip test suite %s, tags conflict: %s != %s", name, config.Tags, envTags)
			return
		} else {
			config.Tags = envTags
		}
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

// TestJoinComponentFeatures tests only join-related features
func testJoinFeatures(t *testing.T) {
	joinSuite := steps.NewJoinTestSuite()

	config := TestConfig{
		FeaturePaths: []string{filepath.Join("features", "join")},
		Tags:         "@join",
		Format:       "pretty",
	}

	runSingleSuite(t, "join", joinSuite, config)
}

func testPipelineFeatures(t *testing.T) {
	pipelineSuite := steps.NewPipelineSteps()

	config := TestConfig{
		FeaturePaths: []string{filepath.Join("features", "pipeline")},
		Tags:         "@pipeline",
		Format:       "pretty",
	}

	runSingleSuite(t, "pipeline", pipelineSuite, config)
}

func testIngetorFeatures(t *testing.T) {
	ingestorSuite := steps.NewIngestorTestSuite()

	config := TestConfig{
		FeaturePaths: []string{filepath.Join("features", "ingestor")},
		Tags:         "@ingestor",
		Format:       "pretty",
	}

	runSingleSuite(t, "ingestor", ingestorSuite, config)
}

func testPlatformFeatures(t *testing.T) {
	platformSuite := steps.NewPlatformSteps()

	config := TestConfig{
		FeaturePaths: []string{filepath.Join("features", "platform")},
		Tags:         "@platform",
		Format:       "pretty",
	}

	runSingleSuite(t, "platform", platformSuite, config)
}

func testAPIFeatures(t *testing.T) {
	apiSuite := steps.NewAPISteps()

	config := TestConfig{
		FeaturePaths: []string{filepath.Join("features", "api")},
		Tags:         "@api",
		Format:       "pretty",
	}

	runSingleSuite(t, "api", apiSuite, config)
}

func testBackpressureFeatures(t *testing.T) {
	bpSuite := steps.NewBackpressureTestSuite()

	config := TestConfig{
		FeaturePaths: []string{filepath.Join("features", "backpressure")},
		Tags:         "@backpressure",
		Format:       "pretty",
	}

	runSingleSuite(t, "backpressure", bpSuite, config)
}

func testRetryableFeatures(t *testing.T) {
	sinkSuite := steps.NewSinkTestSuite()

	config := TestConfig{
		FeaturePaths: []string{filepath.Join("features", "sink", "retryable.feature")},
		Tags:         "@retryable",
		Format:       "pretty",
	}

	runSingleSuite(t, "retryable", sinkSuite, config)
}

// TestFeatures runs all feature tests in parallel, each in its own container namespace.
func TestFeatures(t *testing.T) {
	t.Run("SinkFeatures", func(t *testing.T) {
		t.Parallel()
		testSinkFeatures(t)
	})
	t.Run("JoinComponentFeatures", func(t *testing.T) {
		t.Parallel()
		testJoinFeatures(t)
	})
	t.Run("PipelineFeatures", func(t *testing.T) {
		t.Parallel()
		testPipelineFeatures(t)
	})
	t.Run("IngestorFeatures", func(t *testing.T) {
		t.Parallel()
		testIngetorFeatures(t)
	})
	t.Run("PlatformFeatures", func(t *testing.T) {
		t.Parallel()
		testPlatformFeatures(t)
	})
	t.Run("APIFeatures", func(t *testing.T) {
		t.Parallel()
		testAPIFeatures(t)
	})
	t.Run("BackpressureFeatures", func(t *testing.T) {
		t.Parallel()
		testBackpressureFeatures(t)
	})
}

// TestRetryableFeatures runs only the sink retry-classification scenarios.
func TestRetryableFeatures(t *testing.T) {
	testRetryableFeatures(t)
}

// TestBackpressureFeatures runs the back-pressure propagation scenarios
func TestBackpressureFeatures(t *testing.T) {
	testBackpressureFeatures(t)
}
