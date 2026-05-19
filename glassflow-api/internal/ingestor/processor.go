package ingestor

import (
	"context"
	"errors"
	"fmt"
	"hash/fnv"
	"log/slog"
	"strconv"
	"sync/atomic"
	"time"

	"github.com/nats-io/nats.go"
	"github.com/nats-io/nats.go/jetstream"
	"github.com/twmb/franz-go/pkg/kgo"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/pkg/observability"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/componentsignals"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/stream"
)

// SchemaValidator is the subset of schema_v2.Schema that the ingestor uses.
// Defining it as an interface here keeps the processor unit-testable without
// a real schema registry.
type SchemaValidator interface {
	Validate(ctx context.Context, data []byte) (string, error)
	Get(ctx context.Context, versionID, key string, data []byte) (any, error)
	IsExternal() bool
}

type KafkaMsgProcessor struct {
	pipelineID      string
	publisher       stream.Publisher
	dlqPublisher    stream.Publisher
	schema          SchemaValidator
	topic           models.KafkaTopicsConfig
	signalPublisher *componentsignals.ComponentSignalPublisher
	log             *slog.Logger

	outputSubject       string
	outputSubjectPrefix string
	totalSubjectCount   int
	roundRobinCounter   atomic.Int64
	dedupSubjectPrefix  string
	dedupSubjectCount   int
	singleDedupSubject  string

	pendingPublishesLimit int

	// Back-pressure episode state. Mutated only from the single-goroutine
	// processor driver, so no synchronization is needed.
	activeBackpressure  bool
	backpressureStartTS time.Time
}

func NewKafkaMsgProcessor(
	pipelineID string,
	publisher, dlqPublisher stream.Publisher,
	schema SchemaValidator,
	topic models.KafkaTopicsConfig,
	runtimeCfg models.IngestorRuntimeConfig,
	signalPublisher *componentsignals.ComponentSignalPublisher,
	log *slog.Logger,
) (*KafkaMsgProcessor, error) {
	if topic.Replicas < 1 {
		topic.Replicas = 1
	}

	outputSubject := runtimeCfg.OutputSubject
	if outputSubject == "" {
		return nil, fmt.Errorf("output subject is required")
	}

	dedupSubjectPrefix := runtimeCfg.DedupSubjectPrefix
	dedupSubjectCount := runtimeCfg.DedupSubjectCount
	singleDedupSubject := ""
	if topic.Deduplication.Enabled {
		if dedupSubjectCount <= 0 {
			return nil, fmt.Errorf("dedup subject count must be > 0 when deduplication is enabled")
		}
		if dedupSubjectPrefix == "" {
			return nil, fmt.Errorf("dedup subject prefix is required when deduplication is enabled")
		}
		if dedupSubjectCount == 1 {
			singleDedupSubject = outputSubject
		}
	}

	pendingPublishesLimit := min(internal.PublisherMaxPendingAcks, internal.NATSMaxBufferedMsgs/topic.Replicas)
	return &KafkaMsgProcessor{
		pipelineID:            pipelineID,
		publisher:             publisher,
		dlqPublisher:          dlqPublisher,
		schema:                schema,
		topic:                 topic,
		outputSubject:         outputSubject,
		outputSubjectPrefix:   runtimeCfg.OutputSubjectPrefix,
		totalSubjectCount:     runtimeCfg.TotalSubjectCount,
		dedupSubjectPrefix:    dedupSubjectPrefix,
		dedupSubjectCount:     dedupSubjectCount,
		singleDedupSubject:    singleDedupSubject,
		pendingPublishesLimit: pendingPublishesLimit,
		signalPublisher:       signalPublisher,
		log:                   log,
	}, nil
}

func (k *KafkaMsgProcessor) pushMsgToDLQ(ctx context.Context, orgMsg []byte, err error) error {
	k.log.Error("Pushing message to DLQ", slog.Any("error", err), slog.String("topic", k.topic.Name))

	data, err := models.NewDLQMessage(internal.RoleIngestor, err.Error(), orgMsg).ToJSON()
	if err != nil {
		k.log.Error("Failed to convert DLQ message to JSON", slog.Any("error", err), slog.String("topic", k.topic.Name))
		return fmt.Errorf("failed to convert DLQ message to JSON: %w", err)
	}

	err = k.dlqPublisher.Publish(ctx, data)
	if err != nil {
		k.log.Error("Failed to publish message to DLQ", slog.Any("error", err), slog.String("topic", k.topic.Name))
		return fmt.Errorf("failed to publish to DLQ: %w", err)
	}

	observability.RecordDLQWrite(ctx, internal.RoleIngestor, 1)

	return nil
}

// setDedupHeader sets the Nats-Msg-Id header from a pre-resolved dedup key string.
func (k *KafkaMsgProcessor) setDedupHeader(headers nats.Header, dedupKeyStr string) {
	if dedupKeyStr == "" {
		return
	}

	headers.Set("Nats-Msg-Id", dedupKeyStr)
}

// getSubject returns the NATS subject for publishing.
// When totalSubjectCount > 1, subjects are selected round-robin across all downstream subjects.
func (k *KafkaMsgProcessor) getSubject() string {
	if k.totalSubjectCount <= 1 {
		return k.outputSubject
	}
	n := k.roundRobinCounter.Add(1) - 1
	return fmt.Sprintf("%s.%d", k.outputSubjectPrefix, n%int64(k.totalSubjectCount))
}

// getSubjectAndDedupKey returns the NATS subject for this message and, when dedup is enabled, the dedup key string for the header.
// Resolves the dedup key at most once: same key is used for subject routing (hash % M) and for Nats-Msg-Id header.
// When deduplication is enabled, subject is DedupSubjectPrefix.(hash(dedupKey) % DedupSubjectCount).
func (k *KafkaMsgProcessor) getSubjectAndDedupKey(ctx context.Context, version string, msgData []byte) (subject string, dedupKeyStr string, err error) {
	if !k.topic.Deduplication.Enabled {
		return k.getSubject(), "", nil
	}

	keyValue, err := k.schema.Get(ctx, version, k.topic.Deduplication.ID, msgData)
	if err != nil {
		return "", "", fmt.Errorf("failed to get deduplication key: %w", err)
	}
	if keyValue == nil {
		return "", "", fmt.Errorf("deduplication key is nil for topic %s", k.topic.Name)
	}
	strKey := fmt.Sprintf("%v", keyValue)

	if k.singleDedupSubject != "" {
		return k.singleDedupSubject, strKey, nil
	}

	h := fnv.New64a()
	_, _ = h.Write([]byte(strKey))
	idx := int(h.Sum64() % uint64(k.dedupSubjectCount))
	return fmt.Sprintf("%s.%d", k.dedupSubjectPrefix, idx), strKey, nil
}

func (k *KafkaMsgProcessor) prepareMesssage(ctx context.Context, msg *kgo.Record) (*nats.Msg, error) {
	version, err := k.schema.Validate(ctx, msg.Value)
	if err != nil {
		if models.IsIncompatibleSchemaError(err) || errors.Is(err, models.ErrSchemaNotFound) {
			k.log.Error("Schema validation error has been detected for message",
				slog.String("topic", k.topic.Name),
				slog.Int64("offset", msg.Offset),
				slog.String("partition", strconv.Itoa(int(msg.Partition))),
				slog.String("schemaID", version),
				slog.String("error", err.Error()))

			sigErr := k.signalPublisher.SendSignal(ctx, models.ComponentSignal{
				Component:  internal.RoleIngestor,
				PipelineID: k.pipelineID,
				Reason:     err.Error(),
				Text:       fmt.Sprintf("schema id %s validation failed", version),
			})
			if sigErr != nil {
				return nil, fmt.Errorf("failed to send component signal: %w", sigErr)
			}

			return nil, err

		}

		k.log.Error("Failed to validate data",
			slog.Any("error", err), slog.String("topic", k.topic.Name),
			slog.Int64("offset", msg.Offset),
			slog.String("partition", strconv.Itoa(int(msg.Partition))))

		validationErr := fmt.Errorf("%w: %w", models.ErrValidateSchema, err)
		if errors.Is(err, models.ErrFailedToParseSchemaID) || errors.Is(err, models.ErrMessageIsTooShort) {
			validationErr = err
		}

		if dlqErr := k.pushMsgToDLQ(ctx, msg.Value, validationErr); dlqErr != nil {
			return nil, fmt.Errorf("failed to push to DLQ: %w", dlqErr)
		}
		return nil, nil
	}

	msgData := msg.Value
	if k.schema.IsExternal() {
		msgData = msgData[5:] // Remove magic byte and schema version bytes for external schemas before publishing to NATS
	}
	subject, dedupKeyStr, err := k.getSubjectAndDedupKey(ctx, version, msgData)
	if err != nil {
		if dlqErr := k.pushMsgToDLQ(ctx, msg.Value, fmt.Errorf("%w: %w", models.ErrDeduplicateData, err)); dlqErr != nil {
			return nil, fmt.Errorf("failed to push to DLQ: %w", dlqErr)
		}
		return nil, nil
	}

	nMsg := nats.NewMsg(subject)
	nMsg.Data = msgData

	nMsg.Header.Set(internal.SchemaVersionIDHeader, version) // Set schema version header

	k.setDedupHeader(nMsg.Header, dedupKeyStr)

	return nMsg, nil
}

// bpStart marks the beginning of a back-pressure episode. Idempotent — extra
// calls inside an active episode are no-ops, so the histogram observes one
// duration per episode regardless of how many BP errors happen along the way.
func (k *KafkaMsgProcessor) bpStart(ctx context.Context) {
	if k.activeBackpressure {
		return
	}
	k.activeBackpressure = true
	k.backpressureStartTS = time.Now()
	observability.RecordIngestorBackpressureStart(ctx)
	k.log.InfoContext(ctx, "ingestor backpressure: start",
		slog.String("pipeline_id", k.pipelineID))
}

// bpStop ends an active back-pressure episode and observes its duration.
// No-op when no episode is active.
func (k *KafkaMsgProcessor) bpStop(ctx context.Context) {
	if !k.activeBackpressure {
		return
	}
	dur := time.Since(k.backpressureStartTS).Seconds()
	k.activeBackpressure = false
	observability.RecordIngestorBackpressureStop(ctx, dur)
	k.log.InfoContext(ctx, "ingestor backpressure: stop",
		slog.String("pipeline_id", k.pipelineID),
		slog.Float64("duration_seconds", dur))
}

func (k *KafkaMsgProcessor) ProcessBatch(ctx context.Context, batch []*kgo.Record) (*kgo.Record, error) {
	if len(batch) == 0 {
		return nil, nil
	}

	var lastProcessed *kgo.Record
	var err error

	if internal.DefaultProcessorMode == internal.SyncMode {
		lastProcessed, err = k.processBatchSync(ctx, batch)
		if err != nil {
			return lastProcessed, fmt.Errorf("failed to process sync batch: %w", err)
		}
	} else {
		lastProcessed, err = k.processBatchAsync(ctx, batch)
		if err != nil {
			return lastProcessed, fmt.Errorf("failed to process async batch: %w", err)
		}
	}

	return lastProcessed, nil
}

func (k *KafkaMsgProcessor) processBatchSync(ctx context.Context, batch []*kgo.Record) (*kgo.Record, error) {
	var lastProcessed *kgo.Record
	var outBytes int64

	for _, msg := range batch {
		natsMsg, err := k.prepareMesssage(ctx, msg)
		if err != nil {
			k.log.Error("Failed to prepare message",
				slog.Any("error", err),
				slog.String("topic", msg.Topic),
				slog.Int("partition", int(msg.Partition)))

			return lastProcessed, fmt.Errorf("failed to prepare message: %w", err)
		}
		if natsMsg == nil {
			// Message was pushed to DLQ, count as processed
			lastProcessed = msg
			continue
		}

		err = k.publisher.PublishNatsMsg(ctx, natsMsg, stream.WithUntilAck())
		if err != nil {
			k.log.Error("Failed to publish message to NATS",
				slog.Any("error", err),
				slog.String("topic", msg.Topic),
				slog.Int("partition", int(msg.Partition)))

			if dlqErr := k.pushMsgToDLQ(ctx, msg.Value, err); dlqErr != nil {
				k.log.Error("Failed to push failed message to DLQ",
					slog.Any("error", dlqErr),
					slog.String("topic", msg.Topic),
					slog.Int("partition", int(msg.Partition)))
				return lastProcessed, fmt.Errorf("failed to publish to NATS: %w", err)
			}
		}
		outBytes += int64(len(natsMsg.Data))
		lastProcessed = msg
	}

	observability.RecordBytesProcessed(ctx, "ingestor", "out", outBytes)

	return lastProcessed, nil
}

// pendingPublish pairs an in-flight PubAck future with the index of its
// originating record in the original batch.
type pendingPublish struct {
	future jetstream.PubAckFuture
	idx    int
}

// asyncBatchState holds per-call state for the internal retry loop in
// processBatchAsync. None of this state survives across calls — each batch is
// driven to completion (or to a fatal/ctx-cancel cleanup) within one call.
type asyncBatchState struct {
	batch        []*kgo.Record
	cachedMsgs   []*nats.Msg // index → prepared *nats.Msg (nil = not prepared yet OR DLQ-at-prepare)
	completed    []bool      // index → true when record is acked or DLQ-accepted
	backpressure []int       // indices waiting for retry (their cachedMsgs entry is non-nil)
	dlqOnExit    []int       // indices to DLQ on cleanup (fatal classification)
	cursor       int         // next batch index to publish from
	lastAckedIdx int         // -1 means nothing acked yet
	savedErr     error       // first non-backpressure error; triggers cleanup path
	outBytes     int64
	retries      map[int]int // hook for a future per-record retry cap (currently uncapped)
}

// processBatchAsync drives the batch to completion via an internal retry loop.
// It returns only when:
//   - the whole batch is done (ack, DLQ-at-prepare, or DLQ-on-cleanup): err == nil
//   - a fatal error fires (returns lastProcessed + the error)
//   - ctx cancels (returns lastProcessed + ctx.Err)
//
// Records past a backpressured record may be successfully published to NATS in
// the same pass — they are not re-published. lastProcessed reflects the
// highest contiguous-acked record by original batch position.
func (k *KafkaMsgProcessor) processBatchAsync(ctx context.Context, batch []*kgo.Record) (*kgo.Record, error) {
	if len(batch) == 0 {
		return nil, nil
	}

	s := &asyncBatchState{
		batch:        batch,
		cachedMsgs:   make([]*nats.Msg, len(batch)),
		completed:    make([]bool, len(batch)),
		cursor:       0,
		lastAckedIdx: -1,
		retries:      make(map[int]int),
	}
	backoff := internal.IngestorBackpressureInitialDelay

	var futures []pendingPublish

	for {
		// 1. Re-publish records sitting in the backpressure carry slice.
		futures = k.publishBackpressureSlice(ctx, s, futures)

		// 2. Continue publishing fresh records from the cursor.
		futures = k.publishFromCursor(ctx, s, futures)

		// 3. Wait for in-flight publishes to settle, then classify.
		if len(futures) > 0 {
			<-k.publisher.WaitForAsyncPublishAcks()
			k.classifyFutures(ctx, s, futures)
			futures = futures[:0]
		}

		// 4. Walk the contiguous-acked prefix forward.
		k.advanceLastAckedIdx(s)

		// 5. Termination.
		if s.savedErr != nil {
			return k.cleanupAndReturn(ctx, s, s.savedErr)
		}
		if ctx.Err() != nil {
			return k.cleanupAndReturn(ctx, s, ctx.Err())
		}
		if s.cursor == len(s.batch) && len(s.backpressure) == 0 {
			k.bpStop(ctx)
			observability.RecordBytesProcessed(ctx, "ingestor", "out", s.outBytes)
			return s.batch[len(s.batch)-1], nil
		}

		// 6. Backoff before the next iteration. Interruptible by ctx.
		select {
		case <-ctx.Done():
			return k.cleanupAndReturn(ctx, s, ctx.Err())
		case <-time.After(backoff):
			if backoff < internal.IngestorBackpressureMaxDelay {
				backoff *= 2
				if backoff > internal.IngestorBackpressureMaxDelay {
					backoff = internal.IngestorBackpressureMaxDelay
				}
			}
		}
	}
}

// publishBackpressureSlice retries the records carried over from earlier
// iterations. Each entry's *nats.Msg is already cached. Indices that hit the
// throttle again are kept in the slice; fatal errors set savedErr and route
// the index to dlqOnExit.
func (k *KafkaMsgProcessor) publishBackpressureSlice(ctx context.Context, s *asyncBatchState, futures []pendingPublish) []pendingPublish {
	if len(s.backpressure) == 0 {
		return futures
	}
	carry := s.backpressure[:0]
	for _, idx := range s.backpressure {
		if s.savedErr != nil {
			carry = append(carry, idx)
			continue
		}
		fut, err := k.publisher.PublishNatsMsgAsync(ctx, s.cachedMsgs[idx], k.pendingPublishesLimit)
		if err != nil {
			if stream.IsBackpressureErr(err) {
				k.bpStart(ctx)
				carry = append(carry, idx)
				continue
			}
			// Any non-backpressure error from the publish call is treated as
			// fatal: connection closed, stream not found, ctx cancellation,
			// or anything unclassified. The record stays around for cleanup
			// to DLQ.
			s.savedErr = err
			s.dlqOnExit = append(s.dlqOnExit, idx)
			continue
		}
		futures = append(futures, pendingPublish{future: fut, idx: idx})
	}
	s.backpressure = carry
	return futures
}

// publishFromCursor walks fresh records starting at the cursor. prepareMessage
// runs at most once per record and the result is cached so retries skip
// re-validation. The cursor only advances when a record is committed to its
// fate (cached and queued, or DLQ'd at prepare, or routed to dlqOnExit).
func (k *KafkaMsgProcessor) publishFromCursor(ctx context.Context, s *asyncBatchState, futures []pendingPublish) []pendingPublish {
	for s.cursor < len(s.batch) && s.savedErr == nil {
		rec := s.batch[s.cursor]

		msg := s.cachedMsgs[s.cursor]
		if msg == nil {
			prepared, err := k.prepareMesssage(ctx, rec)
			if err != nil {
				// prepareMessage errors are fatal: schema-incompatible
				// (signal sent), or DLQ-push failure. Record is not added to
				// dlqOnExit because we couldn't even DLQ it; surface the
				// error and let the runner fail the pipeline.
				s.savedErr = err
				return futures
			}
			if prepared == nil {
				// prepareMessage already pushed to DLQ inline.
				s.completed[s.cursor] = true
				s.cursor++
				continue
			}
			s.cachedMsgs[s.cursor] = prepared
			msg = prepared
		}

		fut, err := k.publisher.PublishNatsMsgAsync(ctx, msg, k.pendingPublishesLimit)
		if err != nil {
			if stream.IsBackpressureErr(err) {
				// Throttle hit. Don't advance cursor — try again next iter.
				k.bpStart(ctx)
				return futures
			}
			s.savedErr = err
			s.dlqOnExit = append(s.dlqOnExit, s.cursor)
			s.cursor++
			return futures
		}
		futures = append(futures, pendingPublish{future: fut, idx: s.cursor})
		s.cursor++
	}
	return futures
}

// classifyFutures inspects each in-flight future, marks completed indices, and
// routes failures into either backpressure (retry) or dlqOnExit (fatal).
func (k *KafkaMsgProcessor) classifyFutures(ctx context.Context, s *asyncBatchState, futures []pendingPublish) {
	for _, p := range futures {
		select {
		case <-p.future.Ok():
			s.completed[p.idx] = true
			if msg := s.cachedMsgs[p.idx]; msg != nil {
				s.outBytes += int64(len(msg.Data))
			}
		case err := <-p.future.Err():
			if stream.IsBackpressureErr(err) {
				k.bpStart(ctx)
				s.backpressure = append(s.backpressure, p.idx)
				s.retries[p.idx]++
				continue
			}
			k.log.Error("Async publish ack failed",
				slog.Any("error", err),
				slog.String("subject", p.future.Msg().Subject))
			if s.savedErr == nil {
				s.savedErr = err
			}
			s.dlqOnExit = append(s.dlqOnExit, p.idx)
		}
	}
}

func (k *KafkaMsgProcessor) advanceLastAckedIdx(s *asyncBatchState) {
	for i := s.lastAckedIdx + 1; i < len(s.batch); i++ {
		if !s.completed[i] {
			break
		}
		s.lastAckedIdx = i
	}
}

// isCtxErr reports whether err is a context cancellation or deadline.
func isCtxErr(err error) bool {
	return errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded)
}

// cleanupAndReturn finalizes the batch after a fatal error or ctx cancellation.
//
// Which records get DLQ'd depends on the cause:
//   - fatal error: dlqOnExit AND the backpressure carry. Records past the
//     blocker that already PubAck'd would be re-delivered and republished on
//     restart; DLQ'ing the blocker keeps the rest committable.
//   - ctx cancellation: only dlqOnExit. The carry was merely throttled — it
//     stays in Kafka and is re-consumed on restart, with downstream dedup
//     handling the at-least-once duplicates from records that PubAck'd past
//     the gap.
//
// On ctx cancellation the parent ctx rejects every downstream call, so all
// cleanup-time I/O (bpStop metric, DLQ pushes, bytes counter) runs on a fresh
// bounded ctx. On a DLQ-push failure we stop draining: returning partial
// progress beats silently losing track of which records were DLQ'd.
func (k *KafkaMsgProcessor) cleanupAndReturn(ctx context.Context, s *asyncBatchState, cause error) (*kgo.Record, error) {
	cleanupCtx := ctx
	if isCtxErr(cause) {
		var cancel context.CancelFunc
		cleanupCtx, cancel = context.WithTimeout(context.Background(), internal.DefaultComponentShutdownTimeout)
		defer cancel()
	}

	k.bpStop(cleanupCtx)

	dlqIdxs := s.dlqOnExit
	if !isCtxErr(cause) {
		dlqIdxs = append(dlqIdxs, s.backpressure...)
	}

	dlqErr := k.drainToDLQ(cleanupCtx, s, dlqIdxs, cause)
	k.advanceLastAckedIdx(s)

	observability.RecordBytesProcessed(cleanupCtx, "ingestor", "out", s.outBytes)

	var lastProcessed *kgo.Record
	if s.lastAckedIdx >= 0 {
		lastProcessed = s.batch[s.lastAckedIdx]
	}

	if dlqErr != nil {
		return lastProcessed, errors.Join(cause, dlqErr)
	}

	return lastProcessed, cause
}

// drainToDLQ pushes each not-yet-completed record at the given indices to the
// DLQ and marks it completed. Returns the first DLQ-push error encountered;
// remaining indices are left for the next cleanup attempt or restart.
func (k *KafkaMsgProcessor) drainToDLQ(ctx context.Context, s *asyncBatchState, idxs []int, cause error) error {
	for _, idx := range idxs {
		if s.completed[idx] {
			continue
		}
		err := k.pushMsgToDLQ(ctx, s.batch[idx].Value, fmt.Errorf("ingestor cleanup: %w", cause))
		if err != nil {
			return err
		}
		s.completed[idx] = true
	}
	return nil
}
