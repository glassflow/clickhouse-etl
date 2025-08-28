package component

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

type Component interface {
	Start(context.Context, chan<- error)
	Stop(...StopOption)
	Done() <-chan struct{} // Signals when component stops by itself
}
