package component

type StopOptions struct {
	NoWait bool
}

type StopOption func(*StopOptions)

func WithNoWait(noWait bool) StopOption {
	return func(opts *StopOptions) {
		opts.NoWait = noWait
	}
}
