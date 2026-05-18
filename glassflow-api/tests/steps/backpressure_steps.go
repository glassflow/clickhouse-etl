package steps

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/cucumber/godog"
	"github.com/nats-io/nats.go/jetstream"
	sdkmetric "go.opentelemetry.io/otel/sdk/metric"
	"go.opentelemetry.io/otel/sdk/metric/metricdata"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/component"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/pkg/observability"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/tests/testutils"
)

// BackpressureTestSuite tests ingestor back-pressure behaviour: Kafka lag grows
// when the output NATS stream is full, and clears when the stream is drained.
type BackpressureTestSuite struct {
	IngestorTestSuite

	metricsReader *sdkmetric.ManualReader

	// drainCancel stops the background drain goroutine started by iDrainTheNatsOutputStream.
	drainCancel context.CancelFunc
	drainWg     sync.WaitGroup
}

func NewBackpressureTestSuite() *BackpressureTestSuite {
	return &BackpressureTestSuite{
		IngestorTestSuite: *NewIngestorTestSuite(),
	}
}

func (b *BackpressureTestSuite) SetupResources() error {
	return b.IngestorTestSuite.SetupResources()
}

func (b *BackpressureTestSuite) CleanupResources() error {
	return b.IngestorTestSuite.CleanupResources()
}

// --- step implementations ---

func (b *BackpressureTestSuite) iSetUpMetricsCollection() error {
	b.metricsReader = observability.InitMetricsForTesting()
	return nil
}

// theNatsOutputStreamHasMaxMessages creates (or updates) the output NATS stream
// with a hard message-count cap and DiscardNew policy so new publishes fail
// with a server-side error when the stream is full — triggering ingestor BP.
// WorkQueuePolicy is used so that ACKed messages are deleted from the stream,
// freeing capacity for the ingestor to resume after back-pressure clears.
// Must be called after theNatsStreamConfig has set b.streamCfg.
func (b *BackpressureTestSuite) theNatsOutputStreamHasMaxMessages(maxMsgs int) error {
	cfg := b.streamCfg
	cfg.MaxMsgs = int64(maxMsgs)
	cfg.Discard = jetstream.DiscardNew
	cfg.Storage = jetstream.MemoryStorage
	cfg.Retention = jetstream.WorkQueuePolicy

	_, err := b.natsClient.JetStream().CreateOrUpdateStream(context.Background(), cfg)
	if err != nil {
		return fmt.Errorf("create bounded output stream (max_msgs=%d): %w", maxMsgs, err)
	}
	return nil
}

// iWriteNGeneratedEventsToKafkaTopic writes count simple JSON events to the
// named Kafka topic without requiring a Gherkin table.
func (b *BackpressureTestSuite) iWriteNGeneratedEventsToKafkaTopic(count int, topicName string) error {
	events := make([]testutils.KafkaEvent, count)
	for i := range count {
		events[i] = testutils.KafkaEvent{
			Key:   fmt.Sprintf("%d", i+1),
			Value: []byte(fmt.Sprintf(`{"id": "%d", "val": "value-%04d"}`, i+1, i+1)),
		}
	}

	if err := b.createKafkaWriter(); err != nil {
		return fmt.Errorf("create kafka writer: %w", err)
	}
	if err := b.kWriter.WriteJSONEvents(topicName, events); err != nil {
		return fmt.Errorf("write %d generated events to kafka topic %q: %w", count, topicName, err)
	}
	return nil
}

// kafkaLagShouldGrowAboveWithin polls the Kafka consumer-group lag until it
// exceeds minLag or the timeout elapses.
func (b *BackpressureTestSuite) kafkaLagShouldGrowAboveWithin(minLag int, timeout string) error {
	dur, err := time.ParseDuration(timeout)
	if err != nil {
		return fmt.Errorf("parse timeout %q: %w", timeout, err)
	}

	deadline := time.NewTimer(dur)
	defer deadline.Stop()
	ticker := time.NewTicker(300 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-deadline.C:
			lag, _ := b.kWriter.GetLag(context.Background(), b.topicName, b.cGroupName)
			return fmt.Errorf("kafka lag %d did not grow above %d within %s (topic=%s cgroup=%s)",
				lag, minLag, timeout, b.topicName, b.cGroupName)
		case <-ticker.C:
			lag, err := b.kWriter.GetLag(context.Background(), b.topicName, b.cGroupName)
			if err != nil {
				continue // consumer group not yet registered
			}
			if lag > int64(minLag) {
				return nil
			}
		}
	}
}

// natsOutputStreamDepthShouldBeAtMost asserts the stream holds no more than
// maxDepth messages (pending + ack-pending).
func (b *BackpressureTestSuite) natsOutputStreamDepthShouldBeAtMost(maxDepth int) error {
	str, err := b.natsClient.JetStream().Stream(context.Background(), b.streamCfg.Name)
	if err != nil {
		return fmt.Errorf("get stream handle for %q: %w", b.streamCfg.Name, err)
	}
	si, err := str.Info(context.Background())
	if err != nil {
		return fmt.Errorf("stream info for %q: %w", b.streamCfg.Name, err)
	}
	if si.State.Msgs > uint64(maxDepth) {
		return fmt.Errorf("NATS stream %q depth %d exceeds max allowed %d",
			b.streamCfg.Name, si.State.Msgs, maxDepth)
	}
	return nil
}

// ingestorBackpressureEventsMetricShouldBeGreaterThanZero polls until the
// ingestor has emitted at least one back-pressure-start event via OTEL metrics,
// or the 15-second timeout elapses. Polling is necessary because Kafka lag can
// exceed the threshold before the ingestor has finished its first publish batch
// and detected the back-pressure error from the NATS server.
func (b *BackpressureTestSuite) ingestorBackpressureEventsMetricShouldBeGreaterThanZero() error {
	const timeout = 15 * time.Second
	const poll = 500 * time.Millisecond
	deadline := time.NewTimer(timeout)
	defer deadline.Stop()
	ticker := time.NewTicker(poll)
	defer ticker.Stop()
	for {
		select {
		case <-deadline.C:
			val, _ := b.collectMetricSum(observability.GfMetricPrefix + "_ingestor_backpressure_events_total")
			return fmt.Errorf("gfm_ingestor_backpressure_events_total still 0 after %s (last value: %d)", timeout, val)
		case <-ticker.C:
			val, err := b.collectMetricSum(observability.GfMetricPrefix + "_ingestor_backpressure_events_total")
			if err != nil {
				return err
			}
			if val > 0 {
				return nil
			}
		}
	}
}

// iDrainTheNatsOutputStream starts a background pull consumer that continuously
// ACKs messages from the output stream. This simulates a sink catching up after
// back-pressure and allows the ingestor to resume publishing.
func (b *BackpressureTestSuite) iDrainTheNatsOutputStream() error {
	js := b.natsClient.JetStream()

	const drainConsumer = "bp-drain-consumer"
	consumer, err := js.CreateOrUpdateConsumer(context.Background(), b.streamCfg.Name, jetstream.ConsumerConfig{
		Name:          drainConsumer,
		Durable:       drainConsumer,
		FilterSubject: b.streamCfg.Subjects[0],
		AckPolicy:     jetstream.AckExplicitPolicy,
		AckWait:       5 * time.Second,
	})
	if err != nil {
		return fmt.Errorf("create drain consumer: %w", err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	b.drainCancel = cancel

	b.drainWg.Add(1)
	go func() {
		defer b.drainWg.Done()
		for ctx.Err() == nil {
			msgs, fetchErr := consumer.Fetch(100, jetstream.FetchMaxWait(300*time.Millisecond))
			if fetchErr != nil {
				continue
			}
			for msg := range msgs.Messages() {
				_ = msg.Ack()
			}
		}
	}()

	return nil
}

// kafkaLagShouldReturnToZeroWithin polls until the Kafka consumer-group lag
// drops to 0 or the timeout elapses.
func (b *BackpressureTestSuite) kafkaLagShouldReturnToZeroWithin(timeout string) error {
	dur, err := time.ParseDuration(timeout)
	if err != nil {
		return fmt.Errorf("parse timeout %q: %w", timeout, err)
	}

	deadline := time.NewTimer(dur)
	defer deadline.Stop()
	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-deadline.C:
			lag, _ := b.kWriter.GetLag(context.Background(), b.topicName, b.cGroupName)
			return fmt.Errorf("kafka lag %d did not return to 0 within %s (topic=%s cgroup=%s)",
				lag, timeout, b.topicName, b.cGroupName)
		case <-ticker.C:
			lag, err := b.kWriter.GetLag(context.Background(), b.topicName, b.cGroupName)
			if err != nil {
				continue
			}
			if lag == 0 {
				return nil
			}
		}
	}
}

// iCanStopTheIngestorWithin stops the ingestor and asserts it completes within
// the given duration. Back-pressure is cleared by context cancellation so the
// retry loop exits immediately.
func (b *BackpressureTestSuite) iCanStopTheIngestorWithin(timeout string) error {
	dur, err := time.ParseDuration(timeout)
	if err != nil {
		return fmt.Errorf("parse timeout %q: %w", timeout, err)
	}

	done := make(chan struct{})
	go func() {
		b.ingestor.Stop(component.WithNoWait(true))
		b.wg.Wait()
		close(done)
	}()

	select {
	case <-done:
		b.ingestor = nil
		return nil
	case <-time.After(dur):
		return fmt.Errorf("ingestor did not stop within %s", timeout)
	}
}

// --- metrics helpers ---

func (b *BackpressureTestSuite) collectMetricSum(metricName string) (int64, error) {
	if b.metricsReader == nil {
		return 0, fmt.Errorf("metrics reader not initialized — call 'I set up metrics collection' first")
	}
	var rm metricdata.ResourceMetrics
	if err := b.metricsReader.Collect(context.Background(), &rm); err != nil {
		return 0, fmt.Errorf("collect metrics: %w", err)
	}
	for _, sm := range rm.ScopeMetrics {
		for _, m := range sm.Metrics {
			if m.Name != metricName {
				continue
			}
			if data, ok := m.Data.(metricdata.Sum[int64]); ok {
				var total int64
				for _, dp := range data.DataPoints {
					total += dp.Value
				}
				return total, nil
			}
		}
	}
	return 0, nil
}

// --- scenario cleanup ---

func (b *BackpressureTestSuite) scenarioCleanup() error {
	if b.drainCancel != nil {
		b.drainCancel()
		b.drainCancel = nil
		b.drainWg.Wait()
	}
	return b.IngestorTestSuite.fastCleanUp()
}

// --- step registration ---

func (b *BackpressureTestSuite) RegisterSteps(sc *godog.ScenarioContext) {
	logElapsedTime(sc)

	// Inherited ingestor steps
	sc.Step(`^the NATS stream config:$`, b.theNatsStreamConfig)
	sc.Step(`^pipeline config with configuration$`, b.aPipelineConfig)
	sc.Step(`^a Kafka topic "([^"]*)" with (\d+) partition`, b.aKafkaTopicWithPartitions)
	sc.Step(`^I run the ingestor component$`, b.iRunningIngestorComponent)

	// Back-pressure–specific steps
	sc.Step(`^I set up metrics collection$`, b.iSetUpMetricsCollection)
	sc.Step(`^the NATS output stream has max messages (\d+)$`, b.theNatsOutputStreamHasMaxMessages)
	sc.Step(`^I write (\d+) generated events to Kafka topic "([^"]*)"$`, b.iWriteNGeneratedEventsToKafkaTopic)
	sc.Step(`^Kafka consumer lag (?:should grow|grows) above (\d+) within "([^"]*)"$`, b.kafkaLagShouldGrowAboveWithin)
	sc.Step(`^the NATS output stream depth should be at most (\d+)$`, b.natsOutputStreamDepthShouldBeAtMost)
	sc.Step(`^the ingestor back-pressure events metric should be greater than 0$`, b.ingestorBackpressureEventsMetricShouldBeGreaterThanZero)
	sc.Step(`^I drain the NATS output stream$`, b.iDrainTheNatsOutputStream)
	sc.Step(`^Kafka consumer lag should return to 0 within "([^"]*)"$`, b.kafkaLagShouldReturnToZeroWithin)
	sc.Step(`^I can stop the ingestor within "([^"]*)"$`, b.iCanStopTheIngestorWithin)

	sc.After(func(ctx context.Context, _ *godog.Scenario, _ error) (context.Context, error) {
		if err := b.scenarioCleanup(); err != nil {
			return ctx, err
		}
		return ctx, nil
	})
}
