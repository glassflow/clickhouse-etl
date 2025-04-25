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

type Subscriber struct {
	consumer    *Consumer
	wg          sync.WaitGroup
	isStopSent  bool
	isDrainSent bool
	mu          sync.Mutex
	closedCh    chan struct{}
	log         *slog.Logger
}

func NewSubscriber(consumer *Consumer, log *slog.Logger) *Subscriber {
	return &Subscriber{
		consumer:    consumer,
		wg:          sync.WaitGroup{},
		isStopSent:  false,
		isDrainSent: false,
		mu:          sync.Mutex{},
		log:         log,
		closedCh:    make(chan struct{}),
	}
}

func (s *Subscriber) Subscribe(handler func(msg jetstream.Msg)) error {
	if s.consumer == nil {
		return fmt.Errorf("consumer is nil")
	}

	s.wg.Add(1)

	go func() {
		defer s.wg.Done()
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
					s.log.Error("error on getting message", slog.Any("error", err))
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

func (s *Subscriber) Closed() <-chan struct{} {
	s.mu.Lock()
	defer s.mu.Unlock()

	return s.closedCh
}

func (s *Subscriber) Stop() {
	s.mu.Lock()
	if s.isStopSent || s.isDrainSent {
		s.log.Warn("stop signal already sent")
		s.mu.Unlock()
		return
	}

	s.log.Info("sending stop signal to subscriber")
	s.isStopSent = true
	s.mu.Unlock()

	go func() {
		s.wg.Wait()
		s.mu.Lock()
		close(s.closedCh)
		s.mu.Unlock()
		s.log.Info("subscriber stopped")
	}()
}

func (s *Subscriber) DrainAndStop() {
	s.mu.Lock()
	if s.isStopSent || s.isDrainSent {
		s.log.Warn("stop signal already sent")
		s.mu.Unlock()
		return
	}

	s.log.Info("sending drain signal to subscriber")
	s.isDrainSent = true
	s.mu.Unlock()

	go func() {
		s.wg.Wait()
		s.mu.Lock()
		close(s.closedCh)
		s.mu.Unlock()
		s.log.Info("subscriber drained and stopped")
	}()
}
