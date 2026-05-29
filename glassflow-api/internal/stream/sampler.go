package stream

import (
	"context"
	"log/slog"
	"time"

	"github.com/nats-io/nats.go/jetstream"

	"github.com/glassflow/clickhouse-etl/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl/glassflow-api/pkg/observability"
)

// StreamSampler periodically reads JetStream StreamInfo for a single stream
// and emits depth / depth-ratio gauges. One sampler instance per stream.
type StreamSampler struct {
	js         jetstream.JetStream
	streamName string
	interval   time.Duration
	log        *slog.Logger
}

func NewStreamSampler(js jetstream.JetStream, streamName string, log *slog.Logger) *StreamSampler {
	return &StreamSampler{
		js:         js,
		streamName: streamName,
		interval:   internal.IngestorStreamDepthSampleInterval,
		log:        log,
	}
}

// Run blocks until ctx is cancelled, sampling on every tick. Errors are logged
// at debug and skipped — sampling failures must not crash the ingestor.
func (s *StreamSampler) Run(ctx context.Context) {
	t := time.NewTicker(s.interval)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			s.sample(ctx)
		}
	}
}

func (s *StreamSampler) sample(ctx context.Context) {
	str, err := s.js.Stream(ctx, s.streamName)
	if err != nil {
		s.log.DebugContext(ctx, "stream sampler: stream lookup failed",
			slog.String("stream", s.streamName),
			slog.Any("error", err))
		return
	}
	info, err := str.Info(ctx)
	if err != nil {
		s.log.DebugContext(ctx, "stream sampler: info failed",
			slog.String("stream", s.streamName),
			slog.Any("error", err))
		return
	}
	depth := int64(info.State.Msgs) //nolint:gosec // depth is bounded by stream limits
	observability.RecordStreamDepth(ctx, s.streamName, depth)
	if info.Config.MaxMsgs > 0 {
		observability.RecordStreamDepthRatio(ctx, s.streamName,
			float64(depth)/float64(info.Config.MaxMsgs))
	}
}
