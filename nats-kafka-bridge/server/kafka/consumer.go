/*
 * Copyright 2020 The NATS Authors
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

package kafka

import (
	"context"
	"crypto/tls"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/IBM/sarama"
	"github.com/riferrei/srclient"
	"github.com/santhosh-tekuri/jsonschema/v5"

	"github.com/glassflow/nats-kafka-bridge/server/conf"
)

// Message represents a Kafka message.
type Message struct {
	Topic     string
	Partition int32
	Offset    int64

	Key     []byte
	Value   []byte
	Headers []sarama.RecordHeader
}

// Consumer represents a Kafka Consumer.
type Consumer interface {
	Fetch(context.Context) (Message, error)
	Commit(context.Context, Message) error
	GroupMode() bool
	Close() error
}

type saramaConsumer struct {
	groupMode bool
	//nolint: unused // will be used
	topic string

	saslOn        bool
	tlsOn         bool
	tlsSkipVerify bool

	c  sarama.Consumer
	pc sarama.PartitionConsumer

	cg           sarama.ConsumerGroup
	fetchCh      chan *sarama.ConsumerMessage
	commitCh     chan *sarama.ConsumerMessage
	consumeErrCh chan error

	cancel context.CancelFunc

	schemaRegistryOn     bool
	schemaRegistryClient srclient.ISchemaRegistryClient
	schemaType           srclient.SchemaType
	pbDeserializer       pbDeserializer
}

// NewConsumer returns a new Kafka Consumer.
//
//nolint:cyclop,gocognit // need to check all possible client configurations
func NewConsumer(cc conf.ConnectorConfig, dialTimeout time.Duration) (Consumer, error) {
	sc := sarama.NewConfig()
	sc.Net.DialTimeout = dialTimeout
	sc.ClientID = "glassflow-consumer"

	if cc.SASL.User != "" {
		sc.Net.SASL.Enable = true
		sc.Net.SASL.Handshake = true
		sc.Net.SASL.User = cc.SASL.User
		sc.Net.SASL.Password = cc.SASL.Password

		switch cc.SASL.Mechanism {
		case conf.MechanismSHA256.String():
			//nolint: exhaustruct // optional config
			sc.Net.SASL.SCRAMClientGeneratorFunc = func() sarama.SCRAMClient { return &XDGSCRAMClient{HashGeneratorFcn: SHA256} }
			sc.Net.SASL.Mechanism = sarama.SASLTypeSCRAMSHA256
		case conf.MechanismSHA512.String():
			//nolint: exhaustruct // optional config
			sc.Net.SASL.SCRAMClientGeneratorFunc = func() sarama.SCRAMClient { return &XDGSCRAMClient{HashGeneratorFcn: SHA512} }
			sc.Net.SASL.Mechanism = sarama.SASLTypeSCRAMSHA512
		default:
			sc.Net.SASL.Mechanism = sarama.SASLTypePlaintext
		}
	} else if cc.IAM.Enable && cc.IAM.Region != "" {
		sc.Net.SASL.Enable = true
		sc.Net.SASL.Mechanism = sarama.SASLTypeOAuth
		sc.Net.SASL.TokenProvider = &MSKAccessTokenProvider{Region: cc.IAM.Region}
	}

	if sc.Net.SASL.Enable && cc.SASL.InsecureSkipVerify {
		sc.Net.TLS.Enable = true
		//nolint: exhaustruct, gosec // optional config, local testing
		sc.Net.TLS.Config = &tls.Config{
			InsecureSkipVerify: cc.SASL.InsecureSkipVerify,
		}
	} else if tlsC, err := cc.TLS.MakeTLSConfigFromStrings(); tlsC != nil && err == nil {
		sc.Net.TLS.Enable = true
		sc.Net.TLS.Config = tlsC
	} else if cc.IAM.Enable {
		//nolint: exhaustruct // placeholder config
		tlsConfig := tls.Config{
			MinVersion: tls.VersionTLS12,
		}
		sc.Net.TLS.Enable = true
		sc.Net.TLS.Config = &tlsConfig
	}
	if cc.SASL.TLS {
		sc.Net.TLS.Enable = cc.SASL.TLS
	}

	if cc.MinBytes > 0 {
		sc.Consumer.Fetch.Min = cc.MinBytes
	}
	if cc.MaxBytes > 0 {
		sc.Consumer.Fetch.Max = cc.MaxBytes
	}

	//nolint: exhaustruct // optional config
	cons := &saramaConsumer{
		groupMode:     cc.GroupID != "",
		topic:         cc.Topic,
		saslOn:        sc.Net.SASL.Enable,
		tlsOn:         sc.Net.TLS.Enable,
		tlsSkipVerify: cc.SASL.InsecureSkipVerify,
	}

	// If schema registry url and subject name both are set, enable schema registry integration
	if cc.SchemaRegistryURL != "" && cc.SubjectName != "" {
		cons.schemaRegistryClient = srclient.CreateSchemaRegistryClient(cc.SchemaRegistryURL)

		switch strings.ToUpper(cc.SchemaType) {
		case srclient.Json.String():
			cons.schemaType = srclient.Json
		case srclient.Protobuf.String():
			cons.schemaType = srclient.Protobuf
			cons.pbDeserializer = newDeserializer()
		default:
			cons.schemaType = srclient.Avro
		}

		cons.schemaRegistryOn = true
	}

	if cons.groupMode {
		switch cc.InitialOffset {
		case conf.Latest:
			sc.Consumer.Offsets.Initial = sarama.OffsetNewest
		case conf.Earliest:
			sc.Consumer.Offsets.Initial = sarama.OffsetOldest
		default:
			return nil, fmt.Errorf("unsupported initial offset for consumer group: %s", cc.InitialOffset)
		}

		cg, err := sarama.NewConsumerGroup(cc.Brokers, cc.GroupID, sc)
		if err != nil {
			return nil, fmt.Errorf("new kafka consumer group: %w", err)
		}
		cons.cg = cg
		cons.fetchCh = make(chan *sarama.ConsumerMessage)
		cons.commitCh = make(chan *sarama.ConsumerMessage)
		cons.consumeErrCh = make(chan error)

		ctx := context.Background()
		ctx, cons.cancel = context.WithCancel(ctx)

		go func(topic string) {
			topics := []string{topic}
			for {
				if err := cons.cg.Consume(ctx, topics, cons); err != nil {
					cons.consumeErrCh <- err
				}
			}
		}(cc.Topic)
	} else {
		c, err := sarama.NewConsumer(cc.Brokers, sc)
		if err != nil {
			return nil, fmt.Errorf("new kafka consumer: %w", err)
		}
		cons.c = c

		pc, err := cons.c.ConsumePartition(cc.Topic, cc.Partition, sarama.OffsetOldest)
		if err != nil {
			return nil, fmt.Errorf("kafka consume partition: %w", err)
		}
		cons.pc = pc
	}

	return cons, nil
}

// NetInfo returns information about whether SASL and TLS are enabled.
func (c *saramaConsumer) NetInfo() string {
	saslInfo := "SASL disabled"
	if c.saslOn {
		saslInfo = "SASL enabled"
	}

	tlsInfo := "TLS disabled"
	if c.tlsOn {
		tlsInfo = "TLS enabled"
	}
	if c.tlsSkipVerify {
		tlsInfo += " (insecure skip verify)"
	}

	return fmt.Sprintf("%s, %s", saslInfo, tlsInfo)
}

// Fetch reads an incoming message. In group mode, the message is outstanding
// until committed.
func (c *saramaConsumer) Fetch(ctx context.Context) (Message, error) {
	if c.groupMode {
		select {
		case <-ctx.Done():
			return Message{}, ctx.Err()
		case cmsg := <-c.fetchCh:
			var err error
			deserializedValue := cmsg.Value
			if c.schemaRegistryOn {
				deserializedValue, err = c.deserializePayload(cmsg.Value)
			}

			if err == nil {
				return Message{
					Topic:     cmsg.Topic,
					Partition: cmsg.Partition,
					Offset:    cmsg.Offset,

					Key:     cmsg.Key,
					Value:   deserializedValue,
					Headers: c.convertToMessageHeaders(cmsg.Headers),
				}, nil
			}
			return Message{}, err
		case loopErr := <-c.consumeErrCh:
			return Message{}, loopErr
		}
	}

	select {
	case <-ctx.Done():
		return Message{}, ctx.Err()
	case cmsg := <-c.pc.Messages():
		var (
			deserializedValue = cmsg.Value
			err               error
		)
		if c.schemaRegistryOn {
			deserializedValue, err = c.deserializePayload(cmsg.Value)
		}

		if err == nil {
			return Message{
				Topic:     cmsg.Topic,
				Partition: cmsg.Partition,
				Offset:    cmsg.Offset,

				Key:     cmsg.Key,
				Value:   deserializedValue,
				Headers: c.convertToMessageHeaders(cmsg.Headers),
			}, nil
		}
		return Message{}, err
	}
}

// Commit commits a message. This is only available in group mode.
func (c *saramaConsumer) Commit(ctx context.Context, m Message) error {
	if !c.groupMode {
		return fmt.Errorf("commit is only available in group mode")
	}

	//nolint: exhaustruct // optional config
	cmsg := &sarama.ConsumerMessage{
		Topic:     m.Topic,
		Partition: m.Partition,
		Offset:    m.Offset,

		Key:   m.Key,
		Value: m.Value,
	}

	select {
	case <-ctx.Done():
		return ctx.Err()
	case c.commitCh <- cmsg:
	case loopErr := <-c.consumeErrCh:
		return loopErr
	}
	return nil
}

// GroupMode returns whether the consumer is in group mode or not.
func (c *saramaConsumer) GroupMode() bool {
	return c.groupMode
}

// Close closes the underlying Kafka consumer connection.
func (c *saramaConsumer) Close() error {
	if c.groupMode {
		close(c.fetchCh)
		close(c.commitCh)
		c.cancel()
		//nolint: wrapcheck // pass internal error
		return c.cg.Close()
	}

	if err := c.pc.Close(); err != nil {
		c.c.Close()
		//nolint: wrapcheck // pass internal error
		return err
	}
	//nolint: wrapcheck // pass internal error
	return c.c.Close()
}

// Setup is a no-op. It only exists to satisfy sarama.ConsumerGroupHandler.
func (c *saramaConsumer) Setup(sarama.ConsumerGroupSession) error {
	return nil
}

// Cleanup is a no-op. It only exists to satisfy sarama.ConsumerGroupHandler.
func (c *saramaConsumer) Cleanup(sarama.ConsumerGroupSession) error {
	return nil
}

// ConsumeClaim processes incoming consumer group messages. This satisfies
// sarama.ConsumerGroupHandler.
func (c *saramaConsumer) ConsumeClaim(sess sarama.ConsumerGroupSession, claim sarama.ConsumerGroupClaim) error {
	for {
		select {
		case cmsg := <-claim.Messages():
			c.fetchCh <- cmsg

			cmsg = <-c.commitCh
			sess.MarkMessage(cmsg, "")

		// Should return when `session.Context()` is done.
		// If not, will raise `ErrRebalanceInProgress` or `read tcp <ip>:<port>: i/o timeout` when kafka rebalance. see:
		// https://github.com/IBM/sarama/issues/1192
		case <-sess.Context().Done():
			return nil
		}
	}
}

// Retrieve the schema of the message and deserialize it.
func (c *saramaConsumer) deserializePayload(payload []byte) ([]byte, error) {
	// first byte of the payload is 0
	if payload[0] != byte(0) {
		return nil, fmt.Errorf("failed to deserialize payload: magic byte is not 0")
	}

	// next 4 bytes contain the schema id
	schemaID := binary.BigEndian.Uint32(payload[1:5])
	schema, err := c.schemaRegistryClient.GetSchema(int(schemaID))
	if err != nil {
		return nil, fmt.Errorf("get schema: %w", err)
	}

	var value []byte
	switch c.schemaType {
	case srclient.Avro:
		value, err = c.deserializeAvro(schema, payload[5:])
	case srclient.Json:
		value, err = c.validateJSONSchema(schema, payload[5:])
	case srclient.Protobuf:
		value, err = c.pbDeserializer.Deserialize(schema, payload[5:])
	}

	if err != nil {
		return nil, fmt.Errorf("deserialize schema: %w", err)
	}

	return value, nil
}

func (c *saramaConsumer) deserializeAvro(schema *srclient.Schema, cleanPayload []byte) ([]byte, error) {
	codec := schema.Codec()
	native, _, err := codec.NativeFromBinary(cleanPayload)
	if err != nil {
		return nil, fmt.Errorf("unable to deserailize avro: %w", err)
	}
	value, err := codec.TextualFromNative(nil, native)
	if err != nil {
		return nil, fmt.Errorf("failed to convert to json: %w", err)
	}

	return value, nil
}

func (c *saramaConsumer) validateJSONSchema(schema *srclient.Schema, cleanPayload []byte) ([]byte, error) {
	jsc, err := jsonschema.CompileString("schema.json", schema.Schema())
	if err != nil {
		return nil, fmt.Errorf("unable to parse json schema: %w", err)
	}

	var parsedMessage interface{}
	err = json.Unmarshal(cleanPayload, &parsedMessage)
	if err != nil {
		return nil, fmt.Errorf("unable to parse json message: %w", err)
	}

	err = jsc.Validate(parsedMessage)
	if err != nil {
		return nil, fmt.Errorf("json message validation failed: %w", err)
	}

	return cleanPayload, nil
}

func (c *saramaConsumer) convertToMessageHeaders(consumerHeaders []*sarama.RecordHeader) []sarama.RecordHeader {
	msgHeaders := make([]sarama.RecordHeader, len(consumerHeaders))
	for i, element := range consumerHeaders {
		msgHeaders[i] = *element
	}
	return msgHeaders
}
