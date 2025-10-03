package stream

import (
	"errors"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/nats-io/nats.go"
	"github.com/nats-io/nats.go/jetstream"
)

type Subscriber interface {
	Subscribe(handler func(msg jetstream.Msg)) error
	Closed() <-chan struct{}
	Stop()
	DrainAndStop()
}

type NatsSubscriber struct {
	consumer    Consumer
	wg          sync.WaitGroup
	isStopSent  bool
	isDrainSent bool
	mu          sync.Mutex
	closedCh    chan struct{}
	log         *slog.Logger
}

func NewNATSSubscriber(consumer Consumer, log *slog.Logger) *NatsSubscriber {
	return &NatsSubscriber{
		consumer:    consumer,
		wg:          sync.WaitGroup{},
		isStopSent:  false,
		isDrainSent: false,
		mu:          sync.Mutex{},
		log:         log,
		closedCh:    make(chan struct{}),
	}
}

func (s *NatsSubscriber) Subscribe(handler func(msg jetstream.Msg)) error {
	if s.consumer == nil {
		s.log.Error("consumer is nil")
		return fmt.Errorf("consumer is nil")
	}

	s.wg.Add(1)

	go func() {
		defer s.wg.Done()
		defer close(s.closedCh)
		for {
			msg, err := s.consumer.Next()
			if err != nil {
				s.mu.Lock()
				readyToStop := s.isStopSent || s.isDrainSent
				s.mu.Unlock()

				if readyToStop {
					s.log.Debug("stop signal received, exiting subscriber loop")
					return
				}

				if !(errors.Is(err, jetstream.ErrNoMessages) || errors.Is(err, nats.ErrTimeout)) {
					s.log.Error("error on getting message", "error", err)
				}
				time.Sleep(100 * time.Millisecond)
				continue
			}
			handler(msg)
			s.mu.Lock()
			readyToStop := s.isStopSent
			s.mu.Unlock()

			// Exit only if stop signal is sent, not drain
			if readyToStop {
				s.log.Debug("stop signal received, exiting subscriber loop")
				return
			}
		}
	}()

	return nil
}

func (s *NatsSubscriber) Closed() <-chan struct{} {
	return s.closedCh
}

func (s *NatsSubscriber) Stop() {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.isStopSent || s.isDrainSent {
		s.log.Warn("stop signal already sent")
		s.mu.Unlock()
		return
	}

	s.log.Info("sending stop signal to subscriber")
	s.isStopSent = true
}

func (s *NatsSubscriber) DrainAndStop() {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.isStopSent || s.isDrainSent {
		s.log.Warn("stop signal already sent")
		return
	}

	s.log.Info("sending drain signal to subscriber")
	s.isDrainSent = true
}
