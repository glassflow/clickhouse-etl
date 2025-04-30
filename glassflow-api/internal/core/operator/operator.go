package operator

import "context"

type StopOptions struct {
	NoWait bool
}

type StopOption func(*StopOptions)

func WithNoWait(noWait bool) StopOption {
	return func(opts *StopOptions) {
		opts.NoWait = noWait
	}
}

type Operator interface {
	Start(context.Context, chan<- error)
	Stop(...StopOption)
}
