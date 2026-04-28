package stream

import (
	"errors"

	"github.com/nats-io/nats.go"
	"github.com/nats-io/nats.go/jetstream"
)

// ErrStreamMaxPendingMsgs is returned when the client-side async-publish
// pending window is full and could not drain within the configured budget.
// Callers should treat this as a backpressure signal, not a publish failure.
var ErrStreamMaxPendingMsgs = errors.New("stream max pending messages reached")

// JSErrCodeStreamStoreFailed (10077) is the JetStream API error code returned
// when the server fails to store a published message. With DiscardNew streams
// this is the code surfaced when the stream is full ("maximum messages
// exceeded" / "maximum bytes exceeded" / "maximum messages per subject
// exceeded"). nats.go does not export a constant for this code, so we declare
// it locally.
const JSErrCodeStreamStoreFailed jetstream.ErrorCode = 10077

// IsBackpressureErr reports whether err indicates that the publish should be
// retried after the stream / pending window drains. This covers:
//   - client-side throttle exhaustion (ErrStreamMaxPendingMsgs)
//   - server-side stream-full PubAck NAKs (JSErrCodeStreamStoreFailed)
func IsBackpressureErr(err error) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, ErrStreamMaxPendingMsgs) {
		return true
	}
	var apiErr *jetstream.APIError
	if errors.As(err, &apiErr) && apiErr.ErrorCode == JSErrCodeStreamStoreFailed {
		return true
	}
	return false
}

// IsFatalPublishErr reports whether err means the publish path is unusable
// and the pipeline should be torn down rather than retried. Context
// cancellation is intentionally not in this set — it represents a clean
// shutdown, not a failure.
func IsFatalPublishErr(err error) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, nats.ErrConnectionClosed) ||
		errors.Is(err, jetstream.ErrStreamNotFound) {
		return true
	}
	return false
}
