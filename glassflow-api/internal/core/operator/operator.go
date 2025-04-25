package operator

import "context"

type StopOptions struct {
	NoWait bool
}

type StopOtion func(*StopOptions)

func WithNoWait(noWait bool) StopOtion {
	return func(opts *StopOptions) {
		opts.NoWait = noWait
	}
}

type Operator interface {
	Start(context.Context, chan<- error)
	Stop(...StopOtion)
}
