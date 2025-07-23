package models

import (
	"encoding/json"
	"fmt"
	"time"
)

const (
	DLQMaxBatchSize = 100
	DLQSuffix       = "DLQ"
)

func GetDLQStreamName(pipelineID string) string {
	return fmt.Sprintf("%s-%s", pipelineID, DLQSuffix)
}

func GetDLQStreamSubjectName(pipelineID string) string {
	return GetDLQStreamName(pipelineID) + ".failed"
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

var ErrDLQMaxBatchSize = fmt.Errorf("DLQ batch size cannot be greater than %d", DLQMaxBatchSize)

func NewDLQBatchSize(n int) (zero DLQBatchSize, _ error) {
	switch {
	case n == 0:
		return DLQBatchSize{Int: DLQMaxBatchSize}, nil
	case n > DLQMaxBatchSize:
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
