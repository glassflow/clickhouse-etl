package steps

import (
	"context"
	"encoding/json"
	"fmt"
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
	natsContainer *testutils.NATSContainer
	chContainer   *testutils.ClickHouseContainer
	natsClient    *client.NATSClient

	wg    sync.WaitGroup
	errCh chan error
}

// SetupNATS initializes a NATS container and client
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

// CleanupNATS stops the NATS container and closes the client
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

func (b *BaseTestSuite) getMappingConfig(cfg *godog.DocString, target any) error {
	err := json.Unmarshal([]byte(cfg.Content), target)
	if err != nil {
		return fmt.Errorf("unmarshal schema config: %w", err)
	}

	return nil
}

// CreateStream creates a NATS stream with the given name and subject
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

// DeleteStream deletes a NATS stream
func (b *BaseTestSuite) deleteStream(streamName string) error {
	err := b.natsClient.JetStream().DeleteStream(context.Background(), streamName)
	if err != nil {
		return fmt.Errorf("delete stream: %w", err)
	}

	return nil
}

// StopOperator stops an operator with the given function
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

// CheckOperatorErrors checks for errors from the operator
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
