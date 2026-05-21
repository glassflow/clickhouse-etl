// Package natshealth runs a background goroutine that periodically issues a
// JetStream AccountInfo request to verify NATS is responsive end-to-end. The
// result feeds the OTLP receiver's /healthz so a wedged JetStream connection
// (e.g. cluster member restart mid-flight) is visible to kubelet and turns
// into a pod restart instead of a silent 26-hour ingest outage.
//
// AccountInfo exercises the JetStream API surface but not the async-publish
// ack-tracking path that the production traffic uses. It catches most NATS
// failures (broker down, network partition, JetStream meta-leader failover)
// but is not a guarantee that publishes are actually succeeding. A synthetic
// publish probe would be strictly more accurate at the cost of writing into
// the data plane on every tick; AccountInfo is the cheaper first step.
package natshealth

import (
	"context"
	"log/slog"
	"sync/atomic"
	"time"

	"github.com/nats-io/nats.go/jetstream"
)

// Probe samples JetStream health on a fixed interval and tracks the timestamp
// of the most recent successful sample. Healthy() reports whether the most
// recent success is within the configured staleness window.
type Probe struct {
	js         jetstream.JetStream
	interval   time.Duration
	timeout    time.Duration
	staleAfter time.Duration
	log        *slog.Logger

	lastGoodNanos atomic.Int64 // unix nano of last successful AccountInfo; 0 == never
}

func NewProbe(
	js jetstream.JetStream,
	interval time.Duration,
	timeout time.Duration,
	staleAfter time.Duration,
	log *slog.Logger,
) *Probe {
	return &Probe{
		js:         js,
		interval:   interval,
		timeout:    timeout,
		staleAfter: staleAfter,
		log:        log,
	}
}

// Start runs the probe loop until ctx cancels. The first sample is taken
// immediately so Healthy() has a fresh result before the first tick fires.
func (p *Probe) Start(ctx context.Context) {
	go func() {
		p.tick(ctx)

		t := time.NewTicker(p.interval)
		defer t.Stop()

		for {
			select {
			case <-ctx.Done():
				return
			case <-t.C:
				p.tick(ctx)
			}
		}
	}()
}

func (p *Probe) tick(ctx context.Context) {
	probeCtx, cancel := context.WithTimeout(ctx, p.timeout)
	defer cancel()

	if _, err := p.js.AccountInfo(probeCtx); err != nil {
		p.log.WarnContext(ctx, "NATS health probe failed", slog.Any("error", err))
		return
	}

	p.lastGoodNanos.Store(time.Now().UnixNano())
}

// Healthy reports whether NATS acknowledged a JetStream request within
// staleAfter. lastGood is the timestamp of the most recent success, or the
// zero value if no sample has ever succeeded.
func (p *Probe) Healthy() (ok bool, lastGood time.Time) {
	ts := p.lastGoodNanos.Load()
	if ts == 0 {
		return false, time.Time{}
	}
	lastGood = time.Unix(0, ts)
	return time.Since(lastGood) <= p.staleAfter, lastGood
}
