package models

import (
	"fmt"
	"time"

	"github.com/nats-io/nats.go"
	"github.com/nats-io/nats.go/jetstream"
	"github.com/twmb/franz-go/pkg/kgo"
)

type MessageType string

const (
	MessageTypeFranzKafka   MessageType = "franz_kafka"
	MessageTypeJetstreamMsg MessageType = "jetstream_msg"
	MessageTypeNatsMsg      MessageType = "nats_msg"
)

// Message represents a unified message abstraction that supports both NATS and Kafka sources.
// It separates transformation state from the original message to enable processing while
// preserving acknowledgment capability:
//
//   - Mutable fields (payload, headers): Store transformed data as messages pass through
//     processor chains (e.g., filtering, transformation) with copy on write
//
//   - Original references (JetstreamMsgOriginal, FranzKafkaOriginal): Keep the source-specific message
//     intact for Ack/Nak operations. These should never be modified during processing.
//
// separate nats.Msg and jetstream.Msg is needed because there's no way to convert
// nats msg into jetstream msg, but we need nats msg in order to publish message to dlq
type Message struct {
	Type MessageType

	payload []byte
	headers map[string][]string

	JetstreamMsgOriginal jetstream.Msg
	NatsMsgOriginal      *nats.Msg
	FranzKafkaOriginal   *kgo.Record
}

// FetchOpts contains options for fetching message batches
type FetchOpts struct {
	BatchSize int
	Timeout   time.Duration
}

// FetchOption is a function that configures FetchOpts
type FetchOption func(*FetchOpts)

// WithBatchSize sets the batch size for fetching messages
func WithBatchSize(size int) FetchOption {
	return func(opts *FetchOpts) {
		opts.BatchSize = size
	}
}

// WithTimeout sets the timeout for fetching messages
func WithTimeout(timeout time.Duration) FetchOption {
	return func(opts *FetchOpts) {
		opts.Timeout = timeout
	}
}

// ApplyFetchOptions creates FetchOpts with defaults and applies the given options
func ApplyFetchOptions(options ...FetchOption) FetchOpts {
	opts := FetchOpts{}
	for _, option := range options {
		option(&opts)
	}

	return opts
}

func NewNatsMessage(payload []byte, headers map[string][]string) Message {
	return Message{
		Type:    MessageTypeNatsMsg,
		payload: payload,
		headers: headers,
	}
}

// Payload returns the message payload
func (m *Message) Payload() []byte {
	// If payload was set (mutated), return it
	if m.payload != nil {
		return m.payload
	}

	// Otherwise, get from original message based on type
	switch m.Type {
	case MessageTypeJetstreamMsg:
		if m.JetstreamMsgOriginal != nil {
			return m.JetstreamMsgOriginal.Data()
		}
	case MessageTypeNatsMsg:
		if m.NatsMsgOriginal != nil {
			return m.NatsMsgOriginal.Data
		}
	case MessageTypeFranzKafka:
		if m.FranzKafkaOriginal != nil {
			return m.FranzKafkaOriginal.Value
		}
	}

	return nil
}

// SetPayload sets the message payload
func (m *Message) SetPayload(data []byte) {
	m.payload = data
}

// GetHeader returns the first header value for a given key
func (m *Message) GetHeader(key string) string {
	// Check if key exists in mutated headers
	if m.headers != nil {
		if values, exists := m.headers[key]; exists && len(values) > 0 {
			return values[0]
		}
	}

	// If not found in mutated headers, check original message based on type
	switch m.Type {
	case MessageTypeJetstreamMsg:
		if m.JetstreamMsgOriginal != nil {
			vals := m.JetstreamMsgOriginal.Headers().Values(key)
			if len(vals) > 0 {
				return vals[0]
			}
		}
	case MessageTypeNatsMsg:
		if m.NatsMsgOriginal != nil {
			vals := m.NatsMsgOriginal.Header.Values(key)
			if len(vals) > 0 {
				return vals[0]
			}
		}
	case MessageTypeFranzKafka:
		if m.FranzKafkaOriginal != nil {
			for _, h := range m.FranzKafkaOriginal.Headers {
				if h.Key == key {
					return string(h.Value)
				}
			}
		}
	}

	return ""
}

// AddHeader adds a header value for a given key
func (m *Message) AddHeader(key string, value string) {
	if m.headers == nil {
		m.headers = make(map[string][]string)
	}

	m.headers[key] = append(m.headers[key], value)
}

// DeleteHeader removes all values for a given key
func (m *Message) DeleteHeader(key string) {
	if m.headers != nil {
		delete(m.headers, key)
	}
}

// Headers returns all headers, merging original headers with any internal mutations.
// Internal headers take precedence over original headers.
func (m *Message) Headers() map[string][]string {
	result := make(map[string][]string)

	// First, copy headers from original message based on type
	switch m.Type {
	case MessageTypeJetstreamMsg:
		if m.JetstreamMsgOriginal != nil && m.JetstreamMsgOriginal.Headers() != nil {
			for key, values := range m.JetstreamMsgOriginal.Headers() {
				result[key] = append([]string(nil), values...)
			}
		}
	case MessageTypeNatsMsg:
		if m.NatsMsgOriginal != nil && m.NatsMsgOriginal.Header != nil {
			for key, values := range m.NatsMsgOriginal.Header {
				result[key] = append([]string(nil), values...)
			}
		}
	case MessageTypeFranzKafka:
		if m.FranzKafkaOriginal != nil {
			for _, h := range m.FranzKafkaOriginal.Headers {
				result[h.Key] = append(result[h.Key], string(h.Value))
			}
		}
	}

	// Then merge/overwrite with internal headers
	for key, values := range m.headers {
		result[key] = append([]string(nil), values...)
	}

	return result
}

type FailedMessage struct {
	Message Message
	Error   error
}

func FailedMessageToMessage(failedMessage FailedMessage, role string, err error) (Message, error) {
	dlqMessage, dlqErr := NewDLQMessage(
		role,
		err.Error(),
		failedMessage.Message.Payload(),
	).ToJSON()
	if dlqErr != nil {
		return Message{}, fmt.Errorf("new dlq message")
	}

	return Message{
		Type:            MessageTypeNatsMsg,
		NatsMsgOriginal: &nats.Msg{Data: dlqMessage, Header: failedMessage.Message.Headers()},
	}, nil
}
