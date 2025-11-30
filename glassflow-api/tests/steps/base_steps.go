package steps

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/cucumber/godog"
	"github.com/google/uuid"
	"github.com/nats-io/nats.go/jetstream"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/client"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/component"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/tests/testutils"
)

// BaseTestSuite provides common functionality for test suites
type BaseTestSuite struct {
	natsContainer     *testutils.NATSContainer
	chContainer       *testutils.ClickHouseContainer
	kafkaContainer    *testutils.KafkaContainer
	postgresContainer *testutils.PostgresContainer

	kWriter *testutils.KafkaWriter

	natsClient *client.NATSClient

	httpRouter http.Handler

	wg    sync.WaitGroup
	errCh chan error
}

func (b *BaseTestSuite) setupNATS() error {
	if b.natsContainer == nil {
		natsContainer, err := testutils.StartNATSContainer(context.Background())
		if err != nil {
			return fmt.Errorf("start nats container: %w", err)
		}

		b.natsContainer = natsContainer
	}
	if b.natsClient == nil {
		client, err := client.NewNATSClient(context.Background(), b.natsContainer.GetURI(), client.WithMaxAge(time.Hour))
		if err != nil {
			return fmt.Errorf("create nats wrapper: %w", err)
		}

		b.natsClient = client
	}
	return nil
}

func (b *BaseTestSuite) cleanupNATS() error {
	var errs []error
	if b.natsClient != nil {
		if err := b.natsClient.Close(); err != nil {
			errs = append(errs, fmt.Errorf("close nats client: %w", err))
		}
		b.natsClient = nil
	}

	if b.natsContainer != nil {
		if err := b.natsContainer.Stop(context.Background()); err != nil {
			errs = append(errs, fmt.Errorf("stop nats container: %w", err))
		}
		b.natsContainer = nil
	}

	err := testutils.CombineErrors(errs)
	if err != nil {
		return fmt.Errorf("cleanup nats: %w", err)
	}

	return nil
}

func (b *BaseTestSuite) setupCH() error {
	chContainer, err := testutils.StartClickHouseContainer(context.Background())
	if err != nil {
		return fmt.Errorf("start clickhouse container: %w", err)
	}
	b.chContainer = chContainer

	return nil
}

func (b *BaseTestSuite) cleanupCH() error {
	if b.chContainer != nil {
		err := b.chContainer.Stop(context.Background())
		if err != nil {
			return fmt.Errorf("stop clickhouse container: %w", err)
		}
		b.chContainer = nil
	}

	return nil
}

func (b *BaseTestSuite) setupKafka() error {
	kContainer, err := testutils.StartKafkaContainer(context.Background())
	if err != nil {
		return fmt.Errorf("start kafka container: %w", err)
	}
	b.kafkaContainer = kContainer
	return nil
}

func (b *BaseTestSuite) getKafkaURI() (string, error) {
	if b.kafkaContainer == nil {
		return "", fmt.Errorf("kafka container not initialized")
	}

	return b.kafkaContainer.GetURI(), nil
}

func (b *BaseTestSuite) createKafkaWriter() error {
	if b.kWriter != nil {
		return nil
	}

	uri, err := b.getKafkaURI()
	if err != nil {
		return fmt.Errorf("get kafka uri: %w", err)
	}

	writer := testutils.NewKafkaWriter(uri)
	b.kWriter = writer

	return nil
}

func (b *BaseTestSuite) createKafkaTopic(topic string, partitions int) error {
	if b.kafkaContainer == nil {
		return fmt.Errorf("kafka container is not initialized")
	}

	err := b.createKafkaWriter()
	if err != nil {
		return fmt.Errorf("create kafka writer: %w", err)
	}

	err = b.kWriter.CreateTopic(context.Background(), topic, partitions)
	if err != nil {
		return fmt.Errorf("create kafka topic: %w", err)
	}

	return nil
}

func (b *BaseTestSuite) deleteKafkaTopic(topic string) error {
	if b.kafkaContainer == nil {
		return fmt.Errorf("kafka container is not initialized")
	}

	err := b.createKafkaWriter()
	if err != nil {
		return fmt.Errorf("create kafka writer: %w", err)
	}

	err = b.kWriter.DeleteTopic(context.Background(), topic)
	if err != nil {
		return fmt.Errorf("delete kafka topic: %w", err)
	}

	return nil
}

func (b *BaseTestSuite) cleanupKafka() error {
	if b.kafkaContainer != nil {
		err := b.kafkaContainer.Stop(context.Background())
		if err != nil {
			return fmt.Errorf("stop kafka container: %w", err)
		}
		b.kafkaContainer = nil
	}

	return nil
}

func (b *BaseTestSuite) getMappingConfig(cfg *godog.DocString, target any) error {
	err := json.Unmarshal([]byte(cfg.Content), target)
	if err != nil {
		return fmt.Errorf("unmarshal schema config: %w", err)
	}

	return nil
}

func (b *BaseTestSuite) createStream(
	streamConfig jetstream.StreamConfig,
	timeWindow time.Duration,
) error {
	if timeWindow > 0 {
		streamConfig.Duplicates = timeWindow
	}

	js := b.natsClient.JetStream()

	// Create stream if not exists
	_, err := js.Stream(context.Background(), streamConfig.Name)
	if err != nil {
		_, err = js.CreateOrUpdateStream(context.Background(), streamConfig)
		if err != nil {
			return fmt.Errorf("create stream: %w", err)
		}
	}
	return nil
}

func (b *BaseTestSuite) deleteStream(streamName string) error {
	err := b.natsClient.JetStream().DeleteStream(context.Background(), streamName)
	if err != nil {
		return fmt.Errorf("delete stream: %w", err)
	}

	return nil
}

func (b *BaseTestSuite) deleteAllStreams() error {
	streams := b.natsClient.JetStream().ListStreams(context.Background())

	for stream := range streams.Info() {
		err := b.deleteStream(stream.Config.Name)
		if err != nil {
			return fmt.Errorf("delete stream: %w", err)
		}
	}

	return nil
}

func (b *BaseTestSuite) stopComponent(stopFn func(...component.StopOption), graceful bool, delayDuration ...time.Duration) {
	b.wg.Add(1)
	go func() {
		defer b.wg.Done()

		if len(delayDuration) > 0 && delayDuration[0] > 0 {
			time.Sleep(delayDuration[0])
		}

		if graceful {
			stopFn()
		} else {
			stopFn(component.WithNoWait(true))
		}
	}()

	b.wg.Wait()
}

func (b *BaseTestSuite) checkComponentErrors() error {
	select {
	case err, ok := <-b.errCh:
		if ok {
			close(b.errCh)
			return fmt.Errorf("error from component: %w", err)
		}
	default:
		// No error
	}

	b.errCh = nil

	return nil
}

func (b *BaseTestSuite) clickhouseShouldContainNumberOfRows(table string, expectedCount int) error {
	if b.chContainer == nil {
		return fmt.Errorf("clickhouse container not initialized")
	}

	conn, err := b.chContainer.GetConnection()
	if err != nil {
		return fmt.Errorf("get clickhouse connection: %w", err)
	}

	defer conn.Close()

	query := "SELECT count() FROM " + table
	row := conn.QueryRow(context.Background(), query)

	var actualCount uint64
	err = row.Scan(&actualCount)
	if err != nil {
		return fmt.Errorf("scan row count: %w", err)
	}

	if expectedCount < 0 {
		return fmt.Errorf("count cannot be negative: %d", expectedCount)
	}
	if actualCount != uint64(expectedCount) {
		return fmt.Errorf("unexpected row count: expected %d, got %d", expectedCount, actualCount)
	}

	return nil
}

func (b *BaseTestSuite) clickhouseShouldContainData(table string, expectedData *godog.Table) error {
	if b.chContainer == nil {
		return fmt.Errorf("clickhouse container not initialized")
	}

	conn, err := b.chContainer.GetConnection()
	if err != nil {
		return fmt.Errorf("get clickhouse connection: %w", err)
	}

	defer conn.Close()

	var rowCountPosition int

	columns := make([]string, 0, len(expectedData.Rows[0].Cells))
	for ind, cell := range expectedData.Rows[0].Cells {
		if cell.Value != "COUNT" {
			columns = append(columns, cell.Value)
		} else {
			rowCountPosition = ind
		}
	}

	for _, row := range expectedData.Rows[1:] {
		var expectedCount, actualCount uint64
		conds := make([]string, 0, len(row.Cells))
		for i, cell := range row.Cells {
			if i == rowCountPosition {
				expectedCount, err = strconv.ParseUint(cell.Value, 10, 64)
				if err != nil {
					return fmt.Errorf("parse expected count: %w", err)
				}
				continue
			}
			escapedValue := strings.ReplaceAll(cell.Value, "'", "''")
			conds = append(conds, fmt.Sprintf("%s='%s'", columns[i], escapedValue))
		}

		whereClause := strings.Join(conds, " AND ")
		query := fmt.Sprintf("SELECT COUNT(*) FROM %s WHERE %s", table, whereClause)
		row := conn.QueryRow(context.Background(), query)
		err = row.Scan(&actualCount)
		if err != nil {
			return fmt.Errorf("query clickhouse: %w", err)
		}

		if actualCount != expectedCount {
			return fmt.Errorf("expected %d row, got %d for such WHERE clause %s", expectedCount, actualCount, whereClause)
		}
	}

	return nil
}

func (b *BaseTestSuite) publishEventsToKafka(topicName string, table *godog.Table) error {
	if len(table.Rows) < 2 {
		return fmt.Errorf("invalid table format, expected at least 2 rows")
	}

	events := make([]testutils.KafkaEvent, 0, len(table.Rows)-1)

	headers := make([]string, len(table.Rows[0].Cells))
	for i, cell := range table.Rows[0].Cells {
		headers[i] = cell.Value
	}

	// Skip the header row
	for i := 1; i < len(table.Rows); i++ {
		row := table.Rows[i]
		if len(row.Cells) < 2 {
			return fmt.Errorf("invalid event row format, expected at least key and value columns")
		}

		event := testutils.KafkaEvent{}

		for i, cell := range row.Cells {
			if i < len(headers) {
				switch headers[i] {
				case "partition":
					event.Partition = cell.Value
				case "key":
					event.Key = cell.Value
				case "value":
					event.Value = []byte(cell.Value)
				default:
					return fmt.Errorf("unknown field %s", headers[i])
				}
			}
		}

		events = append(events, event)
	}

	err := b.createKafkaWriter()
	if err != nil {
		return fmt.Errorf("create kafka writer: %w", err)
	}

	err = b.kWriter.WriteJSONEvents(topicName, events)
	if err != nil {
		return fmt.Errorf("write events to kafka: %w", err)
	}

	return nil
}

func (b *BaseTestSuite) createNatsConsumer(streamName, subject, consumerName string) (jetstream.Consumer, error) {
	js := b.natsClient.JetStream()
	consumer, err := js.CreateOrUpdateConsumer(
		context.Background(),
		streamName,
		jetstream.ConsumerConfig{
			Name:          consumerName,
			Durable:       consumerName,
			FilterSubject: subject,
		},
	)
	if err != nil {
		return nil, fmt.Errorf("create or update nats consumer: %w", err)
	}

	return consumer, nil
}

func (b *BaseTestSuite) natsStreamSubjectHasNEvents(natsStream, natsSubject string, expectedCount int) error {
	consumerName := fmt.Sprintf("test-consumer-%s", uuid.New().String())
	consumer, err := b.createNatsConsumer(natsStream, natsSubject, consumerName)
	if err != nil {
		return fmt.Errorf("create nats consumer: %w", err)
	}

	consumerInfo, err := consumer.Info(context.Background())
	if err != nil {
		return fmt.Errorf("get consumer info: %w", err)
	}

	if consumerInfo.NumPending != uint64(expectedCount) {
		return fmt.Errorf(
			"expected %d events, got %d from stream %s, subject %s",
			expectedCount,
			consumerInfo.NumPending,
			natsStream,
			natsSubject,
		)
	}

	return nil
}

// httpResponseKey is a context key for storing HTTP response recorders
type httpResponseKey struct{}

// iSendHTTPRequest sends an HTTP request to the httpRouter and stores the response in context
func (b *BaseTestSuite) iSendHTTPRequest(ctx context.Context, method, path string, body *godog.DocString) (context.Context, error) {
	if b.httpRouter == nil {
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
	b.httpRouter.ServeHTTP(w, req)

	return context.WithValue(ctx, httpResponseKey{}, w), nil
}

// theResponseStatusShouldBe checks the HTTP response status code
func (b *BaseTestSuite) theResponseStatusShouldBe(ctx context.Context, expectedStatus int) error {
	w, ok := ctx.Value(httpResponseKey{}).(*httptest.ResponseRecorder)
	if !ok || w == nil {
		return fmt.Errorf("no HTTP response found in context")
	}

	if w.Code != expectedStatus {
		return fmt.Errorf("expected status %d, got %d. Response body: %s", expectedStatus, w.Code, w.Body.String())
	}

	return nil
}

func logElapsedTime(sc *godog.ScenarioContext) {
	type stepTimingKey struct{}

	sc.StepContext().Before(func(ctx context.Context, st *godog.Step) (context.Context, error) {
		ctx = context.WithValue(ctx, stepTimingKey{}, time.Now())
		return ctx, nil
	})

	sc.StepContext().After(func(ctx context.Context, st *godog.Step, status godog.StepResultStatus, err error) (context.Context, error) {
		if start, ok := ctx.Value(stepTimingKey{}).(time.Time); ok {
			duration := time.Since(start)
			fmt.Printf("Step '%s' elapsed %v (status: %s)\n", st.Text, duration, status)
		}
		return ctx, nil
	})
}
