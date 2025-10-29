package steps

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"time"

	"github.com/avast/retry-go"
	"github.com/cucumber/godog"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/api"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/client"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/dlq"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/orchestrator"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/service"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/storage"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/tests/testutils"
)

type PipelineSteps struct {
	BaseTestSuite
	kTopics    []string
	streamName string
	chDB       string
	chTable    string
	log        *slog.Logger

	pipelineService   *service.PipelineService
	orchestrator      *orchestrator.LocalOrchestrator
	currentPipelineID string

	httpRouter http.Handler
}

func NewPipelineSteps() *PipelineSteps {
	return &PipelineSteps{ //nolint:exhaustruct // only necessary fields
		BaseTestSuite: BaseTestSuite{ //nolint:exhaustruct // only necessary fields
			kafkaContainer: nil,
		},
		kTopics: make([]string, 0),
		log:     testutils.NewTestLogger(),
	}
}

func (p *PipelineSteps) theKafkaTopic(topic string, partitions int) error {
	err := p.createKafkaTopic(topic, partitions)
	if err != nil {
		return fmt.Errorf("create kafka topic: %w", err)
	}

	p.kTopics = append(p.kTopics, topic)

	return nil
}

func (p *PipelineSteps) cleanTopic(topicName string) error {
	if topicName == "" {
		return nil
	}

	err := p.deleteKafkaTopic(topicName)
	if err != nil {
		return fmt.Errorf("delete kafka topic %s: %w", topicName, err)
	}

	return nil
}

func (p *PipelineSteps) aRunningNATSJetStream(streamName, subjectName string) error {
	err := p.createStream(streamName, subjectName, 0)
	if err != nil {
		return fmt.Errorf("create nats stream: %w", err)
	}

	p.streamName = streamName

	return nil
}

func (p *PipelineSteps) cleanNatsStream() error {
	if p.streamName == "" {
		return nil
	}

	err := p.deleteAllStreams()
	if err != nil {
		return fmt.Errorf("delete nats stream: %w", err)
	}

	return nil
}

func (p *PipelineSteps) cleanClickHouseTable() error {
	if p.chTable == "" {
		return nil
	}
	conn, err := p.chContainer.GetConnection()
	if err != nil {
		return fmt.Errorf("get clickhouse connection: %w", err)
	}
	defer conn.Close()

	tableName := p.chDB + "." + p.chTable

	query := "DROP TABLE IF EXISTS " + tableName
	err = conn.Exec(context.Background(), query)
	if err != nil {
		return fmt.Errorf("drop table %s: %w", tableName, err)
	}
	return nil
}

func (p *PipelineSteps) SetupResources() error {
	var errs []error
	if p.kafkaContainer == nil {
		err := p.setupKafka()
		if err != nil {
			errs = append(errs, err)
		}
	}

	if p.natsContainer == nil {
		err := p.setupNATS()
		if err != nil {
			errs = append(errs, err)
		}
	}

	if p.chContainer == nil {
		err := p.setupCH()
		if err != nil {
			errs = append(errs, err)
		}
	}

	err := testutils.CombineErrors(errs)
	if err != nil {
		return fmt.Errorf("setup resources: %w", err)
	}

	return nil
}

func (p *PipelineSteps) fastCleanup() error {
	var errs []error

	for len(p.kTopics) > 0 {
		topicName := p.kTopics[0]
		err := p.cleanTopic(topicName)
		if err != nil {
			errs = append(errs, err)
		}
		p.kTopics = p.kTopics[1:]
	}

	err := p.cleanNatsStream()
	if err != nil {
		errs = append(errs, err)
	}

	err = p.cleanClickHouseTable()
	if err != nil {
		errs = append(errs, err)
	}

	if p.pipelineService != nil {
		pipelineID := p.orchestrator.ActivePipelineID()

		// Try to stop the pipeline first
		err = p.pipelineService.StopPipeline(context.Background(), pipelineID)
		if err != nil {
			// Log the error but continue - pipeline might already be stopped or not exist
			p.log.Info("stop pipeline failed (might already be stopped)", slog.Any("error", err))
		}

		// Always try to delete the pipeline from KV store to ensure cleanup
		err = p.pipelineService.DeletePipeline(context.Background(), pipelineID)
		if err != nil {
			// Log the error but continue - pipeline might already be deleted
			p.log.Info("delete pipeline failed (might already be deleted)", slog.Any("error", err))
		}

		p.pipelineService = nil
	}

	err = testutils.CombineErrors(errs)
	if err != nil {
		return fmt.Errorf("fast cleanup resources: %w", err)
	}

	return nil
}

func (p *PipelineSteps) CleanupResources() error {
	var errs []error

	if p.kafkaContainer != nil {
		err := p.cleanupKafka()
		if err != nil {
			errs = append(errs, err)
		}
	}

	if p.natsContainer != nil {
		err := p.cleanupNATS()
		if err != nil {
			errs = append(errs, err)
		}
	}

	if p.chContainer != nil {
		err := p.cleanupCH()
		if err != nil {
			errs = append(errs, err)
		}
	}

	err := testutils.CombineErrors(errs)
	if err != nil {
		return fmt.Errorf("cleanup resources: %w", err)
	}
	return nil
}

func (p *PipelineSteps) theClickHouseTableAlreadyExistsWithSchema(tableName string, db string, schema *godog.Table) error {
	conn, err := p.chContainer.GetConnection()
	if err != nil {
		return fmt.Errorf("get clickhouse connection: %w", err)
	}

	defer conn.Close()

	columns := make([]string, 0, len(schema.Rows)-1)
	for i, row := range schema.Rows {
		if i == 0 {
			continue
		}

		if len(row.Cells) < 2 {
			return fmt.Errorf("invalid schema row: %v", row)
		}

		columns = append(columns, fmt.Sprintf("%s %s", row.Cells[0].Value, row.Cells[1].Value))
	}

	query := fmt.Sprintf("CREATE TABLE IF NOT EXISTS %s.%s (%s) ENGINE = Memory", db, tableName, strings.Join(columns, ", "))
	err = conn.Exec(context.Background(), query)
	if err != nil {
		return fmt.Errorf("create table: %w", err)
	}

	p.chDB = db
	p.chTable = tableName

	return nil
}

func (p *PipelineSteps) iPublishEventsToKafka(topic string, table *godog.Table) error {
	p.log.Info("Publishing events to Kafka topic", slog.String("topic", topic))
	err := p.publishEventsToKafka(topic, table)
	if err != nil {
		return fmt.Errorf("publish events to kafka: %w", err)
	}

	p.log.Info("Published events to Kafka topic", slog.String("topic", topic), slog.Int("events_count", len(table.Rows)-1))

	return nil
}

func (p *PipelineSteps) iPublishAMessageToNATSStream(streamName, subjectName string, data *godog.DocString) error {
	err := p.createStream(streamName, subjectName, 0)
	if err != nil {
		return fmt.Errorf("create nats stream: %w", err)
	}

	js := p.natsClient.JetStream()
	_, err = js.Publish(context.Background(), subjectName, []byte(data.Content))
	if err != nil {
		return fmt.Errorf("publish message to subject %s: %w", subjectName, err)
	}

	p.log.Info("Published message to NATS stream",
		slog.String("stream", streamName),
		slog.String("subject", subjectName))

	return nil
}

func (p *PipelineSteps) thePipelineStatusShouldBe(expectedStatus string) error {
	p.log.Info("Checking pipeline status", slog.String("expected_status", expectedStatus))

	// Get the current pipeline status
	pipeline, err := p.pipelineService.GetPipeline(context.Background(), p.currentPipelineID)
	if err != nil {
		return fmt.Errorf("failed to get pipeline: %w", err)
	}

	actualStatus := string(pipeline.Status.OverallStatus)
	p.log.Info("Pipeline status check",
		slog.String("expected", expectedStatus),
		slog.String("actual", actualStatus))

	if actualStatus != expectedStatus {
		return fmt.Errorf("pipeline status mismatch: expected %s, got %s", expectedStatus, actualStatus)
	}

	return nil
}

func (p *PipelineSteps) preparePipelineConfig(cfg string) (*models.PipelineConfig, error) {
	var pc models.PipelineConfig

	err := json.Unmarshal([]byte(cfg), &pc)
	if err != nil {
		return nil, fmt.Errorf("unmarshal pipeline config: %w", err)
	}

	pc.Ingestor.KafkaConnectionParams.Brokers = []string{p.kafkaContainer.GetURI()}
	pc.Ingestor, err = models.NewIngestorComponentConfig(
		pc.Ingestor.Provider,
		pc.Ingestor.KafkaConnectionParams,
		pc.Ingestor.KafkaTopics,
	)
	if err != nil {
		return nil, fmt.Errorf("create ingestor component config: %w", err)
	}

	pc.Sink.ClickHouseConnectionParams.Host = "localhost"
	pc.Sink.ClickHouseConnectionParams.Port, err = p.chContainer.GetPort()
	if err != nil {
		return nil, fmt.Errorf("get clickhouse port: %w", err)
	}

	pc.Sink.ClickHouseConnectionParams.Username = "default"
	pc.Sink.ClickHouseConnectionParams.Password = base64.StdEncoding.EncodeToString([]byte("default"))
	pc.Sink.ClickHouseConnectionParams.Database = p.chDB
	pc.Sink.ClickHouseConnectionParams.Table = p.chTable

	return &pc, nil
}

func (p *PipelineSteps) setupPipelineService() error {
	if p.pipelineService != nil {
		return fmt.Errorf("pipeline manager already initialized")
	}

	natsClient, err := client.NewNATSClient(context.Background(), p.natsContainer.GetURI(), client.WithMaxAge(time.Hour))
	if err != nil {
		return fmt.Errorf("create nats client: %w", err)
	}

	db, err := storage.New(context.Background(), "glassflow-pipeline-test", natsClient.JetStream())
	if err != nil {
		return fmt.Errorf("create nats pipeline storage: %w", err)
	}

	orch := orchestrator.NewLocalOrchestrator(natsClient, p.log)
	p.orchestrator = orch.(*orchestrator.LocalOrchestrator)

	p.pipelineService = service.NewPipelineService(
		orch,
		db,
		p.log,
	)

	p.httpRouter = api.NewRouter(p.log, p.pipelineService, dlq.NewClient(natsClient), nil)

	return nil
}

func (p *PipelineSteps) aGlassflowPipelineWithNextConfiguration(config *godog.DocString) error {
	pipelineConfig, err := p.preparePipelineConfig(config.Content)
	if err != nil {
		return fmt.Errorf("prepare pipeline config: %w", err)
	}

	// Store the current pipeline ID for later use
	p.currentPipelineID = pipelineConfig.ID

	err = p.setupPipelineService()
	if err != nil {
		return fmt.Errorf("setup pipeline manager: %w", err)
	}

	err = p.pipelineService.CreatePipeline(context.Background(), pipelineConfig)
	if err != nil {
		return fmt.Errorf("setup pipeline: %w", err)
	}

	return nil
}

func (p *PipelineSteps) theClickHouseTableShouldContainRows(tableName string, count int) error {
	err := p.clickhouseShouldContainNumberOfRows(tableName, count)
	if err != nil {
		return fmt.Errorf("check clickhouse table %s: %w", tableName, err)
	}

	return nil
}

func (p *PipelineSteps) theClickHouseTableShouldContain(tableName string, table *godog.Table) error {
	err := p.clickhouseShouldContainData(tableName, table)
	if err != nil {
		return fmt.Errorf("check clickhouse table %s: %w", tableName, err)
	}

	return nil
}

func (p *PipelineSteps) shutdownPipeline() error {
	p.log.Info("Shutting down pipeline")
	if p.pipelineService == nil {
		return fmt.Errorf("pipeline manager not initialized")
	}

	pipelineID := p.orchestrator.ActivePipelineID()

	// Try to stop the pipeline first
	err := p.pipelineService.StopPipeline(context.Background(), pipelineID)
	if err != nil {
		// Log the error but continue - pipeline might already be stopped or not exist
		p.log.Info("stop pipeline failed (might already be stopped)", slog.Any("error", err))
	}

	err = retry.Do(
		func() error {
			pipeline, err := p.pipelineService.GetPipeline(context.Background(), pipelineID)
			if err != nil {
				return err
			}
			if pipeline.Status.OverallStatus == internal.PipelineStatusFailed || pipeline.Status.OverallStatus == internal.PipelineStatusStopped {
				return nil
			}
			return fmt.Errorf("pipeline %s is not finished", pipelineID)
		},
		retry.Attempts(100),
		retry.DelayType(retry.FixedDelay),
		retry.Delay(time.Millisecond*25),
	)
	if err != nil {
		return fmt.Errorf("acknowledge message: %w", err)
	}

	return nil
}

func (p *PipelineSteps) shutdownPipelineWithDelay(delay string) error {
	p.log.Info("Shutting down pipeline with delay", slog.String("delay", delay))
	dur, err := time.ParseDuration(delay)
	if err != nil {
		return fmt.Errorf("parse duration: %w", err)
	}
	time.Sleep(dur)
	p.log.Info("slept for: ", slog.String("delay", delay))

	err = p.shutdownPipeline()
	if err != nil {
		return fmt.Errorf("shutdown pipeline: %w", err)
	}

	p.pipelineService = nil

	p.log.Info("Pipeline shutdown completed after delay")

	return nil
}

func (p *PipelineSteps) resumePipeline() error {
	p.log.Info("Resuming pipeline")
	if p.pipelineService == nil {
		return fmt.Errorf("pipeline manager not initialized")
	}

	err := p.pipelineService.ResumePipeline(context.Background(), p.orchestrator.ActivePipelineID())
	if err != nil {
		return fmt.Errorf("resume pipeline: %w", err)
	}

	p.log.Info("Pipeline resumed successfully")
	return nil
}

func (p *PipelineSteps) resumePipelineWithDelay(delay string) error {
	p.log.Info("Resuming pipeline with delay", slog.String("delay", delay))
	dur, err := time.ParseDuration(delay)
	if err != nil {
		return fmt.Errorf("parse duration: %w", err)
	}

	time.Sleep(dur)

	err = p.resumePipeline()
	if err != nil {
		return fmt.Errorf("resume pipeline: %w", err)
	}

	p.log.Info("Pipeline resumed after delay")
	return nil
}

func (p *PipelineSteps) waitFor(duration string) error {
	p.log.Info("Waiting", slog.String("duration", duration))
	dur, err := time.ParseDuration(duration)
	if err != nil {
		return fmt.Errorf("parse duration: %w", err)
	}

	time.Sleep(dur)
	p.log.Info("Wait completed")
	return nil
}

// waitForPauseOperationComplete waits for the pause operation to complete
func (p *PipelineSteps) waitForPauseOperationComplete(duration string) error {
	p.log.Info("Waiting for pause operation to complete", slog.String("duration", duration))
	return p.waitFor(duration)
}

// editGlassflowPipeline edits the glassflow pipeline with the given configuration
func (p *PipelineSteps) editGlassflowPipeline(configJSON *godog.DocString) error {
	if p.currentPipelineID == "" {
		return fmt.Errorf("no current pipeline to edit")
	}

	// Parse the configuration JSON
	var config map[string]interface{}
	err := json.Unmarshal([]byte(configJSON.Content), &config)
	if err != nil {
		return fmt.Errorf("failed to parse pipeline configuration JSON: %w", err)
	}

	// Make HTTP request to edit pipeline endpoint
	url := fmt.Sprintf("http://localhost:8080/api/v1/pipeline/%s/edit", p.currentPipelineID)

	reqBody, err := json.Marshal(config)
	if err != nil {
		return fmt.Errorf("failed to marshal request body: %w", err)
	}

	resp, err := http.Post(url, "application/json", bytes.NewBuffer(reqBody))
	if err != nil {
		return fmt.Errorf("failed to make edit pipeline request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusNoContent {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("edit pipeline request failed with status %d: %s", resp.StatusCode, string(body))
	}

	p.log.Info("Pipeline edit request sent successfully", slog.String("pipeline_id", p.currentPipelineID))
	return nil
}

// editGlassflowPipelineAndExpectError edits the glassflow pipeline and expects an error
func (p *PipelineSteps) editGlassflowPipelineAndExpectError(configJSON *godog.DocString, expectedError *godog.DocString) error {
	if p.currentPipelineID == "" {
		return fmt.Errorf("no current pipeline to edit")
	}

	// Parse the configuration JSON
	var config map[string]interface{}
	err := json.Unmarshal([]byte(configJSON.Content), &config)
	if err != nil {
		return fmt.Errorf("failed to parse pipeline configuration JSON: %w", err)
	}

	// Make HTTP request to edit pipeline endpoint
	url := fmt.Sprintf("http://localhost:8080/api/v1/pipeline/%s/edit", p.currentPipelineID)

	reqBody, err := json.Marshal(config)
	if err != nil {
		return fmt.Errorf("failed to marshal request body: %w", err)
	}

	resp, err := http.Post(url, "application/json", bytes.NewBuffer(reqBody))
	if err != nil {
		return fmt.Errorf("failed to make edit pipeline request: %w", err)
	}
	defer resp.Body.Close()

	// Read response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read response body: %w", err)
	}

	// Check if we got the expected error
	if resp.StatusCode == http.StatusNoContent {
		return fmt.Errorf("expected error but got success (status 204)")
	}

	// Check if the error message contains the expected text
	if !strings.Contains(string(body), expectedError.Content) {
		return fmt.Errorf("expected error message '%s' but got: %s", expectedError.Content, string(body))
	}

	p.log.Info("Pipeline edit request failed as expected",
		slog.String("pipeline_id", p.currentPipelineID),
		slog.String("expected_error", expectedError.Content),
		slog.Int("status_code", resp.StatusCode))
	return nil
}

type httpResponseKey struct{}

func (p *PipelineSteps) iSendHTTPRequest(ctx context.Context, method, path string, body *godog.DocString) (context.Context, error) {
	if p.httpRouter == nil {
		return ctx, fmt.Errorf("HTTP router not initialized")
	}

	var reqBody io.Reader
	if body != nil && body.Content != "" {
		reqBody = bytes.NewBufferString(body.Content)
	}

	// Create request using httptest
	req := httptest.NewRequest(method, path, reqBody)
	if reqBody != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	// Create response recorder
	w := httptest.NewRecorder()

	// Execute request through router
	p.httpRouter.ServeHTTP(w, req)

	p.log.Info("HTTP request executed",
		slog.String("method", method),
		slog.String("path", path),
		slog.Int("status", w.Code))

	return context.WithValue(ctx, httpResponseKey{}, w), nil
}

func (p *PipelineSteps) RegisterSteps(sc *godog.ScenarioContext) {
	logElapsedTime(sc)

	sc.Step(`^a Kafka topic "([^"]*)" with (\d+) partition`, p.theKafkaTopic)
	sc.Step(`^a running NATS stream "([^"]*)" with subject "([^"]*)"$`, p.aRunningNATSJetStream)
	sc.Step(`^the ClickHouse table "([^"]*)" on database "([^"]*)" already exists with schema$`, p.theClickHouseTableAlreadyExistsWithSchema)
	sc.Step(`^a ClickHouse table "([^"]*)" on database "([^"]*)" with schema$`, p.theClickHouseTableAlreadyExistsWithSchema)

	sc.Step(`^I write these events to Kafka topic "([^"]*)":$`, p.iPublishEventsToKafka)
	sc.Step(`^I publish a message to NATS stream "([^"]*)" with subject "([^"]*)"$`, p.iPublishAMessageToNATSStream)
	sc.Step(`^I wait for "([^"]*)"$`, p.waitFor)
	sc.Step(`^I wait for "([^"]*)" to let pause operation complete$`, p.waitForPauseOperationComplete)

	sc.Step(`^a glassflow pipeline with next configuration:$`, p.aGlassflowPipelineWithNextConfiguration)
	sc.Step(`^I shutdown the glassflow pipeline after "([^"]*)"$`, p.shutdownPipelineWithDelay)
	sc.Step(`^I resume the glassflow pipeline$`, p.resumePipeline)
	sc.Step(`^I resume the glassflow pipeline after "([^"]*)"$`, p.resumePipelineWithDelay)
	sc.Step(`^I edit the glassflow pipeline with next configuration:$`, p.editGlassflowPipeline)
	sc.Step(`^I edit the glassflow pipeline and expect error:$`, p.editGlassflowPipelineAndExpectError)

	sc.Step(`^I send a (GET|POST|PUT|DELETE|PATCH) request to "([^"]*)"$`,
		func(ctx context.Context, method, path string) (context.Context, error) {
			return p.iSendHTTPRequest(ctx, method, path, nil)
		})
	sc.Step(`^I send a (GET|POST|PUT|DELETE|PATCH) request to "([^"]*)" with body:$`, p.iSendHTTPRequest)

	sc.Step(`^the pipeline status should be "([^"]*)"$`, p.thePipelineStatusShouldBe)
	sc.Step(`^the ClickHouse table "([^"]*)" should contain (\d+) rows$`, p.theClickHouseTableShouldContainRows)
	sc.Step(`^the ClickHouse table "([^"]*)" should contain:`, p.theClickHouseTableShouldContain)
	sc.Step(`^the ClickHouse table "([^"]*)" should contain row with values$`, p.theClickHouseTableShouldContain)
	sc.Step(`^NATS stream "([^"]*)" with subject "([^"]*)" should contain (\d+) events$`, p.natsStreamSubjectHasNEvents)

	sc.After(func(ctx context.Context, _ *godog.Scenario, _ error) (context.Context, error) {
		cleanupErr := p.fastCleanup()
		if cleanupErr != nil {
			return ctx, cleanupErr
		}
		return ctx, nil
	})
}
