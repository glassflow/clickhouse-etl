package kafka

import (
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/twmb/franz-go/pkg/kgo"
	"github.com/twmb/franz-go/pkg/sasl"
	"github.com/twmb/franz-go/pkg/sasl/plain"
	"github.com/twmb/franz-go/pkg/sasl/scram"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/pkg/observability"
)

type Message struct {
	Topic     string
	Partition int32
	Value     []byte
}

type MessageProcessor interface {
	PushMsgToBatch(ctx context.Context, record *kgo.Record)
	ProcessBatch(ctx context.Context) error
	GetBatchSize() int
}

type Consumer interface {
	Start(ctx context.Context, processor MessageProcessor) error
	Close() error
}

type MessageBatch []Message

type KafkaConsumer struct {
	client    *kgo.Client
	topic     string
	groupID   string
	timeout   time.Duration
	processor MessageProcessor
	meter     *observability.Meter
	log       *slog.Logger
	cancel    context.CancelFunc
}

func NewConsumer(conn models.KafkaConnectionParamsConfig, topic models.KafkaTopicsConfig, log *slog.Logger, meter *observability.Meter) (Consumer, error) {
	client, err := kgo.NewClient(buildClientOptions(conn, topic)...)
	if err != nil {
		return nil, fmt.Errorf("failed to create client: %w", err)
	}

	return &KafkaConsumer{
		client:    client,
		topic:     topic.Name,
		groupID:   topic.ConsumerGroupName,
		log:       log,
		timeout:   internal.DefaultKafkaBatchTimeout,
		meter:     meter,
		processor: nil,
		cancel:    nil,
	}, nil
}

func buildClientOptions(conn models.KafkaConnectionParamsConfig, topic models.KafkaTopicsConfig) []kgo.Opt {
	opts := []kgo.Opt{
		kgo.SeedBrokers(conn.Brokers...),
		kgo.ConsumerGroup(topic.ConsumerGroupName),
		kgo.ConsumeTopics(topic.Name),
		kgo.ClientID(internal.ClientID),

		// Session configuration
		kgo.SessionTimeout(time.Duration(internal.KafkaSessionTimeoutMs) * time.Millisecond),
		kgo.HeartbeatInterval(time.Duration(internal.KafkaHeartbeatInterval) * time.Millisecond),

		// Disable auto commit - we handle commits manually
		kgo.DisableAutoCommit(),

		// Fetch configuration
		kgo.FetchMinBytes(internal.KafkaMinFetchBytes),
		kgo.FetchMaxBytes(internal.KafkaMaxFetchBytes),
		kgo.FetchMaxWait(internal.KafkaMaxWait),
	}

	// Set initial offset
	if topic.ConsumerGroupInitialOffset == internal.InitialOffsetEarliest {
		opts = append(opts, kgo.ConsumeResetOffset(kgo.NewOffset().AtStart()))
	} else {
		opts = append(opts, kgo.ConsumeResetOffset(kgo.NewOffset().AtEnd()))
	}

	// Configure security
	opts = append(opts, confugureAuth(conn)...)

	return opts
}

func confugureAuth(conn models.KafkaConnectionParamsConfig) []kgo.Opt {
	var opts []kgo.Opt
	var auth sasl.Mechanism

	if conn.SASLUsername != "" {
		// SASL Authentication
		switch conn.SASLMechanism {
		case internal.MechanismSHA256:
			auth = scram.Auth{
				User: conn.SASLUsername,
				Pass: conn.SASLPassword,
			}.AsSha256Mechanism()
		case internal.MechanismSHA512:
			auth = scram.Auth{
				User: conn.SASLUsername,
				Pass: conn.SASLPassword,
			}.AsSha512Mechanism()
		default:
			auth = plain.Auth{
				User: conn.SASLUsername,
				Pass: conn.SASLPassword,
			}.AsMechanism()
		}

		opts = append(opts, kgo.SASL(auth))
	} else {
		// No authentication
		return opts
	}

	if conn.SASLTLSEnable {
		var tlsCfg *tls.Config
		if tlsC, err := MakeTLSConfigFromStrings(conn.TLSCert, conn.TLSKey, conn.TLSRoot); tlsC != nil && err == nil {
			tlsCfg = tlsC
		}

		if conn.SkipAuth {
			tlsCfg.InsecureSkipVerify = true
		}

		opts = append(opts, kgo.DialTLSConfig(tlsCfg))
	}

	return opts
}

func (c *KafkaConsumer) Start(ctx context.Context, processor MessageProcessor) error {
	ctx, c.cancel = context.WithCancel(ctx)
	c.processor = processor

	c.log.Info("Starting Kafka consumer",
		slog.String("topic", c.topic),
		slog.String("group", c.groupID))

	return c.consumeLoop(ctx)
}

func (c *KafkaConsumer) consumeLoop(ctx context.Context) error {
	c.log.Debug("Consuming messages in batch mode",
		slog.String("topic", c.topic),
		slog.String("group", c.groupID),
		slog.Int("batchSizeThreshold", internal.DefaultKafkaBatchSize),
		slog.Duration("timeout", c.timeout))

	batchTimer := time.NewTimer(c.timeout)
	defer batchTimer.Stop()

	for {
		select {
		case <-ctx.Done():
			return nil

		case <-batchTimer.C:
			if err := c.processTimerBatch(ctx, batchTimer); err != nil {
				return err
			}

		default:
			if err := c.handleBatchMessages(ctx, batchTimer); err != nil {
				return err
			}
		}
	}
}

func (c *KafkaConsumer) processTimerBatch(ctx context.Context, timer *time.Timer) error {
	if c.processor.GetBatchSize() == 0 {
		timer.Reset(c.timeout)
		return nil
	}

	err := c.processBatch(ctx)
	if err != nil {
		return fmt.Errorf("process batch by timer: %w", err)
	}
	timer.Reset(c.timeout)
	return nil
}

func (c *KafkaConsumer) handleBatchMessages(ctx context.Context, timer *time.Timer) error {
	// Poll for messages
	fetches := c.client.PollFetches(ctx)
	if errs := fetches.Errors(); len(errs) > 0 {
		for _, err := range errs {
			if errors.Is(err.Err, context.Canceled) {
				c.log.Info("Received context cancel, abort fetching...")
				return nil
			}
			c.log.Error("Error fetching messages", slog.Any("error", err))
		}
		return nil
	}

	if fetches.Empty() {
		return nil
	}

	// if records exists - convert and push to the batch
	fetches.EachRecord(func(record *kgo.Record) {
		c.processor.PushMsgToBatch(ctx, record)
	})

	// if batch size reached threshold - process it
	if c.processor.GetBatchSize() >= internal.DefaultKafkaBatchSize {
		err := c.processBatch(ctx)
		if err != nil {
			return fmt.Errorf("process batch: %w", err)
		}
		timer.Reset(c.timeout)
	}

	return nil
}

func (c *KafkaConsumer) processBatch(ctx context.Context) error {
	size := c.processor.GetBatchSize()
	err := c.processor.ProcessBatch(ctx)
	if err != nil {
		c.log.Error("Batch processing failed", slog.Any("error", err), slog.Int("batchSize", size))
		return fmt.Errorf("batch processing failed: %w", err)
	}

	err = c.commitBatch(ctx)
	if err != nil {
		return fmt.Errorf("batch processing failed on commit offsets: %w", err)
	}

	// Record Kafka read metric
	if c.meter != nil {
		c.meter.RecordKafkaRead(ctx, int64(size))
	}

	return nil
}

func (c *KafkaConsumer) commitBatch(ctx context.Context) error {
	if err := c.client.CommitUncommittedOffsets(ctx); err != nil {
		c.log.Error("Failed to commit offsets", slog.Any("error", err))
		return fmt.Errorf("failed to commit offsets: %w", err)
	}
	return nil
}

func (c *KafkaConsumer) Close() error {
	c.log.Info("Closing Kafka consumer", slog.String("group", c.groupID))

	if c.cancel != nil {
		c.cancel()
	}

	// TODO: fix that
	time.Sleep(internal.KafkaMaxWait)

	c.client.Close()

	return nil
}
