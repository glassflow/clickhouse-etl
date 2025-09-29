package kafka

import (
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"log/slog"

	"github.com/IBM/sarama"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

type Message struct {
	Topic     string
	Partition int32
	Offset    int64

	Key     []byte
	Value   []byte
	Headers []sarama.RecordHeader
}

type MessageProcessor interface {
	ProcessMessage(ctx context.Context, msg Message) error
}

type Consumer interface {
	Start(ctx context.Context, processor MessageProcessor) error
	Close() error
}

func newConnectionConfig(conn models.KafkaConnectionParamsConfig, topic models.KafkaTopicsConfig) *sarama.Config {
	cfg := sarama.NewConfig()
	cfg.Net.DialTimeout = internal.DefaultDialTimeout
	cfg.ClientID = internal.ClientID

	if conn.SASLUsername != "" {
		cfg.Net.SASL.Enable = true
		cfg.Net.SASL.Handshake = true
		cfg.Net.SASL.User = conn.SASLUsername
		cfg.Net.SASL.Password = conn.SASLPassword

		switch conn.SASLMechanism {
		case internal.MechanismSHA256:
			//nolint: exhaustruct // optional config
			cfg.Net.SASL.SCRAMClientGeneratorFunc = func() sarama.SCRAMClient { return &XDGSCRAMClient{HashGeneratorFcn: SHA256} }
			cfg.Net.SASL.Mechanism = sarama.SASLTypeSCRAMSHA256
		case internal.MechanismSHA512:
			//nolint: exhaustruct // optional config
			cfg.Net.SASL.SCRAMClientGeneratorFunc = func() sarama.SCRAMClient { return &XDGSCRAMClient{HashGeneratorFcn: SHA512} }
			cfg.Net.SASL.Mechanism = sarama.SASLTypeSCRAMSHA512
		default:
			cfg.Net.SASL.Mechanism = sarama.SASLTypePlaintext
		}
	} else if conn.IAMEnable && conn.IAMRegion != "" {
		cfg.Net.SASL.Enable = true
		cfg.Net.SASL.Mechanism = sarama.SASLTypeOAuth
		cfg.Net.SASL.TokenProvider = &MSKAccessTokenProvider{Region: conn.IAMRegion}
	}

	if cfg.Net.SASL.Enable && conn.SkipAuth {
		cfg.Net.TLS.Enable = true
		//nolint: exhaustruct, gosec // optional config, local testing
		cfg.Net.TLS.Config = &tls.Config{
			InsecureSkipVerify: conn.SkipAuth,
		}
	} else if tlsC, err := MakeTLSConfigFromStrings(conn.TLSCert, conn.TLSKey, conn.TLSRoot); tlsC != nil && err == nil {
		cfg.Net.TLS.Enable = true
		cfg.Net.TLS.Config = tlsC
	} else if conn.IAMEnable {
		//nolint: exhaustruct // placeholder config
		tlsConfig := tls.Config{
			MinVersion: tls.VersionTLS12,
		}
		cfg.Net.TLS.Enable = true
		cfg.Net.TLS.Config = &tlsConfig
	}
	if conn.SASLTLSEnable {
		cfg.Net.TLS.Enable = conn.SASLTLSEnable
	}

	if topic.ConsumerGroupInitialOffset == internal.InitialOffsetEarliest {
		cfg.Consumer.Offsets.Initial = sarama.OffsetOldest
	} else {
		cfg.Consumer.Offsets.Initial = sarama.OffsetNewest
	}

	return cfg
}

func NewConsumer(conn models.KafkaConnectionParamsConfig, topic models.KafkaTopicsConfig, log *slog.Logger) (Consumer, error) {
	consumer, err := newGroupConsumer(conn, topic, log)
	if err != nil {
		log.Error("failed to create group consumer", "topic", topic, "error", err)
		return nil, fmt.Errorf("failed to create group consumer: %w", err)
	}
	return consumer, nil
}

type groupConsumer struct {
	cGroup    sarama.ConsumerGroup
	name      string
	topicName string
	cancel    context.CancelFunc
	processor MessageProcessor
	log       *slog.Logger
}

func newGroupConsumer(connectionParams models.KafkaConnectionParamsConfig, topic models.KafkaTopicsConfig, log *slog.Logger) (Consumer, error) {
	cfg := newConnectionConfig(connectionParams, topic)
	cGroup, err := sarama.NewConsumerGroup(
		connectionParams.Brokers,
		topic.ConsumerGroupName,
		cfg,
	)
	if err != nil {
		log.Error("failed to create consumer group", "brokers", connectionParams.Brokers, "consumer_group", topic.ConsumerGroupName, "error", err)
		return nil, fmt.Errorf("failed to create consumer group: %w", err)
	}

	consumer := &groupConsumer{ //nolint: exhaustruct // fields will be set later
		cGroup:    cGroup,
		name:      topic.ConsumerGroupName,
		topicName: topic.Name,
		log:       log,
	}

	return consumer, nil
}

func (c *groupConsumer) Start(ctx context.Context, processor MessageProcessor) error {
	ctx, c.cancel = context.WithCancel(ctx)
	c.processor = processor

	topics := []string{c.topicName}

	for {
		if err := c.cGroup.Consume(ctx, topics, c); err != nil {
			if errors.Is(err, sarama.ErrClosedConsumerGroup) {
				return nil
			}
			c.log.ErrorContext(ctx, "failed to consume from kafka", "topics", topics, "error", err)
			return fmt.Errorf("failed to consume from kafka: %w", err)
		}

		if ctx.Err() != nil {
			return ctx.Err()
		}
	}
}

func (c *groupConsumer) Close() error {
	c.log.Info("Closing Kafka consumer group", "group", c.name)
	if c.cancel != nil {
		c.cancel()
	}
	if err := c.cGroup.Close(); err != nil {
		c.log.Error("failed to close consumer group", "group", c.name, "error", err)
		return fmt.Errorf("failed to close consumer group: %w", err)
	}
	return nil
}

func (c *groupConsumer) Setup(sarama.ConsumerGroupSession) error {
	// This method is need for the compartibility with sarama.ConsumerGroupHandler interface.
	return nil
}

func (c *groupConsumer) Cleanup(sarama.ConsumerGroupSession) error {
	// This method is need for the compartibility with sarama.ConsumerGroupHandler interface.
	return nil
}

func (c *groupConsumer) ConsumeClaim(session sarama.ConsumerGroupSession, claim sarama.ConsumerGroupClaim) error {
	for {
		select {
		case message := <-claim.Messages():
			if message == nil {
				// Channel closed, exit gracefully
				return nil
			}

			// Process message directly using the processor
			if err := c.processor.ProcessMessage(session.Context(), Message{
				Topic:     message.Topic,
				Partition: message.Partition,
				Offset:    message.Offset,
				Key:       message.Key,
				Value:     message.Value,
				Headers:   convertSaramaToRecordHeaders(message.Headers),
			}); err != nil {
				c.log.ErrorContext(session.Context(), "Message processing failed", "error", err)
				return fmt.Errorf("message processing failed: %w", err) // Exit consumer loop - this will cause restart
			}

			// Auto-commit on success
			session.MarkMessage(message, "")

		case <-session.Context().Done():
			return nil
		}
	}
}

func convertSaramaToRecordHeaders(headers []*sarama.RecordHeader) []sarama.RecordHeader {
	result := make([]sarama.RecordHeader, 0, len(headers))
	for _, h := range headers {
		if h != nil {
			result = append(result, *h)
		}
	}
	return result
}
