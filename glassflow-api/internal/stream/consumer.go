package stream

import (
	"context"
	"errors"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/nats-io/nats.go/jetstream"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
)

// (e.g. "ack policy can not be updated" on existing consumers).
const JSErrCodeConsumerCreate jetstream.ErrorCode = 10012

type ConsumerConfig struct {
	NatsStream    string
	NatsConsumer  string
	NatsSubject   string
	AckWait       time.Duration
	ExpireTimeout time.Duration
}

func NewNATSConsumer(
	ctx context.Context,
	js jetstream.JetStream,
	cfg jetstream.ConsumerConfig,
	streamName string,
) (jetstream.Consumer, error) {
	var (
		stream jetstream.Stream
		err    error
	)

	retryCtx, cancel := context.WithTimeout(ctx, internal.ConsumerMaxWait)
	defer cancel()

	retryDelay := internal.ConsumerInitialRetryDelay
	startTime := time.Now()

	for i := range internal.ConsumerRetries {
		if time.Since(startTime) > internal.ConsumerMaxWait {
			return nil, fmt.Errorf("timeout after %v waiting for the NATS stream %s", internal.ConsumerMaxWait, streamName)
		}

		stream, err = js.Stream(ctx, streamName)
		if err == nil {
			break
		}

		if errors.Is(err, jetstream.ErrStreamNotFound) {
			if i < internal.ConsumerRetries-1 {
				select {
				case <-time.After(retryDelay):
					log.Printf("Retrying connection to NATS to stream %s in %v...", streamName, retryDelay)
					// Continue with retry
				case <-retryCtx.Done():
					return nil, fmt.Errorf("context cancelled during retry delay for stream %s: %w", streamName, retryCtx.Err())
				}

				retryDelay = min(time.Duration(float64(retryDelay)*1.5), internal.ConsumerMaxRetryDelay)
			}
			continue
		}

		return nil, fmt.Errorf("get stream %s: %w", streamName, err)
	}
	if err != nil {
		return nil, fmt.Errorf("get stream %s: %w", streamName, err)
	}

	consumer, err := stream.CreateOrUpdateConsumer(ctx, cfg)
	if err != nil {
		var apiErr *jetstream.APIError
		if errors.As(err, &apiErr) && apiErr.ErrorCode == JSErrCodeConsumerCreate &&
			strings.Contains(apiErr.Description, "ack policy") {
			consumerName := cfg.Name
			if consumerName == "" {
				consumerName = cfg.Durable
			}
			if consumerName != "" {
				existing, getErr := stream.Consumer(ctx, consumerName)
				if getErr == nil {
					log.Printf("using existing consumer %s: ack policy cannot be updated on old consumers, skipping config change", consumerName)
					return existing, nil
				}
			}
		}
		return nil, fmt.Errorf("get or create consumer: %w", err)
	}

	return consumer, nil
}
