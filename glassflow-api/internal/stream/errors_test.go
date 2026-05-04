package stream_test

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"github.com/nats-io/nats.go"
	"github.com/nats-io/nats.go/jetstream"
	"github.com/stretchr/testify/require"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/stream"
)

func TestIsBackpressureErr(t *testing.T) {
	streamFullAPIErr := &jetstream.APIError{
		ErrorCode:   stream.JSErrCodeStreamStoreFailed,
		Description: "maximum messages exceeded",
		Code:        503,
	}

	tests := []struct {
		name string
		err  error
		want bool
	}{
		{"nil", nil, false},
		{"sentinel", stream.ErrStreamMaxPendingMsgs, true},
		{"wrapped sentinel", fmt.Errorf("publish: %w", stream.ErrStreamMaxPendingMsgs), true},
		{"stream-store-failed APIError", streamFullAPIErr, true},
		{"wrapped stream-store-failed", fmt.Errorf("ack: %w", streamFullAPIErr), true},
		{"unrelated APIError", &jetstream.APIError{ErrorCode: jetstream.JSErrCodeStreamNotFound}, false},
		{"connection closed", nats.ErrConnectionClosed, false},
		{"random", errors.New("boom"), false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.want, stream.IsBackpressureErr(tt.err))
		})
	}
}

func TestIsFatalPublishErr(t *testing.T) {
	tests := []struct {
		name string
		err  error
		want bool
	}{
		{"nil", nil, false},
		{"connection closed", nats.ErrConnectionClosed, true},
		{"wrapped connection closed", fmt.Errorf("publish: %w", nats.ErrConnectionClosed), true},
		{"stream not found", jetstream.ErrStreamNotFound, true},
		{"context cancelled is not fatal", context.Canceled, false},
		{"deadline exceeded is not fatal", context.DeadlineExceeded, false},
		{"backpressure sentinel is not fatal", stream.ErrStreamMaxPendingMsgs, false},
		{"random", errors.New("boom"), false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.want, stream.IsFatalPublishErr(tt.err))
		})
	}
}
