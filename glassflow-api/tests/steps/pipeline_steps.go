package steps

import (
	"context"
	"encoding/base64"
	"fmt"

	"github.com/cucumber/godog"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/client"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/tests/testutils"
)

type PipelineSteps struct {
	BaseTestSuite
	kWriter    *testutils.KafkaWriter
	topicName  string
	streamName string
	tableName  string

	chClient *client.ClickHouseClient
}

func NewPipelineSteps() *PipelineSteps {
	return &PipelineSteps{ //nolint:exhaustruct // only necessary fields
		BaseTestSuite: BaseTestSuite{ //nolint:exhaustruct // only necessary fields
			kafkaContainer: nil,
		},
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
	p.topicName = topic

	return nil
}

func (p *PipelineSteps) cleanTopic() error {
	if p.topicName == "" {
		return nil
	}

	if p.kafkaContainer == nil {
		return fmt.Errorf("kafka container not initialized")
	}

	err := p.createKafkaWriter()
	if err != nil {
		return fmt.Errorf("create kafka writer: %w", err)
	}

	err = p.kWriter.DeleteTopic(context.Background(), p.topicName)
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

	err := p.deleteStream(p.streamName)
	if err != nil {
		return fmt.Errorf("delete nats stream: %w", err)
	}

	return nil
}

func (p *PipelineSteps) aClickHouseClientWithConfig(dbName, tableName string) error {
	chPort, err := p.chContainer.GetPort()
	if err != nil {
		return fmt.Errorf("get clickhouse port: %w", err)
	}
	p.chClient, err = client.NewClickHouseClient(context.Background(), client.ClickHouseClientConfig{ //nolint:exhaustruct // optional config
		Port:      chPort,
		Username:  "default",
		Password:  base64.StdEncoding.EncodeToString([]byte("default")),
		Database:  dbName,
		TableName: tableName,
	})
	if err != nil {
		return fmt.Errorf("create clickhouse client: %w", err)
	}

	p.tableName = dbName + "." + tableName

	return nil
}

func (p *PipelineSteps) cleanClickHouseTable() error {
	if p.tableName == "" {
		return nil
	}
	conn, err := p.chContainer.GetConnection()
	if err != nil {
		return fmt.Errorf("get clickhouse connection: %w", err)
	}
	defer conn.Close()

	tableName := "default.events_test"

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

	err := p.cleanTopic()
	if err != nil {
		errs = append(errs, err)
	}

	err = p.cleanNatsStream()
	if err != nil {
		errs = append(errs, err)
	}

	err = p.cleanClickHouseTable()
	if err != nil {
		errs = append(errs, err)
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

func (p *PipelineSteps) RegisterSteps(sc *godog.ScenarioContext) {
	sc.Step(`^a Kafka topic "([^"]*)" with (\d+) partition$`, p.theKafkaTopic)
	sc.Step(`^a running NATS stream "([^"]*)" with subject "([^"]*)"$`, p.aRunningNATSJetStream)
	sc.Step(`^a ClickHouse client with db "([^"]*)" and table "([^"]*)"$`, p.aClickHouseClientWithConfig)
	sc.Step(`^I write these events to Kafka topic "([^"]*)":$`, p.iPublishEventsToKafka)
	sc.After(func(ctx context.Context, _ *godog.Scenario, _ error) (context.Context, error) {
		cleanupErr := p.fastCleanup()
		if cleanupErr != nil {
			return ctx, cleanupErr
		}
		return ctx, nil
	})
}
