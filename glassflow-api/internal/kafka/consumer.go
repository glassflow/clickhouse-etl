package kafka

import (
	"context"
	"crypto/tls"
	"fmt"
	"log/slog"
	"sync"

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

type Consumer interface {
	Fetch(context.Context) (Message, error)
	Commit(context.Context, Message) error
	Close() error
	Pause() error
	Resume(topic string) error
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
		return nil, fmt.Errorf("failed to create group consumer: %w", err)
	}
	return consumer, nil
}

type groupConsumer struct {
	cGroup sarama.ConsumerGroup
	name   string

	fetchCh      chan *sarama.ConsumerMessage
	commitCh     chan *sarama.ConsumerMessage
	consumeErrCh chan error

	cancel context.CancelFunc

	closeCh chan struct{}

	log    *slog.Logger
	paused bool
	mu     sync.RWMutex
	stopWg sync.WaitGroup
}

func newGroupConsumer(connectionParams models.KafkaConnectionParamsConfig, topic models.KafkaTopicsConfig, log *slog.Logger) (Consumer, error) {
	cfg := newConnectionConfig(connectionParams, topic)
	cGroup, err := sarama.NewConsumerGroup(
		connectionParams.Brokers,
		topic.ConsumerGroupName,
		cfg,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create consumer group: %w", err)
	}

	consumer := &groupConsumer{
		cGroup:       cGroup,
		name:         topic.ConsumerGroupName,
		fetchCh:      make(chan *sarama.ConsumerMessage),
		commitCh:     make(chan *sarama.ConsumerMessage),
		consumeErrCh: make(chan error),
		closeCh:      make(chan struct{}),
		log:          log,
	}

	ctx := context.Background()
	ctx, consumer.cancel = context.WithCancel(ctx)

	consumer.stopWg.Add(1)
	go func(kTopic string) {
		defer consumer.stopWg.Done()
		topics := []string{kTopic}
		for {
			select {
			case <-ctx.Done():
				return
			default:
				if err := consumer.cGroup.Consume(ctx, topics, consumer); err != nil {
					consumer.consumeErrCh <- err
				}
			}
		}
	}(topic.Name)

	return consumer, nil
}

func (c *groupConsumer) Fetch(ctx context.Context) (Message, error) {
	select {
	case msg := <-c.fetchCh:
		return Message{
			Topic:     msg.Topic,
			Partition: msg.Partition,
			Offset:    msg.Offset,

			Key:     msg.Key,
			Value:   msg.Value,
			Headers: convertToMessageHeaders(msg.Headers),
		}, nil
	case err := <-c.consumeErrCh:
		return Message{}, fmt.Errorf("failed to fetch message: %w", err)
	case <-ctx.Done():
		return Message{}, ctx.Err()
	}
}

func (c *groupConsumer) Commit(ctx context.Context, msg Message) error {
	m := &sarama.ConsumerMessage{ //nolint: exhaustruct // optional struct definition
		Topic:     msg.Topic,
		Partition: msg.Partition,
		Offset:    msg.Offset,

		Key:   msg.Key,
		Value: msg.Value,
	}

	select {
	case <-ctx.Done():
		return ctx.Err()
	case c.commitCh <- m:
	case err := <-c.consumeErrCh:
		return fmt.Errorf("failed to commit message: %w", err)
	case <-c.closeCh:
		return fmt.Errorf("consumer closed, cannot commit message")
	}

	return nil
}

func (c *groupConsumer) Close() error {
	c.log.Info("Closing Kafka consumer group", slog.String("group", c.name))
	close(c.fetchCh)
	close(c.commitCh)
	close(c.closeCh)
	if c.cancel != nil {
		c.cancel()
	}
	if err := c.cGroup.Close(); err != nil {
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
		case msg := <-claim.Messages():
			if msg == nil {
				// Channel closed, exit gracefully
				return nil
			}
			c.fetchCh <- msg

			msg = <-c.commitCh
			if msg != nil {
				session.MarkMessage(msg, "")
			}

		case <-c.closeCh:
			return nil

		case <-session.Context().Done():
			return nil
		}
	}
}

func convertToMessageHeaders(consumerHeaders []*sarama.RecordHeader) []sarama.RecordHeader {
	msgHeaders := make([]sarama.RecordHeader, 0, len(consumerHeaders))
	for _, element := range consumerHeaders {
		if element != nil {
			msgHeaders = append(msgHeaders, *element)
		}
	}
	return msgHeaders
}

func (c *groupConsumer) Pause() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.log.Info("pausing kafka consumer")
	// Cancel the context to stop the consumer group
	// This will gracefully stop the consumer group and preserve offsets
	if c.cancel != nil {
		c.cancel()
		// Wait for the consumer group to fully stop
		c.stopWg.Wait()
	}
	c.paused = true
	return nil
}

func (c *groupConsumer) Resume(topic string) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.log.Info("resuming kafka consumer", slog.String("topic", topic))

	// Create a new context and restart the consumer group
	ctx := context.Background()
	ctx, c.cancel = context.WithCancel(ctx)

	// Restart the consumer group with the provided topic
	c.stopWg.Add(1)
	go func(kTopic string) {
		defer c.stopWg.Done()
		topics := []string{kTopic}
		for {
			select {
			case <-ctx.Done():
				return
			default:
				if err := c.cGroup.Consume(ctx, topics, c); err != nil {
					c.consumeErrCh <- err
				}
			}
		}
	}(topic)

	c.paused = false
	return nil
}
