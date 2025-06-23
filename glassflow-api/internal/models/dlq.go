package models

import (
	"fmt"
	"time"
)

const DLQMaxBatchSize = 100

type DLQMessage struct {
	Component       string  `json:"component"` // TODO: make it component kind enum
	Error           string  `json:"error"`
	OriginalMessage Payload `json:"original_message"`
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
