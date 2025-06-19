package steps

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/cucumber/godog"
	"github.com/nats-io/nats.go/jetstream"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/client"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/operator"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/tests/testutils"
)

// BaseTestSuite provides common functionality for test suites
type BaseTestSuite struct {
	natsContainer  *testutils.NATSContainer
	chContainer    *testutils.ClickHouseContainer
	kafkaContainer *testutils.KafkaContainer

	natsClient *client.NATSClient

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
		client, err := client.NewNATSWrapper(b.natsContainer.GetURI(), time.Hour)
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

func (b *BaseTestSuite) createStream(streamName, subjectName string) error {
	js := b.natsClient.JetStream()

	// Create stream if not exists
	_, err := js.Stream(context.Background(), streamName)
	if err != nil {
		_, err = js.CreateOrUpdateStream(context.Background(), jetstream.StreamConfig{ //nolint:exhaustruct //only necessary fields
			Name:     streamName,
			Subjects: []string{subjectName},
		})
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

func (b *BaseTestSuite) stopOperator(stopFn func(...operator.StopOption), graceful bool, delayDuration ...time.Duration) {
	b.wg.Add(1)
	go func() {
		defer b.wg.Done()

		if len(delayDuration) > 0 && delayDuration[0] > 0 {
			time.Sleep(delayDuration[0])
		}

		if graceful {
			stopFn()
		} else {
			stopFn(operator.WithNoWait(true))
		}
	}()

	b.wg.Wait()
}

func (b *BaseTestSuite) checkOperatorErrors() error {
	select {
	case err, ok := <-b.errCh:
		if ok {
			close(b.errCh)
			return fmt.Errorf("error from operator: %w", err)
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
