package steps

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/cucumber/godog"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/client"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/service"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/tests/testutils"
)

type PipelineSteps struct {
	BaseTestSuite
	kWriter    *testutils.KafkaWriter
	kTopics    []string
	streamName string
	chDB       string
	chTable    string

	pipelineManager *service.PipelineManager
}

func NewPipelineSteps() *PipelineSteps {
	return &PipelineSteps{ //nolint:exhaustruct // only necessary fields
		BaseTestSuite: BaseTestSuite{ //nolint:exhaustruct // only necessary fields
			kafkaContainer: nil,
		},
		kTopics: make([]string, 0),
	}
}

func (p *PipelineSteps) createKafkaWriter() error {
	if p.kWriter != nil {
		return nil
	}

	uri, err := p.getKafkaURI()
	if err != nil {
		return fmt.Errorf("get kafka uri: %w", err)
	}

	writer := testutils.NewKafkaWriter(uri)
	p.kWriter = writer

	return nil
}

func (p *PipelineSteps) theKafkaTopic(topic string, partitions int) error {
	err := p.createKafkaWriter()
	if err != nil {
		return fmt.Errorf("create kafka writer: %w", err)
	}

	err = p.kWriter.CreateTopic(context.Background(), topic, partitions)
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

	if p.kafkaContainer == nil {
		return fmt.Errorf("kafka container not initialized")
	}

	err := p.createKafkaWriter()
	if err != nil {
		return fmt.Errorf("create kafka writer: %w", err)
	}

	err = p.kWriter.DeleteTopic(context.Background(), topicName)
	if err != nil {
		return fmt.Errorf("cleanup topics: %w", err)
	}
	return nil
}

func (p *PipelineSteps) aRunningNATSJetStream(streamName, subjectName string) error {
	err := p.createStream(streamName, subjectName)
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
		err = p.pipelineManager.ShutdownPipeline()
		if err != nil {
			errs = append(errs, err)
		}
		p.pipelineManager = nil
	}

	err = testutils.CombineErrors(errs)
	if err != nil {
		return fmt.Errorf("cleanup resources: %w", err)
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

	return nil
}

func (p *PipelineSteps) preparePipelineConfig(cfg string) (*models.PipelineRequest, error) {
	var pr models.PipelineRequest
	err := json.Unmarshal([]byte(cfg), &pr)
	if err != nil {
		return nil, fmt.Errorf("unmarshal pipeline config: %w", err)
	}

	pr.Source.ConnectionParams.Brokers = []string{p.kafkaContainer.GetURI()}

	pr.Sink.Host = "localhost"
	pr.Sink.Port, err = p.chContainer.GetPort()
	if err != nil {
		return nil, fmt.Errorf("get clickhouse port: %w", err)
	}
	pr.Sink.Username = "default"
	pr.Sink.Password = base64.StdEncoding.EncodeToString([]byte("default"))
	pr.Sink.Database = p.chDB
	pr.Sink.Table = p.chTable

	return &pr, nil
}

func (p *PipelineSteps) setupPipelineManager() error {
	if p.pipelineManager != nil {
		return fmt.Errorf("pipeline manager already initialized")
	}

	natsClient, err := client.NewNATSWrapper(p.natsContainer.GetURI(), time.Hour)
	if err != nil {
		return fmt.Errorf("create nats client: %w", err)
	}

	p.pipelineManager = service.NewPipelineManager(
		p.natsContainer.GetURI(),
		natsClient,
		testutils.NewTestLogger(),
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

	err = p.pipelineManager.SetupPipeline(pipelineConfig)
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
	if p.pipelineManager == nil {
		return fmt.Errorf("pipeline manager not initialized")
	}

	err := p.pipelineManager.ShutdownPipeline()
	if err != nil {
		return fmt.Errorf("shutdown pipeline: %w", err)
	}

	p.pipelineManager = nil

	return nil
}

func (p *PipelineSteps) shutdownPipelineWithDelay(delay string) error {
	dur, err := time.ParseDuration(delay)
	if err != nil {
		return fmt.Errorf("parse duration: %w", err)
	}

	time.Sleep(dur)

	err = p.shutdownPipeline()
	if err != nil {
		return fmt.Errorf("shutdown pipeline: %w", err)
	}

	return nil
}

func (p *PipelineSteps) RegisterSteps(sc *godog.ScenarioContext) {
	sc.Step(`^a Kafka topic "([^"]*)" with (\d+) partition$`, p.theKafkaTopic)
	sc.Step(`^a running NATS stream "([^"]*)" with subject "([^"]*)"$`, p.aRunningNATSJetStream)
	sc.Step(`^the ClickHouse table "([^"]*)" on database "([^"]*)" already exists with schema$`, p.theClickHouseTableAlreadyExistsWithSchema)

	sc.Step(`^I write these events to Kafka topic "([^"]*)":$`, p.iPublishEventsToKafka)

	sc.Step(`^a glassflow pipeline with next configuration:$`, p.aGlassflowPipelineWithNextConfiguration)
	sc.Step(`^I shutdown the glassflow pipeline$`, p.shutdownPipeline)
	sc.Step(`^I shutdown the glassflow pipeline after "([^"]*)"$`, p.shutdownPipelineWithDelay)

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
