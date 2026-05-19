package ingestor

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/nats-io/nats.go"
	"github.com/nats-io/nats.go/jetstream"
	"github.com/stretchr/testify/require"
	"github.com/twmb/franz-go/pkg/kgo"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/stream"
)

// fakeSchema satisfies ingestor.SchemaValidator with a no-op validation that
// always returns version "v1", non-external, dedup-disabled. The processor's
// prepareMessage path produces a valid nats.Msg without touching a real
// schema store.
type fakeSchema struct{}

func (fakeSchema) Validate(_ context.Context, _ []byte) (string, error) { return "v1", nil }
func (fakeSchema) Get(_ context.Context, _, _ string, _ []byte) (any, error) {
	return nil, errors.New("not used")
}
func (fakeSchema) IsExternal() bool { return false }

// fakeFuture mirrors jetstream.PubAckFuture with controllable Ok/Err
// channels. Exactly one of okCh / errCh is signalled at construction time so
// drain reads return immediately.
type fakeFuture struct {
	msg   *nats.Msg
	okCh  chan *jetstream.PubAck
	errCh chan error
}

func newOkFuture(msg *nats.Msg) *fakeFuture {
	f := &fakeFuture{msg: msg, okCh: make(chan *jetstream.PubAck, 1), errCh: make(chan error, 1)}
	f.okCh <- &jetstream.PubAck{Stream: "test", Sequence: 1}
	return f
}

func newErrFuture(msg *nats.Msg, err error) *fakeFuture {
	f := &fakeFuture{msg: msg, okCh: make(chan *jetstream.PubAck, 1), errCh: make(chan error, 1)}
	f.errCh <- err
	return f
}

func (f *fakeFuture) Ok() <-chan *jetstream.PubAck { return f.okCh }
func (f *fakeFuture) Err() <-chan error            { return f.errCh }
func (f *fakeFuture) Msg() *nats.Msg               { return f.msg }

// fakePublisher implements stream.Publisher with programmable per-call
// behaviour for PublishNatsMsgAsync. dlqCalls counts Publish() invocations,
// which the processor uses for DLQ writes.
type fakePublisher struct {
	subject string

	mu        sync.Mutex
	publishFn func(callIdx int, msg *nats.Msg) (jetstream.PubAckFuture, error)
	dlqFn     func(data []byte) error // optional override for the DLQ path

	publishCalls atomic.Int32
	dlqCalls     atomic.Int32
	ackDoneCh    chan struct{}
}

func newFakePublisher(subject string) *fakePublisher {
	ch := make(chan struct{})
	close(ch) // PublishAsyncComplete returns a closed channel since fakes resolve synchronously
	return &fakePublisher{subject: subject, ackDoneCh: ch}
}

func (f *fakePublisher) setPublish(fn func(callIdx int, msg *nats.Msg) (jetstream.PubAckFuture, error)) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.publishFn = fn
}

func (f *fakePublisher) Publish(_ context.Context, data []byte) error {
	f.dlqCalls.Add(1)
	f.mu.Lock()
	fn := f.dlqFn
	f.mu.Unlock()
	if fn != nil {
		return fn(data)
	}
	return nil
}
func (f *fakePublisher) GetSubject() string { return f.subject }
func (f *fakePublisher) PublishNatsMsg(_ context.Context, _ *nats.Msg, _ ...stream.PublishOpt) error {
	return nil
}
func (f *fakePublisher) PublishNatsMsgAsync(_ context.Context, msg *nats.Msg, _ int) (jetstream.PubAckFuture, error) {
	idx := int(f.publishCalls.Add(1)) - 1
	f.mu.Lock()
	fn := f.publishFn
	f.mu.Unlock()
	return fn(idx, msg)
}
func (f *fakePublisher) WaitForAsyncPublishAcks() <-chan struct{} { return f.ackDoneCh }

// makeBatch returns N kgo.Records with offsets 0..N-1 and a small payload.
func makeBatch(n int) []*kgo.Record {
	batch := make([]*kgo.Record, n)
	for i := range batch {
		batch[i] = &kgo.Record{
			Offset:    int64(i),
			Topic:     "test",
			Partition: 0,
			Value:     []byte(`{"k":"v"}`),
		}
	}
	return batch
}

func newProcessor(t *testing.T, pub stream.Publisher) *KafkaMsgProcessor {
	t.Helper()
	p, err := NewKafkaMsgProcessor(
		"pipeline-test",
		pub,
		pub, // dlq publisher: reuse so we can count Publish() calls as DLQ writes
		fakeSchema{},
		models.KafkaTopicsConfig{Name: "test", Replicas: 1},
		models.IngestorRuntimeConfig{
			OutputSubject:     "out",
			TotalSubjectCount: 1,
		},
		nil, // signalPublisher: not invoked on the success path
		slog.New(slog.NewTextHandler(io.Discard, nil)),
	)
	require.NoError(t, err)
	return p
}

func streamFullErr() error {
	return &jetstream.APIError{
		ErrorCode:   stream.JSErrCodeStreamStoreFailed,
		Description: "maximum messages exceeded",
		Code:        503,
	}
}

func TestProcessBatch_AllAck(t *testing.T) {
	pub := newFakePublisher("out")
	pub.setPublish(func(_ int, msg *nats.Msg) (jetstream.PubAckFuture, error) {
		return newOkFuture(msg), nil
	})
	p := newProcessor(t, pub)

	batch := makeBatch(10)
	last, err := p.ProcessBatch(context.Background(), batch)

	require.NoError(t, err)
	require.Same(t, batch[9], last)
	require.Equal(t, int32(0), pub.dlqCalls.Load())
	require.Equal(t, int32(10), pub.publishCalls.Load())
}

// Throttle hits at index 30 of a 100-record batch on the first iteration.
// On the second iteration, the throttle clears and the rest publishes
// successfully. processBatchAsync should drive the batch to completion via
// its internal retry loop without DLQ'ing anything.
func TestProcessBatch_ThrottleHitClearsOnRetry(t *testing.T) {
	pub := newFakePublisher("out")
	const cutoff = 30
	var firstPass atomic.Bool
	firstPass.Store(true)

	pub.setPublish(func(idx int, msg *nats.Msg) (jetstream.PubAckFuture, error) {
		// First pass: throttle hits at and past idx==cutoff. Second pass: all ok.
		if firstPass.Load() && idx >= cutoff {
			// On the iteration boundary, the publisher would normally drain;
			// flip the flag once we've returned the throttle error so the
			// next iteration succeeds.
			firstPass.Store(false)
			return nil, stream.ErrStreamMaxPendingMsgs
		}
		return newOkFuture(msg), nil
	})
	p := newProcessor(t, pub)

	batch := makeBatch(100)
	last, err := p.ProcessBatch(context.Background(), batch)

	require.NoError(t, err)
	require.Same(t, batch[99], last)
	require.Equal(t, int32(0), pub.dlqCalls.Load(),
		"throttle should not DLQ; the records are retried in the internal loop")
}

// A server-side stream-full NAK on r3 lands in the future-drain phase. r4..r99
// publish successfully. The contiguous-prefix walk must not advance past r2
// until r3 is retried. On the second iteration r3 ok's and the contiguous
// walk pulls lastProcessed forward to the end of the batch.
func TestProcessBatch_ServerSideNakRecovers(t *testing.T) {
	pub := newFakePublisher("out")
	const nakAt = 3
	var nakReturned atomic.Bool

	pub.setPublish(func(idx int, msg *nats.Msg) (jetstream.PubAckFuture, error) {
		if idx == nakAt && !nakReturned.Load() {
			nakReturned.Store(true)
			return newErrFuture(msg, streamFullErr()), nil
		}
		return newOkFuture(msg), nil
	})
	p := newProcessor(t, pub)

	batch := makeBatch(100)
	last, err := p.ProcessBatch(context.Background(), batch)

	require.NoError(t, err)
	require.Same(t, batch[99], last,
		"contiguous walk must reach end of batch once r3 retries successfully")
	require.Equal(t, int32(0), pub.dlqCalls.Load(),
		"server-side stream-full NAK is backpressure, not DLQable")
	// Total publish calls: 100 fresh + 1 retry of r3.
	require.Equal(t, int32(101), pub.publishCalls.Load())
}

// A fatal future error on r5 (e.g., stream-not-found) puts r5 in the DLQ-on-
// exit set, sets savedErr, and triggers cleanup. lastProcessed should advance
// through the contiguous walk once r5 is DLQ'd.
func TestProcessBatch_FatalFutureErrCleanupDLQs(t *testing.T) {
	pub := newFakePublisher("out")
	const fatalAt = 5
	fatalErr := errors.New("stream gone")

	pub.setPublish(func(idx int, msg *nats.Msg) (jetstream.PubAckFuture, error) {
		if idx == fatalAt {
			return newErrFuture(msg, fatalErr), nil
		}
		return newOkFuture(msg), nil
	})
	p := newProcessor(t, pub)

	batch := makeBatch(20)
	last, err := p.ProcessBatch(context.Background(), batch)

	require.Error(t, err)
	require.ErrorIs(t, err, fatalErr)
	require.Same(t, batch[19], last,
		"after r5 is DLQ'd in cleanup, contiguous walk should reach the end")
	require.Equal(t, int32(1), pub.dlqCalls.Load(),
		"only the fatal-classified record goes to DLQ, not the backpressure-class siblings")
}

// ctx cancellation during the backoff sleep returns within bounded time.
// All records take server-side NAKs so they sit in the backpressure carry
// slice. On ctx cancel the carry must NOT be DLQ'd: those records were only
// throttled, not failed, and should be re-consumed from Kafka on restart.
// lastProcessed must stay at the highest contiguous-acked record before the
// carry (here: nil — nothing acked).
func TestProcessBatch_CtxCancelLeavesBackpressureCarryUncommitted(t *testing.T) {
	pub := newFakePublisher("out")
	pub.setPublish(func(_ int, msg *nats.Msg) (jetstream.PubAckFuture, error) {
		return newErrFuture(msg, streamFullErr()), nil
	})
	p := newProcessor(t, pub)

	ctx, cancel := context.WithCancel(context.Background())
	go func() {
		time.Sleep(20 * time.Millisecond)
		cancel()
	}()

	t0 := time.Now()
	batch := makeBatch(3)
	last, err := p.ProcessBatch(ctx, batch)
	elapsed := time.Since(t0)

	require.Error(t, err)
	require.ErrorIs(t, err, context.Canceled)
	require.Less(t, elapsed, internal.IngestorBackpressureMaxDelay,
		"ctx cancel during backoff should return well before the max delay")
	require.Equal(t, int32(0), pub.dlqCalls.Load(),
		"backpressure carry must not be DLQ'd on ctx cancel — those records are merely throttled and should be re-consumed from Kafka")
	require.Nil(t, last,
		"with nothing acked before the carry, lastProcessed must stay nil so the consumer does not advance the Kafka offset")
}

// Mixed case: some records ack, then sustained server-side NAKs push the
// remainder into the backpressure carry, then ctx cancels. The acked prefix
// is reflected in lastProcessed; the carry stays uncommitted (no DLQ).
func TestProcessBatch_CtxCancelKeepsAckedPrefix(t *testing.T) {
	pub := newFakePublisher("out")
	const ackUpTo = 2 // r0, r1 ack; r2..r4 NAK
	pub.setPublish(func(idx int, msg *nats.Msg) (jetstream.PubAckFuture, error) {
		if idx < ackUpTo {
			return newOkFuture(msg), nil
		}
		return newErrFuture(msg, streamFullErr()), nil
	})
	p := newProcessor(t, pub)

	ctx, cancel := context.WithCancel(context.Background())
	go func() {
		time.Sleep(20 * time.Millisecond)
		cancel()
	}()

	batch := makeBatch(5)
	last, err := p.ProcessBatch(ctx, batch)

	require.Error(t, err)
	require.ErrorIs(t, err, context.Canceled)
	require.Equal(t, int32(0), pub.dlqCalls.Load(),
		"throttled records in the carry must not be DLQ'd on ctx cancel")
	require.Same(t, batch[ackUpTo-1], last,
		"lastProcessed must reflect the highest contiguous-acked record before the carry")
}

// If a DLQ push fails during cleanup of a fatal error (not ctx cancel),
// processBatchAsync should expose the DLQ error in the wrapped error chain
// and return the partial lastProcessed (the contiguous prefix it was able to
// DLQ before the failure).
func TestProcessBatch_DLQFailureDuringCleanup(t *testing.T) {
	pub := newFakePublisher("out")
	fatalErr := errors.New("stream gone")
	pub.setPublish(func(_ int, msg *nats.Msg) (jetstream.PubAckFuture, error) {
		return newErrFuture(msg, fatalErr), nil
	})
	dlqErr := errors.New("dlq stream down")
	pub.mu.Lock()
	pub.dlqFn = func(_ []byte) error { return dlqErr }
	pub.mu.Unlock()
	p := newProcessor(t, pub)

	last, err := p.ProcessBatch(context.Background(), makeBatch(3))

	require.Error(t, err)
	require.ErrorIs(t, err, dlqErr,
		"the wrapped error should expose the DLQ failure to the caller")
	// First DLQ push fails so nothing is marked completed; lastProcessed
	// stays nil.
	require.Nil(t, last)
}

// One BP cycle: throttle hits on the first publish call and clears on retry.
// activeBackpressure must end up false once the batch fully drains.
func TestProcessBatchAsync_BackpressureStartStop(t *testing.T) {
	pub := newFakePublisher("out")
	var firstPass atomic.Bool
	firstPass.Store(true)

	pub.setPublish(func(idx int, msg *nats.Msg) (jetstream.PubAckFuture, error) {
		if firstPass.Load() && idx == 0 {
			firstPass.Store(false)
			return nil, stream.ErrStreamMaxPendingMsgs
		}
		return newOkFuture(msg), nil
	})
	p := newProcessor(t, pub)

	require.False(t, p.activeBackpressure, "tracker should start clean")

	batch := makeBatch(3)
	last, err := p.ProcessBatch(context.Background(), batch)

	require.NoError(t, err)
	require.Same(t, batch[2], last)
	require.False(t, p.activeBackpressure,
		"episode must be closed once batch fully drains")
	require.Equal(t, int32(0), pub.dlqCalls.Load(),
		"throttle is retryable, never DLQ'd")
}

// Server-side NAK (stream-full) classified as backpressure during the future
// drain phase exercises the classifyFutures hook. After the retry succeeds,
// the tracker must end clean.
func TestProcessBatchAsync_BackpressureFromAckNak(t *testing.T) {
	pub := newFakePublisher("out")
	const nakAt = 1
	var nakReturned atomic.Bool

	pub.setPublish(func(idx int, msg *nats.Msg) (jetstream.PubAckFuture, error) {
		if idx == nakAt && !nakReturned.Load() {
			nakReturned.Store(true)
			return newErrFuture(msg, streamFullErr()), nil
		}
		return newOkFuture(msg), nil
	})
	p := newProcessor(t, pub)

	batch := makeBatch(5)
	last, err := p.ProcessBatch(context.Background(), batch)

	require.NoError(t, err)
	require.Same(t, batch[4], last)
	require.False(t, p.activeBackpressure,
		"NAK-driven episode must close after the retried record acks")
	require.Equal(t, int32(0), pub.dlqCalls.Load())
}
