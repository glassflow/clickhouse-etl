//go:build cgo
// +build cgo

package kafka

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	cKafka "github.com/confluentinc/confluent-kafka-go/v2/kafka"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

type Message struct {
	Topic     string
	Partition int32
	Offset    int64

	Key     []byte
	Value   []byte
	Headers []cKafka.Header
}

type MessageProcessor interface {
	ProcessMessage(ctx context.Context, msg Message) error
	ProcessBatch(ctx context.Context, batch MessageBatch) error
}

type Consumer interface {
	Start(ctx context.Context, processor MessageProcessor) error
	Close() error
}

type MessageBatch []Message

type BatchedConsumer interface {
	Consumer
	StartBatch(ctx context.Context, processor MessageProcessor, batchSize int, timeout time.Duration) error
}

// BatchConsumer implements BatchedConsumer using confluent-kafka-go
type BatchConsumer struct {
	consumer    *cKafka.Consumer
	topic       string
	groupID     string
	batchSize   int
	timeout     time.Duration
	processor   MessageProcessor
	log         *slog.Logger
	cancel      context.CancelFunc
	isBatchMode bool
}

func NewConsumer(conn models.KafkaConnectionParamsConfig, topic models.KafkaTopicsConfig, log *slog.Logger) (BatchedConsumer, error) {
	config := buildConfluentConfig(conn, topic)

	consumer, err := cKafka.NewConsumer(&config)
	if err != nil {
		return nil, fmt.Errorf("failed to create consumer: %w", err)
	}

	return &BatchConsumer{
		consumer:    consumer,
		topic:       topic.Name,
		groupID:     topic.ConsumerGroupName,
		log:         log,
		batchSize:   0,
		timeout:     0,
		processor:   nil,
		cancel:      nil,
		isBatchMode: false,
	}, nil
}

// NewBatchConsumer creates a new Kafka consumer with batching support
func NewBatchConsumer(conn models.KafkaConnectionParamsConfig, topic models.KafkaTopicsConfig, log *slog.Logger) (BatchedConsumer, error) {
	consumer, err := NewConsumer(conn, topic, log)
	if err != nil {
		return nil, fmt.Errorf("failed to create batch consumer: %w", err)
	}
	return consumer, nil
}

// buildConfluentConfig creates Confluent Kafka configuration from connection params
func buildConfluentConfig(conn models.KafkaConnectionParamsConfig, topic models.KafkaTopicsConfig) cKafka.ConfigMap {
	config := cKafka.ConfigMap{
		"bootstrap.servers": joinBrokers(conn.Brokers),
		"group.id":          topic.ConsumerGroupName,
		"client.id":         internal.ClientID,

		"session.timeout.ms":    internal.KafkaSessionTimeoutMs,
		"heartbeat.interval.ms": internal.KafkaHeartbeatInterval,

		"enable.auto.commit": false,

		"fetch.min.bytes":         internal.KafkaMinFetchBytes,
		"fetch.message.max.bytes": internal.KafkaMaxFetchBytes,

		"queued.max.messages.kbytes": internal.KafkaMaxMessagesInQueueSize,
	}

	// Set initial offset
	if topic.ConsumerGroupInitialOffset == internal.InitialOffsetEarliest {
		config["auto.offset.reset"] = "earliest"
	} else {
		config["auto.offset.reset"] = "latest"
	}

	// Configure security
	configureSecurity(config, conn)

	return config
}

// configureSecurity adds security configuration to the Confluent config
func configureSecurity(config cKafka.ConfigMap, conn models.KafkaConnectionParamsConfig) {
	switch {
	case conn.SASLUsername != "":
		config["security.protocol"] = conn.SASLProtocol
		config["sasl.mechanism"] = mapSASLMechanism(conn.SASLMechanism)
		config["sasl.username"] = conn.SASLUsername
		config["sasl.password"] = conn.SASLPassword

		if conn.SkipAuth {
			config["enable.ssl.certificate.verification"] = false
		}
	case conn.IAMEnable && conn.IAMRegion != "":
		// AWS MSK IAM
		config["security.protocol"] = "SASL_SSL"
		config["sasl.mechanism"] = "OAUTHBEARER"
		// Note: For full IAM support, you'd need to implement OAUTHBEARER callback
	case conn.SASLTLSEnable:
		config["security.protocol"] = "SSL"
	}

	// TLS Configuration
	if conn.TLSCert != "" && conn.TLSKey != "" {
		config["ssl.certificate.pem"] = conn.TLSCert
		config["ssl.key.pem"] = conn.TLSKey
	}
	if conn.TLSRoot != "" {
		config["ssl.ca.pem"] = conn.TLSRoot
	}
}

// mapSASLMechanism maps internal mechanism names to Confluent names
func mapSASLMechanism(mechanism string) string {
	switch mechanism {
	case internal.MechanismSHA256:
		return "SCRAM-SHA-256"
	case internal.MechanismSHA512:
		return "SCRAM-SHA-512"
	default:
		return "PLAIN"
	}
}

// joinBrokers converts broker slice to comma-separated string
func joinBrokers(brokers []string) string {
	if len(brokers) == 0 {
		return "localhost:9092"
	}
	result := brokers[0]
	for i := 1; i < len(brokers); i++ {
		result += "," + brokers[i]
	}
	return result
}

// Start implements the Consumer interface for single message processing
func (c *BatchConsumer) Start(ctx context.Context, processor MessageProcessor) error {
	ctx, c.cancel = context.WithCancel(ctx)
	c.processor = processor
	c.isBatchMode = false

	err := c.consumer.Subscribe(c.topic, nil)
	if err != nil {
		return fmt.Errorf("failed to subscribe to topic %s: %w", c.topic, err)
	}

	c.log.Info("Starting Kafka consumer",
		slog.String("topic", c.topic),
		slog.String("group", c.groupID))

	return c.consumeLoop(ctx)
}

// StartBatch implements the BatchedConsumer interface for batch processing
func (c *BatchConsumer) StartBatch(ctx context.Context, processor MessageProcessor, batchSize int, timeout time.Duration) error {
	ctx, c.cancel = context.WithCancel(ctx)
	c.batchSize = batchSize
	c.timeout = timeout
	c.processor = processor
	c.isBatchMode = true

	err := c.consumer.Subscribe(c.topic, nil)
	if err != nil {
		return fmt.Errorf("failed to subscribe to topic %s: %w", c.topic, err)
	}

	c.log.Info("Starting Kafka batch consumer",
		slog.String("topic", c.topic),
		slog.String("group", c.groupID),
		slog.Int("batchSize", batchSize),
		slog.Duration("timeout", timeout))

	return c.consumeLoop(ctx)
}

// consumeLoop handles the main consumption logic
func (c *BatchConsumer) consumeLoop(ctx context.Context) error {
	if c.isBatchMode {
		return c.consumeBatches(ctx)
	}
	return c.consumeSingle(ctx)
}

// consumeSingle processes messages one by one
func (c *BatchConsumer) consumeSingle(ctx context.Context) error {
	for {
		select {
		case <-ctx.Done():
			return nil
		default:
			msg, err := c.consumer.ReadMessage(internal.KafkaMaxWait)
			if err != nil {
				var kafkaErr cKafka.Error
				if errors.As(err, &kafkaErr) && kafkaErr.Code() == cKafka.ErrTimedOut {
					continue
				}
				c.log.Error("Error reading message", slog.Any("error", err))
				continue
			}

			message := c.convertMessage(msg)
			if err := c.processor.ProcessMessage(ctx, message); err != nil {
				c.log.Error("Message processing failed", slog.Any("error", err))
				return fmt.Errorf("message processing failed: %w", err)
			}

			_, err = c.consumer.CommitMessage(msg)
			if err != nil {
				c.log.Error("Failed to commit offset", slog.Any("error", err))
				return fmt.Errorf("failed to commit offset: %w", err)
			}
		}
	}
}

// consumeBatches processes messages in batches
func (c *BatchConsumer) consumeBatches(ctx context.Context) error {
	c.log.Debug("Consuming messages in batch mode",
		slog.String("topic", c.topic),
		slog.String("group", c.groupID),
		slog.Int("batchSize", c.batchSize),
		slog.Duration("timeout", c.timeout))

	batch := make(MessageBatch, 0, c.batchSize)
	batchTimer := time.NewTimer(c.timeout)
	defer batchTimer.Stop()

	for {
		select {
		case <-ctx.Done():
			return c.processRemainingBatch(ctx, batch)

		case <-batchTimer.C:
			if err := c.processTimerBatch(ctx, &batch, batchTimer); err != nil {
				return err
			}

		default:
			if err := c.handleBatchMessages(ctx, &batch, batchTimer); err != nil {
				return err
			}
		}
	}
}

// processRemainingBatch processes any remaining messages in the batch during shutdown
func (c *BatchConsumer) processRemainingBatch(ctx context.Context, batch MessageBatch) error {
	if len(batch) > 0 {
		return c.processBatch(ctx, batch)
	}
	return nil
}

// processTimerBatch handles batch processing when timer expires
func (c *BatchConsumer) processTimerBatch(ctx context.Context, batch *MessageBatch, timer *time.Timer) error {
	if len(*batch) > 0 {
		if err := c.processBatch(ctx, *batch); err != nil {
			return err
		}
		*batch = (*batch)[:0] // Reset batch
	}
	timer.Reset(c.timeout)
	return nil
}

// batch message handling
func (c *BatchConsumer) handleBatchMessages(ctx context.Context, batch *MessageBatch, timer *time.Timer) error {
	remainingCapacity := c.batchSize - len(*batch)
	if remainingCapacity <= 0 {
		return nil
	}

	// Poll for messages with a reasonable timeout
	for range remainingCapacity {
		select {
		case <-ctx.Done():
			return nil
		default:
		}
		msg, err := c.consumer.ReadMessage(internal.KafkaMaxWait)
		if err != nil {
			var kafkaErr cKafka.Error
			if errors.As(err, &kafkaErr) && kafkaErr.Code() == cKafka.ErrTimedOut {
				break // No more messages available, break the inner loop
			}
			c.log.Error("Error reading message", slog.Any("error", err))
			continue
		}

		message := c.convertMessage(msg)
		*batch = append(*batch, message)

		// If batch is full
		if len(*batch) >= c.batchSize {
			break
		}
	}

	// Process batch if it's full
	if len(*batch) >= c.batchSize {
		if err := c.processBatch(ctx, *batch); err != nil {
			return err
		}
		*batch = (*batch)[:0]
		timer.Reset(c.timeout)
	}

	return nil
}

// processBatch processes a batch of messages
func (c *BatchConsumer) processBatch(ctx context.Context, batch MessageBatch) error {
	if len(batch) == 0 {
		return nil
	}

	if err := c.processor.ProcessBatch(ctx, batch); err != nil {
		c.log.Error("Batch processing failed",
			slog.Any("error", err),
			slog.Int("batchSize", len(batch)))
		return fmt.Errorf("batch processing failed: %w", err)
	}

	// Only commit if processing was successful
	if err := c.commitBatch(); err != nil {
		return fmt.Errorf("batch processing failed on commit offsets: %w", err)
	}

	return nil
}

func (c *BatchConsumer) commitBatch() error {
	if _, err := c.consumer.Commit(); err != nil {
		c.log.Error("Failed to commit offsets", slog.Any("error", err))
		return fmt.Errorf("failed to commit offsets: %w", err)
	}
	return nil
}

// convertMessage converts Kafka message to internal Message format
func (c *BatchConsumer) convertMessage(msg *cKafka.Message) Message {
	return Message{
		Topic:     *msg.TopicPartition.Topic,
		Partition: msg.TopicPartition.Partition,
		Offset:    int64(msg.TopicPartition.Offset),
		Key:       msg.Key,
		Value:     msg.Value,
		Headers:   msg.Headers,
	}
}

// Close implements the Consumer interface
func (c *BatchConsumer) Close() error {
	c.log.Info("Closing Kafka consumer", slog.String("group", c.groupID))

	if c.cancel != nil {
		c.cancel()
	}

	time.Sleep(internal.KafkaMaxWait) // Give some time for graceful shutdown

	if err := c.consumer.Close(); err != nil {
		return fmt.Errorf("failed to close consumer: %w", err)
	}

	return nil
}
