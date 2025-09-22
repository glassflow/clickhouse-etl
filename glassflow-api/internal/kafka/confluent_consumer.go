package kafka

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/IBM/sarama"
	"github.com/confluentinc/confluent-kafka-go/kafka"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

// MessageBatch represents a batch of messages
type MessageBatch []Message

// BatchedConsumer interface extends Consumer with batch functionality
type BatchedConsumer interface {
	Consumer
	StartBatch(ctx context.Context, processor MessageProcessor, batchSize int, timeout time.Duration) error
}

// ConfluentBatchConsumer implements BatchedConsumer using confluent-kafka-go
type ConfluentBatchConsumer struct {
	consumer    *kafka.Consumer
	topic       string
	groupID     string
	batchSize   int
	timeout     time.Duration
	processor   MessageProcessor
	log         *slog.Logger
	cancel      context.CancelFunc
	isBatchMode bool
}

// NewConfluentConsumer creates a new Confluent Kafka consumer
func NewConfluentConsumer(conn models.KafkaConnectionParamsConfig, topic models.KafkaTopicsConfig, log *slog.Logger) (BatchedConsumer, error) {
	config := buildConfluentConfig(conn, topic)

	consumer, err := kafka.NewConsumer(&config)
	if err != nil {
		return nil, fmt.Errorf("failed to create confluent consumer: %w", err)
	}

	return &ConfluentBatchConsumer{
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

// buildConfluentConfig creates Confluent Kafka configuration from connection params
func buildConfluentConfig(conn models.KafkaConnectionParamsConfig, topic models.KafkaTopicsConfig) kafka.ConfigMap {
	config := kafka.ConfigMap{
		"bootstrap.servers":          joinBrokers(conn.Brokers),
		"group.id":                   topic.ConsumerGroupName,
		"client.id":                  internal.ClientID,
		"session.timeout.ms":         30000,
		"heartbeat.interval.ms":      3000,
		"enable.auto.commit":         false,
		"auto.commit.interval.ms":    1000,
		"fetch.min.bytes":            102400,  // 100KB min fetch
		"fetch.message.max.bytes":    1048576, // 1MB max message size
		"queued.min.messages":        100000,
		"queued.max.messages.kbytes": 1048576, // 1GB
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
func configureSecurity(config kafka.ConfigMap, conn models.KafkaConnectionParamsConfig) {
	switch {
	case conn.SASLUsername != "":
		config["security.protocol"] = "SASL_SSL"
		config["sasl.mechanism"] = mapSASLMechanism(conn.SASLMechanism)
		config["sasl.username"] = conn.SASLUsername
		config["sasl.password"] = conn.SASLPassword

		if conn.SkipAuth {
			config["ssl.certificate.verification"] = "none"
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
func (c *ConfluentBatchConsumer) Start(ctx context.Context, processor MessageProcessor) error {
	ctx, c.cancel = context.WithCancel(ctx)
	c.processor = processor
	c.isBatchMode = false

	err := c.consumer.Subscribe(c.topic, nil)
	if err != nil {
		return fmt.Errorf("failed to subscribe to topic %s: %w", c.topic, err)
	}

	c.log.Info("Starting Confluent Kafka consumer",
		slog.String("topic", c.topic),
		slog.String("group", c.groupID))

	return c.consumeLoop(ctx)
}

// StartBatch implements the BatchedConsumer interface for batch processing
func (c *ConfluentBatchConsumer) StartBatch(ctx context.Context, processor MessageProcessor, batchSize int, timeout time.Duration) error {
	ctx, c.cancel = context.WithCancel(ctx)
	c.batchSize = batchSize
	c.timeout = timeout
	c.processor = processor
	c.isBatchMode = true

	err := c.consumer.Subscribe(c.topic, nil)
	if err != nil {
		return fmt.Errorf("failed to subscribe to topic %s: %w", c.topic, err)
	}

	c.log.Info("Starting Confluent Kafka batch consumer",
		slog.String("topic", c.topic),
		slog.String("group", c.groupID),
		slog.Int("batchSize", batchSize),
		slog.Duration("timeout", timeout))

	return c.consumeLoop(ctx)
}

// consumeLoop handles the main consumption logic
func (c *ConfluentBatchConsumer) consumeLoop(ctx context.Context) error {
	if c.isBatchMode {
		return c.consumeBatches(ctx)
	}
	return c.consumeSingle(ctx)
}

// consumeSingle processes messages one by one
func (c *ConfluentBatchConsumer) consumeSingle(ctx context.Context) error {
	for {
		select {
		case <-ctx.Done():
			return nil
		default:
			msg, err := c.consumer.ReadMessage(1000) // 1 second timeout
			if err != nil {
				var kafkaErr kafka.Error
				if errors.As(err, &kafkaErr) && kafkaErr.Code() == kafka.ErrTimedOut {
					continue // Timeout is expected, continue polling
				}
				c.log.Error("Error reading message", slog.Any("error", err))
				continue
			}

			message := c.convertMessage(msg)
			if err := c.processor.ProcessMessage(ctx, message); err != nil {
				c.log.Error("Message processing failed", slog.Any("error", err))
				return fmt.Errorf("message processing failed: %w", err)
			}

			// Commit manually if needed (auto-commit is enabled by default)
		}
	}
}

// consumeBatches processes messages in batches
func (c *ConfluentBatchConsumer) consumeBatches(ctx context.Context) error {
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
			if err := c.handleBatchMessage(ctx, &batch, batchTimer); err != nil {
				return err
			}
		}
	}
}

// processRemainingBatch processes any remaining messages in the batch during shutdown
func (c *ConfluentBatchConsumer) processRemainingBatch(ctx context.Context, batch MessageBatch) error {
	if len(batch) > 0 {
		return c.processBatch(ctx, batch)
	}
	return nil
}

// processTimerBatch handles batch processing when timer expires
func (c *ConfluentBatchConsumer) processTimerBatch(ctx context.Context, batch *MessageBatch, timer *time.Timer) error {
	if len(*batch) > 0 {
		if err := c.processBatch(ctx, *batch); err != nil {
			return err
		}
		*batch = (*batch)[:0] // Reset batch
	}
	timer.Reset(c.timeout)
	return nil
}

// handleBatchMessage handles reading and processing a single message in batch mode
func (c *ConfluentBatchConsumer) handleBatchMessage(ctx context.Context, batch *MessageBatch, timer *time.Timer) error {
	msg, err := c.consumer.ReadMessage(c.timeout)
	if err != nil {
		var kafkaErr kafka.Error
		if errors.As(err, &kafkaErr) && kafkaErr.Code() == kafka.ErrTimedOut {
			return nil // Continue to check timer and context
		}
		c.log.Error("Error reading message", slog.Any("error", err))
		return nil
	}

	message := c.convertMessage(msg)
	*batch = append(*batch, message)

	// Process batch if it's full
	if len(*batch) >= c.batchSize {
		if err := c.processBatch(ctx, *batch); err != nil {
			return err
		}
		_, err := c.consumer.Commit()
		if err != nil {
			c.log.Error("Failed to commit offsets", slog.Any("error", err))
			return fmt.Errorf("failed to commit offsets: %w", err)
		}

		*batch = (*batch)[:0] // Reset batch
		timer.Reset(c.timeout)
	}
	return nil
}

// processBatch processes a batch of messages
func (c *ConfluentBatchConsumer) processBatch(ctx context.Context, batch MessageBatch) error {
	if len(batch) == 0 {
		return nil
	}

	if err := c.processor.ProcessBatch(ctx, batch); err != nil {
		c.log.Error("Batch processing failed",
			slog.Any("error", err),
			slog.Int("batchSize", len(batch)))
		return fmt.Errorf("batch processing failed: %w", err)
	}

	_, err := c.consumer.Commit()
	if err != nil {
		c.log.Error("Failed to commit offsets", slog.Any("error", err))
		return fmt.Errorf("failed to commit offsets: %w", err)
	}

	return nil
}

// convertMessage converts Confluent Kafka message to internal Message format
func (c *ConfluentBatchConsumer) convertMessage(msg *kafka.Message) Message {
	headers := make([]sarama.RecordHeader, 0, len(msg.Headers))
	for _, header := range msg.Headers {
		headers = append(headers, sarama.RecordHeader{
			Key:   []byte(header.Key),
			Value: header.Value,
		})
	}

	return Message{
		Topic:     *msg.TopicPartition.Topic,
		Partition: msg.TopicPartition.Partition,
		Offset:    int64(msg.TopicPartition.Offset),
		Key:       msg.Key,
		Value:     msg.Value,
		Headers:   headers,
	}
}

// Close implements the Consumer interface
func (c *ConfluentBatchConsumer) Close() error {
	c.log.Info("Closing Confluent Kafka consumer", slog.String("group", c.groupID))

	if c.cancel != nil {
		c.cancel()
	}

	if err := c.consumer.Close(); err != nil {
		return fmt.Errorf("failed to close consumer: %w", err)
	}

	return nil
}
