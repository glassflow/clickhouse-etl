package join

import (
	"context"

	"github.com/nats-io/nats.go/jetstream"
)

type Executor interface {
	HandleLeftStreamEvents(context.Context, jetstream.Msg) error
	HandleRightStreamEvents(context.Context, jetstream.Msg) error
}
