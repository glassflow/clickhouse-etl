package sink_ingestor

import (
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"sync"
	"time"

	"github.com/IBM/sarama"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/client"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/kafka"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/schema"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/pkg/observability"
)

// Config combines Kafka, ClickHouse, and batch configuration
type Config struct {
	KafkaConnection models.KafkaConnectionParamsConfig
	KafkaTopic      models.KafkaTopicsConfig
	ClickHouse      models.ClickHouseConnectionParamsConfig
	Batch           models.BatchConfig
}

// KafkaClickHouseSinkIngestor reads from Kafka and writes directly to ClickHouse
type KafkaClickHouseSinkIngestor struct {
	config        Config
	consumerGroup sarama.ConsumerGroup
	clickhouse    *client.ClickHouseClient
	schemaMapper  schema.Mapper
	log           *slog.Logger
	meter         *observability.Meter
	cancel        context.CancelFunc
	shutdownOnce  sync.Once
}

// NewKafkaClickHouseSinkIngestor creates a new direct Kafka to ClickHouse sink
func NewKafkaClickHouseSinkIngestor(
	config Config,
	schemaMapper schema.Mapper,
	log *slog.Logger,
	meter *observability.Meter,
) (*KafkaClickHouseSinkIngestor, error) {
	// Validate batch config
	if config.Batch.MaxBatchSize <= 0 {
		return nil, fmt.Errorf("invalid max batch size, should be > 0: %d", config.Batch.MaxBatchSize)
	}

	// Create ClickHouse client
	clickhouseClient, err := client.NewClickHouseClient(context.Background(), config.ClickHouse)
	if err != nil {
		return nil, fmt.Errorf("failed to create clickhouse client: %w", err)
	}

	// Create Kafka consumer group
	saramaConfig := createSaramaConfig(config.KafkaConnection, config.KafkaTopic)
	consumerGroup, err := sarama.NewConsumerGroup(
		config.KafkaConnection.Brokers,
		config.KafkaTopic.ConsumerGroupName,
		saramaConfig,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create kafka consumer group: %w", err)
	}

	return &KafkaClickHouseSinkIngestor{
		config:        config,
		consumerGroup: consumerGroup,
		clickhouse:    clickhouseClient,
		schemaMapper:  schemaMapper,
		log:           log,
		meter:         meter,
	}, nil
}

// createSaramaConfig creates Sarama configuration from Kafka connection params
func createSaramaConfig(conn models.KafkaConnectionParamsConfig, topic models.KafkaTopicsConfig) *sarama.Config {
	cfg := sarama.NewConfig()
	cfg.Net.DialTimeout = internal.DefaultDialTimeout
	cfg.ClientID = internal.ClientID
	cfg.Consumer.Return.Errors = true

	// Set initial offset
	if topic.ConsumerGroupInitialOffset == internal.InitialOffsetEarliest {
		cfg.Consumer.Offsets.Initial = sarama.OffsetOldest
	} else {
		cfg.Consumer.Offsets.Initial = sarama.OffsetNewest
	}

	// SASL Authentication
	if conn.SASLUsername != "" {
		cfg.Net.SASL.Enable = true
		cfg.Net.SASL.Handshake = true
		cfg.Net.SASL.User = conn.SASLUsername
		cfg.Net.SASL.Password = conn.SASLPassword

		switch conn.SASLMechanism {
		case internal.MechanismSHA256:
			cfg.Net.SASL.SCRAMClientGeneratorFunc = func() sarama.SCRAMClient {
				return &kafka.XDGSCRAMClient{HashGeneratorFcn: kafka.SHA256}
			}
			cfg.Net.SASL.Mechanism = sarama.SASLTypeSCRAMSHA256
		case internal.MechanismSHA512:
			cfg.Net.SASL.SCRAMClientGeneratorFunc = func() sarama.SCRAMClient {
				return &kafka.XDGSCRAMClient{HashGeneratorFcn: kafka.SHA512}
			}
			cfg.Net.SASL.Mechanism = sarama.SASLTypeSCRAMSHA512
		default:
			cfg.Net.SASL.Mechanism = sarama.SASLTypePlaintext
		}
	} else if conn.IAMEnable && conn.IAMRegion != "" {
		cfg.Net.SASL.Enable = true
		cfg.Net.SASL.Mechanism = sarama.SASLTypeOAuth
		cfg.Net.SASL.TokenProvider = &kafka.MSKAccessTokenProvider{Region: conn.IAMRegion}
	}

	// TLS Configuration
	if cfg.Net.SASL.Enable && conn.SkipAuth {
		cfg.Net.TLS.Enable = true
		cfg.Net.TLS.Config = &tls.Config{
			InsecureSkipVerify: conn.SkipAuth,
			MinVersion:         tls.VersionTLS12,
		}
	} else if tlsC, err := kafka.MakeTLSConfigFromStrings(conn.TLSCert, conn.TLSKey, conn.TLSRoot); tlsC != nil && err == nil {
		cfg.Net.TLS.Enable = true
		cfg.Net.TLS.Config = tlsC
	} else if conn.IAMEnable {
		tlsConfig := tls.Config{
			MinVersion: tls.VersionTLS12,
		}
		cfg.Net.TLS.Enable = true
		cfg.Net.TLS.Config = &tlsConfig
	}
	if conn.SASLTLSEnable {
		cfg.Net.TLS.Enable = conn.SASLTLSEnable
	}

	return cfg
}

// Start begins consuming from Kafka and writing to ClickHouse
func (k *KafkaClickHouseSinkIngestor) Start(ctx context.Context) error {
	ctx, k.cancel = context.WithCancel(ctx)
	defer k.cancel()
	defer k.closeConnections()

	k.log.InfoContext(ctx, "KafkaClickHouseSinkIngestor started",
		"topic", k.config.KafkaTopic.Name,
		"max_batch_size", k.config.Batch.MaxBatchSize,
	)

	// Start Kafka consumer
	handler := &consumerGroupHandler{
		sinkIngestor: k,
	}

	for {
		select {
		case <-ctx.Done():
			k.log.Info("KafkaClickHouseSinkIngestor shutting down")
			return nil
		default:
			if err := k.consumerGroup.Consume(ctx, []string{k.config.KafkaTopic.Name}, handler); err != nil {
				if errors.Is(err, sarama.ErrClosedConsumerGroup) {
					return nil
				}
				k.log.ErrorContext(ctx, "failed to consume from kafka", "error", err)
				return fmt.Errorf("failed to consume from kafka: %w", err)
			}

			if ctx.Err() != nil {
				return nil
			}
		}
	}
}

// processBatch processes a batch of Kafka messages and writes to ClickHouse
func (k *KafkaClickHouseSinkIngestor) processBatch(ctx context.Context, messages []*sarama.ConsumerMessage, session sarama.ConsumerGroupSession) error {
	if len(messages) == 0 {
		return nil
	}

	totalStart := time.Now()
	k.log.InfoContext(ctx, "Processing batch START",
		"message_count", len(messages),
		"max_batch_size", k.config.Batch.MaxBatchSize)

	// Create ClickHouse batch using native driver
	query := fmt.Sprintf(
		"INSERT INTO %s.%s (%s)",
		k.clickhouse.GetDatabase(),
		k.clickhouse.GetTableName(),
		strings.Join(k.schemaMapper.GetOrderedColumns(), ", "),
	)

	prepareBatchStart := time.Now()
	chBatch, err := k.clickhouse.PrepareBatch(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to prepare clickhouse batch: %w", err)
	}
	k.log.DebugContext(ctx, "PrepareBatch completed", "duration_ms", time.Since(prepareBatchStart).Milliseconds())

	// Add messages to batch - fail on any error
	validationStart := time.Now()
	successCount := 0
	for i, msg := range messages {
		// Validate schema
		if err := k.schemaMapper.ValidateSchema(k.config.KafkaTopic.Name, msg.Value); err != nil {
			k.log.ErrorContext(ctx, "Schema validation failed",
				"error", err,
				"offset", msg.Offset,
				"partition", msg.Partition,
				"topic", msg.Topic,
				"message_index", i,
				"message_data", string(msg.Value))
			return fmt.Errorf("schema validation failed for offset %d: %w", msg.Offset, err)
		}

		// Prepare values for ClickHouse
		values, err := k.schemaMapper.PrepareValues(msg.Value)
		if err != nil {
			k.log.ErrorContext(ctx, "Failed to prepare values",
				"error", err,
				"offset", msg.Offset,
				"partition", msg.Partition,
				"topic", msg.Topic,
				"message_index", i,
				"message_data", string(msg.Value))
			return fmt.Errorf("failed to prepare values for offset %d: %w", msg.Offset, err)
		}

		// Append to batch using native ClickHouse driver
		if err := chBatch.Append(values...); err != nil {
			k.log.ErrorContext(ctx, "Failed to append to batch",
				"error", err,
				"offset", msg.Offset,
				"partition", msg.Partition,
				"topic", msg.Topic,
				"message_index", i,
				"values", values)
			return fmt.Errorf("failed to append to batch for offset %d: %w", msg.Offset, err)
		}
		successCount++
	}
	validationDuration := time.Since(validationStart)
	k.log.InfoContext(ctx, "Validation and append completed",
		"duration_ms", validationDuration.Milliseconds(),
		"messages_processed", successCount)

	// Send batch to ClickHouse
	sendStart := time.Now()
	if err := chBatch.Send(); err != nil {
		return fmt.Errorf("failed to send batch to clickhouse: %w", err)
	}
	sendDuration := time.Since(sendStart)

	totalDuration := time.Since(totalStart)
	throughput := float64(successCount) / totalDuration.Seconds()

	k.log.InfoContext(ctx, "Batch sent to ClickHouse successfully",
		"message_count", successCount,
		"send_duration_ms", sendDuration.Milliseconds(),
		"total_duration_ms", totalDuration.Milliseconds(),
		"validation_duration_ms", validationDuration.Milliseconds(),
		"throughput_msgs_per_sec", int(throughput),
	)

	// Record metrics
	if k.meter != nil {
		k.meter.RecordClickHouseWrite(ctx, int64(successCount))
		if totalDuration.Seconds() > 0 {
			rate := float64(successCount) / totalDuration.Seconds()
			k.meter.RecordSinkRate(ctx, rate)
		}
	}

	// Mark all messages as processed
	if session != nil && len(messages) > 0 {
		lastMsg := messages[len(messages)-1]
		session.MarkMessage(lastMsg, "")
	}

	return nil
}

// closeConnections closes Kafka and ClickHouse connections
func (k *KafkaClickHouseSinkIngestor) closeConnections() {
	if k.consumerGroup != nil {
		if err := k.consumerGroup.Close(); err != nil {
			k.log.Error("Failed to close Kafka consumer group", "error", err)
		}
	}

	if k.clickhouse != nil {
		if err := k.clickhouse.Close(); err != nil {
			k.log.Error("Failed to close ClickHouse connection", "error", err)
		}
	}

	k.log.Info("KafkaClickHouseSinkIngestor connections closed")
}

// Stop gracefully stops the sink ingestor
func (k *KafkaClickHouseSinkIngestor) Stop() {
	k.shutdownOnce.Do(func() {
		if k.cancel != nil {
			k.cancel()
		}
		k.log.Info("Stop signal sent to KafkaClickHouseSinkIngestor")
	})
}

// consumerGroupHandler implements sarama.ConsumerGroupHandler
type consumerGroupHandler struct {
	sinkIngestor *KafkaClickHouseSinkIngestor
}

func (h *consumerGroupHandler) Setup(sarama.ConsumerGroupSession) error {
	return nil
}

func (h *consumerGroupHandler) Cleanup(sarama.ConsumerGroupSession) error {
	return nil
}

func (h *consumerGroupHandler) ConsumeClaim(session sarama.ConsumerGroupSession, claim sarama.ConsumerGroupClaim) error {
	batchSize := h.sinkIngestor.config.Batch.MaxBatchSize
	messageBatch := make([]*sarama.ConsumerMessage, 0, batchSize)

	for {
		select {
		case message := <-claim.Messages():
			if message == nil {
				// Channel closed, flush remaining messages
				if len(messageBatch) > 0 {
					if err := h.sinkIngestor.processBatch(session.Context(), messageBatch, session); err != nil {
						h.sinkIngestor.log.ErrorContext(session.Context(), "Failed to process batch", "error", err)
						return fmt.Errorf("failed to process batch: %w", err)
					}
				}
				return nil
			}

			// Record Kafka read metric
			if h.sinkIngestor.meter != nil {
				h.sinkIngestor.meter.RecordKafkaRead(session.Context(), 1)
			}

			// Add message to batch
			messageBatch = append(messageBatch, message)

			// Process batch when it reaches max size
			if len(messageBatch) >= batchSize {
				if err := h.sinkIngestor.processBatch(session.Context(), messageBatch, session); err != nil {
					h.sinkIngestor.log.ErrorContext(session.Context(), "Failed to process batch", "error", err)
					return fmt.Errorf("failed to process batch: %w", err)
				}
				// Clear batch
				messageBatch = messageBatch[:0]
			}

		case <-session.Context().Done():
			// Flush remaining messages on context cancellation
			if len(messageBatch) > 0 {
				if err := h.sinkIngestor.processBatch(session.Context(), messageBatch, session); err != nil {
					h.sinkIngestor.log.ErrorContext(session.Context(), "Failed to process batch on shutdown", "error", err)
				}
			}
			return nil
		}
	}
}
