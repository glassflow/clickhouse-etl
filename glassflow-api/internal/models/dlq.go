package models

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
)

// GetDLQStreamName generates a unique DLQ stream name for a pipeline
func GetDLQStreamName(pipelineID string) string {
	hash := GenerateStreamHash(pipelineID)
	return fmt.Sprintf("%s-%s-%s", internal.PipelineStreamPrefix, hash, internal.DLQSuffix)
}

// GetDLQStreamSubjectName generates a NATS subject name for the DLQ stream
func GetDLQStreamSubjectName(pipelineID string) string {
	streamName := GetDLQStreamName(pipelineID)
	return streamName + ".failed"
}

type DLQMessage struct {
	Component       string  `json:"component"` // TODO: make it component kind enum
	Error           string  `json:"error"`
	OriginalMessage Payload `json:"original_message"`
}

func NewDLQMessage(component, err string, data []byte) DLQMessage {
	return DLQMessage{
		Component:       component,
		Error:           err,
		OriginalMessage: NewOriginalMessage(data),
	}
}

func (m DLQMessage) ToJSON() ([]byte, error) {
	bytes, err := json.Marshal(m)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal DLQMessage: %w", err)
	}
	return bytes, nil
}

type Payload string

func NewOriginalMessage(msg []byte) Payload {
	return Payload(string(msg))
}

func (p Payload) String() string {
	return string(p)
}

type DLQBatchSize struct {
	Int int
}

var ErrDLQMaxBatchSize = fmt.Errorf("DLQ batch size cannot be greater than %d", internal.DLQMaxBatchSize)

func NewDLQBatchSize(n int) (zero DLQBatchSize, _ error) {
	switch {
	case n == 0:
		return DLQBatchSize{Int: internal.DLQMaxBatchSize}, nil
	case n > internal.DLQMaxBatchSize:
		return zero, ErrDLQMaxBatchSize
	default:
		return DLQBatchSize{
			Int: n,
		}, nil
	}
}

type DLQState struct {
	LastReceivedAt     *time.Time
	LastConsumedAt     *time.Time
	TotalMessages      uint64
	UnconsumedMessages uint64
}
