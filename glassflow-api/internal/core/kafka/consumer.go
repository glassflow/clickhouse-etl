package kafka

import (
	"context"
	"crypto/tls"
	"fmt"
	"time"

	"github.com/IBM/sarama"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

const (
	ConsumerGroupName  = "glassflow-consumer-group"
	ClientID           = "glassflow-consumer"
	DefaultDialTimeout = 5000 * time.Millisecond

	MechanismSHA256 = "SCRAM-SHA-256"
	MechanismSHA512 = "SCRAM-SHA-512"
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
}

func newConnectionConfig(conn models.KafkaConnectionParamsConfig, topic models.KafkaTopicsConfig) *sarama.Config {
	cfg := sarama.NewConfig()
	cfg.Net.DialTimeout = DefaultDialTimeout
	cfg.ClientID = ClientID

	if conn.SASLUsername != "" {
		cfg.Net.SASL.Enable = true
		cfg.Net.SASL.Handshake = true
		cfg.Net.SASL.User = conn.SASLUsername
		cfg.Net.SASL.Password = conn.SASLPassword

		switch conn.SASLMechanism {
		case MechanismSHA256:
			//nolint: exhaustruct // optional config
			cfg.Net.SASL.SCRAMClientGeneratorFunc = func() sarama.SCRAMClient { return &XDGSCRAMClient{HashGeneratorFcn: SHA256} }
			cfg.Net.SASL.Mechanism = sarama.SASLTypeSCRAMSHA256
		case MechanismSHA512:
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

	if topic.ConsumerGroupInitialOffset == models.InitialOffsetEarliest.String() {
		cfg.Consumer.Offsets.Initial = sarama.OffsetNewest
	} else {
		cfg.Consumer.Offsets.Initial = sarama.OffsetOldest
	}

	return cfg
}

func NewConsumer(conn models.KafkaConnectionParamsConfig, topic models.KafkaTopicsConfig) (Consumer, error) {
	consumer, err := newGroupConsumer(conn, topic)
	if err != nil {
		return nil, fmt.Errorf("failed to create group consumer: %w", err)
	}
	return consumer, nil
}

type groupConsumer struct {
	cGroup sarama.ConsumerGroup

	fetchCh      chan *sarama.ConsumerMessage
	commitCh     chan *sarama.ConsumerMessage
	consumeErrCh chan error

	closeCh chan struct{}
}

func newGroupConsumer(connectionParams models.KafkaConnectionParamsConfig, topic models.KafkaTopicsConfig) (Consumer, error) {
	cfg := newConnectionConfig(connectionParams, topic)
	cGroup, err := sarama.NewConsumerGroup(
		connectionParams.Brokers,
		ConsumerGroupName,
		cfg,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create consumer group: %w", err)
	}

	consumer := &groupConsumer{
		cGroup:       cGroup,
		fetchCh:      make(chan *sarama.ConsumerMessage),
		commitCh:     make(chan *sarama.ConsumerMessage),
		consumeErrCh: make(chan error),
		closeCh:      make(chan struct{}),
	}

	go func(kTopic string) {
		topics := []string{kTopic}
		for {
			if err := consumer.cGroup.Consume(context.Background(), topics, consumer); err != nil {
				consumer.consumeErrCh <- err
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
	close(c.fetchCh)
	close(c.commitCh)
	close(c.closeCh)
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
			c.fetchCh <- msg

			msg = <-c.commitCh
			session.MarkMessage(msg, "")

		case <-c.closeCh:
			return nil

		case <-session.Context().Done():
			return nil
		}
	}
}

func convertToMessageHeaders(consumerHeaders []*sarama.RecordHeader) []sarama.RecordHeader {
	msgHeaders := make([]sarama.RecordHeader, len(consumerHeaders))
	for i, element := range consumerHeaders {
		msgHeaders[i] = *element
	}
	return msgHeaders
}
