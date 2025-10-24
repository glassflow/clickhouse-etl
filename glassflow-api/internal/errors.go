package internal

import "fmt"

var (
	ErrDLQNotExists    = fmt.Errorf("dlq does not exist")
	ErrNoMessagesInDLQ = fmt.Errorf("no content")
)
