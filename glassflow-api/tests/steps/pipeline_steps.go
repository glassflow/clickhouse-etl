package steps

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/cucumber/godog"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/client"
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

	pipelineManager *service.PipelineManagerImpl
	orchestrator    *orchestrator.LocalOrchestrator
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

	if p.pipelineManager != nil {
		err = p.pipelineManager.DeletePipeline(context.Background(), p.orchestrator.ActivePipelineID())
		if err != nil {
			errs = append(errs, err)
		}
		p.pipelineManager = nil
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
	if len(table.Rows) < 2 {
		return fmt.Errorf("invalid table format, expected at least 2 rows")
	}

	events := make([]testutils.KafkaEvent, 0, len(table.Rows)-1)

	// Skip the header row
	for i := 1; i < len(table.Rows); i++ {
		row := table.Rows[i]
		if len(row.Cells) < 2 {
			return fmt.Errorf("invalid event row format, expected at least key and value columns")
		}

		key := row.Cells[0].Value
		jsonData := row.Cells[1].Value

		events = append(events, testutils.KafkaEvent{
			Key:   key,
			Value: []byte(jsonData),
		})
	}

	err := p.createKafkaWriter()
	if err != nil {
		return fmt.Errorf("create kafka writer: %w", err)
	}

	err = p.kWriter.WriteJSONEvents(topic, events)
	if err != nil {
		return fmt.Errorf("write events to kafka: %w", err)
	}

	p.log.Info("Published events to Kafka topic", slog.String("topic", topic), slog.Int("events_count", len(events)))

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

func (p *PipelineSteps) setupPipelineManager() error {
	if p.pipelineManager != nil {
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

	orch := orchestrator.NewLocalOrchestrator(natsClient, db, p.log)
	p.orchestrator = orch.(*orchestrator.LocalOrchestrator)

	p.pipelineManager = service.NewPipelineManager(
		orch,
		db,
	)

	return nil
}

func (p *PipelineSteps) aGlassflowPipelineWithNextConfiguration(config *godog.DocString) error {
	pipelineConfig, err := p.preparePipelineConfig(config.Content)
	if err != nil {
		return fmt.Errorf("prepare pipeline config: %w", err)
	}

	err = p.setupPipelineManager()
	if err != nil {
		return fmt.Errorf("setup pipeline manager: %w", err)
	}

	err = p.pipelineManager.CreatePipeline(context.Background(), pipelineConfig)
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
	if p.pipelineManager == nil {
		return fmt.Errorf("pipeline manager not initialized")
	}

	err := p.pipelineManager.DeletePipeline(context.Background(), p.orchestrator.ActivePipelineID())
	if err != nil {
		return fmt.Errorf("shutdown pipeline: %w", err)
	}

	p.pipelineManager = nil

	p.log.Info("Pipeline shutdown completed after delay")

	return nil
}

func (p *PipelineSteps) shutdownPipelineWithDelay(delay string) error {
	p.log.Info("Shutting down pipeline with delay", slog.String("delay", delay))
	dur, err := time.ParseDuration(delay)
	if err != nil {
		return fmt.Errorf("parse duration: %w", err)
	}

	time.Sleep(dur)

	err = p.shutdownPipeline()
	if err != nil {
		return fmt.Errorf("shutdown pipeline: %w", err)
	}

	p.pipelineManager = nil

	p.log.Info("Pipeline shutdown completed after delay")

	return nil
}

func (p *PipelineSteps) iProduceTheseMessagesToKafkaTopic(topic string, table *godog.Table) error {
	return p.iPublishEventsToKafka(topic, table)
}

func (p *PipelineSteps) iWaitForForMessagesToBeProcessed(duration string) error {
	dur, err := time.ParseDuration(duration)
	if err != nil {
		return fmt.Errorf("parse duration: %w", err)
	}

	time.Sleep(dur)
	return nil
}

func (p *PipelineSteps) iWaitForForAnyProcessingToComplete(duration string) error {
	return p.iWaitForForMessagesToBeProcessed(duration)
}

func (p *PipelineSteps) iPauseThePipeline(pipelineID string) error {
	if p.pipelineManager == nil {
		return fmt.Errorf("pipeline manager not initialized")
	}

	ctx := context.Background()
	err := p.pipelineManager.PausePipeline(ctx, pipelineID)
	if err != nil {
		return fmt.Errorf("pause pipeline: %w", err)
	}

	p.log.Info("Pipeline paused", slog.String("pipeline_id", pipelineID))
	return nil
}

func (p *PipelineSteps) iResumeThePipeline(pipelineID string) error {
	if p.pipelineManager == nil {
		return fmt.Errorf("pipeline manager not initialized")
	}

	ctx := context.Background()
	err := p.pipelineManager.ResumePipeline(ctx, pipelineID)
	if err != nil {
		return fmt.Errorf("resume pipeline: %w", err)
	}

	p.log.Info("Pipeline resumed", slog.String("pipeline_id", pipelineID))
	return nil
}

func (p *PipelineSteps) iWaitForForThePipelineToTransitionToState(duration, state string) error {
	dur, err := time.ParseDuration(duration)
	if err != nil {
		return fmt.Errorf("parse duration: %w", err)
	}

	time.Sleep(dur)
	return nil
}

func (p *PipelineSteps) thePipelineHealthStatusShouldBe(pipelineID, expectedStatus string) error {
	if p.pipelineManager == nil {
		return fmt.Errorf("pipeline manager not initialized")
	}

	ctx := context.Background()
	health, err := p.pipelineManager.GetPipelineHealth(ctx, pipelineID)
	if err != nil {
		return fmt.Errorf("get pipeline health: %w", err)
	}

	if string(health.OverallStatus) != expectedStatus {
		return fmt.Errorf("expected pipeline status %s, got %s", expectedStatus, string(health.OverallStatus))
	}

	p.log.Info("Pipeline health status verified", slog.String("pipeline_id", pipelineID), slog.String("status", string(health.OverallStatus)))
	return nil
}

func (p *PipelineSteps) RegisterSteps(sc *godog.ScenarioContext) {
	sc.Step(`^a Kafka topic "([^"]*)" with (\d+) partition$`, p.theKafkaTopic)
	sc.Step(`^a running NATS stream "([^"]*)" with subject "([^"]*)"$`, p.aRunningNATSJetStream)
	sc.Step(`^the ClickHouse table "([^"]*)" on database "([^"]*)" already exists with schema$`, p.theClickHouseTableAlreadyExistsWithSchema)

	sc.Step(`^I write these events to Kafka topic "([^"]*)":$`, p.iPublishEventsToKafka)
	sc.Step(`^I produce these messages to Kafka topic "([^"]*)":$`, p.iProduceTheseMessagesToKafkaTopic)

	sc.Step(`^a glassflow pipeline with next configuration:$`, p.aGlassflowPipelineWithNextConfiguration)
	sc.Step(`^I shutdown the glassflow pipeline$`, p.shutdownPipeline)
	sc.Step(`^I shutdown the glassflow pipeline after "([^"]*)"$`, p.shutdownPipelineWithDelay)

	sc.Step(`^I wait for "([^"]*)" for messages to be processed$`, p.iWaitForForMessagesToBeProcessed)
	sc.Step(`^I wait for "([^"]*)" for any processing to complete$`, p.iWaitForForAnyProcessingToComplete)
	sc.Step(`^I pause the pipeline "([^"]*)"$`, p.iPauseThePipeline)
	sc.Step(`^I resume the pipeline "([^"]*)"$`, p.iResumeThePipeline)
	sc.Step(`^I wait for "([^"]*)" for the pipeline to transition to (\w+) state$`, p.iWaitForForThePipelineToTransitionToState)
	sc.Step(`^the pipeline "([^"]*)" health status should be "([^"]*)"$`, p.thePipelineHealthStatusShouldBe)

	sc.Step(`^the ClickHouse table "([^"]*)" should contain (\d+) rows$`, p.theClickHouseTableShouldContainRows)
	sc.Step(`^the ClickHouse table "([^"]*)" should contain:`, p.theClickHouseTableShouldContain)

	sc.After(func(ctx context.Context, _ *godog.Scenario, _ error) (context.Context, error) {
		cleanupErr := p.fastCleanup()
		if cleanupErr != nil {
			return ctx, cleanupErr
		}
		return ctx, nil
	})
}
