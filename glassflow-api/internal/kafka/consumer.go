package kafka

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/avast/retry-go/v4"
	krb5client "github.com/jcmturner/gokrb5/v8/client"
	krb5config "github.com/jcmturner/gokrb5/v8/config"
	krb5keytab "github.com/jcmturner/gokrb5/v8/keytab"
	"github.com/twmb/franz-go/pkg/kgo"
	"github.com/twmb/franz-go/pkg/sasl"
	"github.com/twmb/franz-go/pkg/sasl/kerberos"
	"github.com/twmb/franz-go/pkg/sasl/plain"
	"github.com/twmb/franz-go/pkg/sasl/scram"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/pkg/observability"
)

type MessageProcessor interface {
	ProcessBatch(ctx context.Context, batch []*kgo.Record) error
}

type Consumer struct {
	client       *kgo.Client
	topic        string
	groupID      string
	batch        []*kgo.Record
	processor    MessageProcessor
	meter        *observability.Meter
	log          *slog.Logger
	cancel       context.CancelFunc
	closeCh      chan struct{}
	batchSize    int           // Max batch size before flush
	batchMaxWait time.Duration // Max time before flush
}

type kgoLogger struct {
	log *slog.Logger
}

func (l *kgoLogger) Level() kgo.LogLevel {
	return kgo.LogLevelInfo
}

func (l *kgoLogger) Log(level kgo.LogLevel, msg string, keyvals ...any) {
	var slogLevel slog.Level
	switch level {
	case kgo.LogLevelError:
		slogLevel = slog.LevelError
	case kgo.LogLevelWarn:
		slogLevel = slog.LevelWarn
	case kgo.LogLevelInfo:
		slogLevel = slog.LevelInfo
	case kgo.LogLevelDebug:
		slogLevel = slog.LevelDebug
	default:
		slogLevel = slog.LevelDebug
	}
	keyvals = append(keyvals, slog.String("client", "franz-go"))

	l.log.Log(context.Background(), slogLevel, msg, keyvals...)
}

func NewConsumer(conn models.KafkaConnectionParamsConfig, topic models.KafkaTopicsConfig, log *slog.Logger, meter *observability.Meter) (zero *Consumer, _ error) {
	clientOpts, err := buildClientOptions(conn, topic)
	if err != nil {
		return &Consumer{}, fmt.Errorf("build client options: %w", err)
	}

	clientOpts = append(clientOpts, kgo.WithLogger(&kgoLogger{log: log}))

	client, err := kgo.NewClient(clientOpts...)
	if err != nil {
		return &Consumer{}, fmt.Errorf("failed to create client: %w", err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), internal.DefaultKafkaBatchTimeout)
	defer cancel()

	err = client.Ping(ctx)
	if err != nil {
		return zero, fmt.Errorf("failed to ping kafka brokers: %w", err)
	}

	return &Consumer{
		client:       client,
		topic:        topic.Name,
		groupID:      topic.ConsumerGroupName,
		log:          log,
		meter:        meter,
		batch:        make([]*kgo.Record, 0, internal.KafkaBatchSize),
		closeCh:      make(chan struct{}),
		processor:    nil,
		cancel:       nil,
		batchSize:    internal.KafkaBatchSize,
		batchMaxWait: internal.KafkaBatchMaxWait,
	}, nil
}

func buildClientOptions(conn models.KafkaConnectionParamsConfig, topic models.KafkaTopicsConfig) ([]kgo.Opt, error) {
	opts := []kgo.Opt{
		kgo.SeedBrokers(conn.Brokers...),
		kgo.ConsumerGroup(topic.ConsumerGroupName),
		kgo.ConsumeTopics(topic.Name),
		kgo.ClientID(internal.ClientID),

		// Session configuration
		//kgo.SessionTimeout(internal.KafkaSessionTimeout),
		//kgo.HeartbeatInterval(internal.KafkaHeartbeatInterval),

		// Disable auto commit - we handle commits manually
		kgo.DisableAutoCommit(),

		// Fetch configuration
		//kgo.FetchMinBytes(internal.KafkaMinFetchBytes),
		//kgo.FetchMaxBytes(internal.KafkaMaxFetchBytes),
		//kgo.FetchMaxWait(internal.KafkaMaxWait),
	}

	// Set initial offset
	if topic.ConsumerGroupInitialOffset == internal.InitialOffsetEarliest {
		opts = append(opts, kgo.ConsumeResetOffset(kgo.NewOffset().AtStart()))
	} else {
		opts = append(opts, kgo.ConsumeResetOffset(kgo.NewOffset().AtEnd()))
	}

	// Configure security
	authOpts, err := configureAuth(conn)
	if err != nil {
		return nil, fmt.Errorf("configure auth: %w", err)
	}

	opts = append(opts, authOpts...)

	return opts, nil
}

func configureAuth(conn models.KafkaConnectionParamsConfig) ([]kgo.Opt, error) {
	var opts []kgo.Opt
	var auth sasl.Mechanism

	switch conn.SASLMechanism {
	case internal.MechanismSHA256:
		auth = scram.Auth{
			User: conn.SASLUsername,
			Pass: conn.SASLPassword,
		}.AsSha256Mechanism()
	case internal.MechanismSHA512:
		auth = scram.Auth{
			User: conn.SASLUsername,
			Pass: conn.SASLPassword,
		}.AsSha512Mechanism()
	case internal.MechanismKerberos:
		krbAuth := kerberos.Auth{
			Service: conn.KerberosServiceName,
		}
		krb5ConfigFilePath, err := createTempKerberosConfigFile(conn.KerberosConfig)
		if err != nil {
			return nil, fmt.Errorf("create temp krb5 config file: %w", err)
		}
		krbConfig, err := krb5config.Load(krb5ConfigFilePath)
		if err != nil {
			return nil, fmt.Errorf("load krb5 config: %w", err)
		}

		if conn.KerberosKeytab != "" {
			keytabFile, err := createTempKeytabFile(conn.KerberosKeytab)
			if err != nil {
				return nil, fmt.Errorf("create temp keytab file: %w", err)
			}

			keytab, err := krb5keytab.Load(keytabFile)
			if err != nil {
				return nil, fmt.Errorf("load keytab: %w", err)
			}

			krbAuth.Client = krb5client.NewWithKeytab(conn.SASLUsername, conn.KerberosRealm, keytab, krbConfig)
		} else {
			krbAuth.Client = krb5client.NewWithPassword(conn.SASLUsername, conn.KerberosRealm, conn.SASLPassword, krbConfig)
		}

		auth = krbAuth.AsMechanism()
	case internal.MechanismPlain:
		auth = plain.Auth{
			User: conn.SASLUsername,
			Pass: conn.SASLPassword,
		}.AsMechanism()
	case internal.MechanismNoAuth:
		auth = nil
	default:
		return nil, fmt.Errorf("unsupported SASL mechanism: %s", conn.SASLMechanism)
	}

	if auth != nil {
		opts = append(opts, kgo.SASL(auth))
	}

	if conn.SASLProtocol == internal.SASLProtocolSASLSSL || conn.SASLProtocol == internal.SASLProtocolSSL {
		tlsCfg, err := MakeTLSConfigFromStrings(conn.TLSCert, conn.TLSKey, conn.TLSRoot)
		if err != nil {
			return nil, fmt.Errorf("make tls config: %w", err)
		}

		if conn.SkipTLSVerification {
			tlsCfg.InsecureSkipVerify = true
		}

		opts = append(opts, kgo.DialTLSConfig(tlsCfg))
	}

	return opts, nil
}

func (c *Consumer) Start(ctx context.Context, processor MessageProcessor) error {
	ctx, c.cancel = context.WithCancel(ctx)
	c.processor = processor

	c.log.Info("Starting Kafka consumer",
		slog.String("topic", c.topic),
		slog.String("group", c.groupID))

	return c.consumeLoop(ctx)
}

func (c *Consumer) consumeLoop(ctx context.Context) error {
	c.log.Debug("Consuming messages in batch mode",
		slog.String("topic", c.topic),
		slog.String("group", c.groupID),
		slog.Int("batchSize", c.batchSize),
		slog.Duration("batchMaxWait", c.batchMaxWait))

	defer close(c.closeCh)

	flushTimer := time.NewTimer(c.batchMaxWait)
	defer flushTimer.Stop()

	for {
		select {
		case <-ctx.Done():
			// Process remaining batch before shutdown with a fresh context
			if len(c.batch) > 0 {
				c.log.Info("Processing remaining batch before shutdown", slog.Int("batchSize", len(c.batch)))
				shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), internal.DefaultComponentShutdownTimeout)
				if err := c.processBatch(shutdownCtx); err != nil {
					c.log.Error("Failed to process remaining batch on shutdown", slog.Any("error", err))
				}
				shutdownCancel()
			}
			return nil

		case <-flushTimer.C:
			// Time-based flush
			if len(c.batch) > 0 {
				c.log.Info("Time-based flush triggered", slog.Int("batchSize", len(c.batch)))
				if err := c.processBatch(ctx); err != nil {
					c.log.Error("Failed to process batch, clearing batch for redelivery", slog.Any("error", err), slog.Int("droppedMessages", len(c.batch)))
					c.batch = c.batch[:0] // Clear batch; Kafka will redeliver since offsets weren't committed
				}
			}
			flushTimer.Reset(c.batchMaxWait)

		default:
			// Continuous polling with short timeout
			c.pollAndAccumulate(ctx, flushTimer)
		}
	}
}

func (c *Consumer) pollAndAccumulate(ctx context.Context, flushTimer *time.Timer) {
	// Poll with short timeout for responsiveness
	pollCtx, cancel := context.WithTimeout(ctx, internal.KafkaPollTimeout)
	defer cancel()

	// Request only enough records to fill the batch
	remainingCapacity := c.batchSize - len(c.batch)
	fetches := c.client.PollRecords(pollCtx, remainingCapacity)

	// Handle errors (ignore timeout errors)
	if errs := fetches.Errors(); len(errs) > 0 {
		for _, err := range errs {
			if errors.Is(err.Err, context.Canceled) {
				return
			} else if !errors.Is(err.Err, context.DeadlineExceeded) {
				c.log.Error("Error fetching messages", slog.Any("error", err))
			}
		}
	}

	// Accumulate records
	fetches.EachRecord(func(record *kgo.Record) {
		c.batch = append(c.batch, record)
	})

	// Size-based flush
	if len(c.batch) >= c.batchSize {
		c.log.Info("Size-based flush triggered", slog.Int("batchSize", len(c.batch)))
		if err := c.processBatch(ctx); err != nil {
			c.log.Error("Failed to process batch, clearing batch for redelivery", slog.Any("error", err), slog.Int("droppedMessages", len(c.batch)))
			c.batch = c.batch[:0] // Clear batch; Kafka will redeliver since offsets weren't committed
		}
		// Reset timer after processing (success or failure)
		if !flushTimer.Stop() {
			select {
			case <-flushTimer.C:
			default:
			}
		}
		flushTimer.Reset(c.batchMaxWait)
	}
}

func (c *Consumer) processBatch(ctx context.Context) error {
	size := len(c.batch)
	if size == 0 {
		return nil
	}

	c.log.Info("Processing batch of messages", slog.Int("batchSize", size))
	start := time.Now()

	// Retry batch processing
	err := retry.Do(
		func() error {
			return c.processor.ProcessBatch(ctx, c.batch)
		},
		retry.Attempts(internal.KafkaBatchRetryAttempts),
		retry.Delay(internal.KafkaBatchRetryDelay),
		retry.DelayType(retry.FixedDelay),
		retry.Context(ctx),
		retry.OnRetry(func(n uint, err error) {
			c.log.Warn("Retrying batch processing",
				slog.Uint64("attempt", uint64(n+1)),
				slog.Any("error", err),
				slog.Int("batchSize", size))
		}),
	)
	if err != nil {
		c.log.Error("Batch processing failed after retries", slog.Any("error", err), slog.Int("batchSize", size))
		return fmt.Errorf("batch processing failed: %w", err)
	}

	// Retry commit
	err = retry.Do(
		func() error {
			return c.commitBatch(ctx)
		},
		retry.Attempts(internal.KafkaCommitRetryAttempts),
		retry.Delay(internal.KafkaCommitRetryDelay),
		retry.DelayType(retry.FixedDelay),
		retry.Context(ctx),
		retry.OnRetry(func(n uint, err error) {
			c.log.Warn("Retrying commit",
				slog.Uint64("attempt", uint64(n+1)),
				slog.Any("error", err))
		}),
	)
	if err != nil {
		return fmt.Errorf("batch processing failed on commit offsets: %w", err)
	}

	c.log.Info("Batch processed successfully", slog.Int("batchSize", size), slog.Duration("duration", time.Duration(time.Since(start).Milliseconds())))

	c.batch = c.batch[:0]

	// Record Kafka read metric
	if c.meter != nil {
		c.meter.RecordKafkaRead(ctx, int64(size))
		duration := time.Since(start).Seconds()
		c.meter.RecordProcessingDuration(ctx, duration/float64(size))
	}

	return nil
}

func (c *Consumer) commitBatch(ctx context.Context) error {
	if err := c.client.CommitUncommittedOffsets(ctx); err != nil {
		c.log.Error("Failed to commit offsets", slog.Any("error", err))
		return fmt.Errorf("failed to commit offsets: %w", err)
	}
	return nil
}

func (c *Consumer) Close() error {
	c.log.Info("Closing Kafka consumer", slog.String("group", c.groupID))

	if c.cancel != nil {
		c.cancel()
	}

	<-c.closeCh

	c.client.Close()

	return nil
}
