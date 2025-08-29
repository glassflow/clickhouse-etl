package service

import "context"

type Runner interface {
	Start(ctx context.Context) error
	Shutdown()
	Done() <-chan struct{}
}
