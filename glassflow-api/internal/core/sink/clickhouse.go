package sink

import (
	"context"
	"crypto/tls"
	"encoding/base64"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"sync"
	"time"

	"github.com/ClickHouse/clickhouse-go/v2"
	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
	"github.com/nats-io/nats.go"
	"github.com/nats-io/nats.go/jetstream"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/schema"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/stream"
)

var ErrAlreadyExists = errors.New("already exists")

type ConnectorConfig struct {
	Host      string `json:"host" default:"127.0.0.1"`
	Port      string `json:"port" default:"9000"`
	Username  string `json:"username" default:"default"`
	Secure    bool   `json:"tls_enabled" default:"false"`
	Password  string `json:"password"`
	Database  string `json:"database" default:"default"`
	TableName string `json:"table"`
}

type BatchConfig struct {
	MaxBatchSize int           `json:"max_batch_size" default:"10000"`
	MaxDelayTime time.Duration `json:"max_delay_time" default:"60s"`
}

type Batch struct {
	conn          driver.Conn
	query         string
	currentBatch  driver.Batch
	sizeThreshold int
	cache         map[uint64]struct{}
	maxDelayTime  time.Duration
}

func NewBatch(ctx context.Context, conn driver.Conn, query string, cfg BatchConfig) (*Batch, error) {
	maxDelayTime := time.Duration(60) * time.Second
	if cfg.MaxDelayTime > 0 {
		maxDelayTime = cfg.MaxDelayTime
	}
	b := &Batch{
		conn:          conn,
		query:         query,
		currentBatch:  nil,
		sizeThreshold: cfg.MaxBatchSize,
		cache:         make(map[uint64]struct{}),
		maxDelayTime:  maxDelayTime,
	}

	err := b.Reload(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to reload batch: %w", err)
	}

	return b, nil
}

func (b *Batch) Reload(ctx context.Context) error {
	batch, err := b.conn.PrepareBatch(ctx, b.query)
	if err != nil {
		return fmt.Errorf("failed to create batch: %w", err)
	}

	b.currentBatch = batch

	return nil
}

func (b *Batch) Size() int {
	return len(b.cache)
}

func (b *Batch) Append(id uint64, data ...any) error {
	if _, ok := b.cache[id]; ok {
		return ErrAlreadyExists //nolint:wrapcheck //custom error usage
	}

	b.cache[id] = struct{}{}

	err := b.currentBatch.Append(data...)
	if err != nil {
		return fmt.Errorf("append failed: %w", err)
	}

	return nil
}

func (b *Batch) Send(ctx context.Context) error {
	err := b.currentBatch.Send()
	if err != nil {
		return fmt.Errorf("failed to send the batch: %w", err)
	}

	err = b.Reload(ctx)
	if err != nil {
		return fmt.Errorf("failed to reload the batch: %w", err)
	}
	clear(b.cache)

	return nil
}

type ClickHouseSink struct {
	conn         driver.Conn
	batch        *Batch
	streamCon    *stream.Consumer
	schemaMapper schema.Mapper
	isClosed     bool
	mu           sync.Mutex
	done         chan struct{}
	timer        *time.Timer
	lastMsg      jetstream.Msg
	log          *slog.Logger
}

func NewClickHouseSink(ctx context.Context, chConfig ConnectorConfig, batchConfig BatchConfig, streamCon *stream.Consumer, schemaMapper *schema.Mapper, log *slog.Logger) (*ClickHouseSink, error) {
	pswd, err := base64.StdEncoding.DecodeString(chConfig.Password)
	if err != nil {
		return nil, fmt.Errorf("failed to decode password: %w", err)
	}

	var tlsConfig *tls.Config
	if chConfig.Secure {
		tlsConfig = &tls.Config{ //nolint:exhaustruct //optionals
			MinVersion: tls.VersionTLS12,
		}
	}

	chConn, err := clickhouse.Open(&clickhouse.Options{ //nolint:exhaustruct //optionals
		Addr:     []string{chConfig.Host + ":" + chConfig.Port},
		Protocol: clickhouse.Native,
		TLS:      tlsConfig,
		Auth: clickhouse.Auth{ //nolint:exhaustruct //optionals
			Username: chConfig.Username,
			Password: string(pswd),
		},
		MaxOpenConns: 1,
		MaxIdleConns: 1,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to open clickhouse connection: %w", err)
	}

	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	err = chConn.Ping(ctx)
	if err != nil {
		return nil, fmt.Errorf("ping failed: %w", err)
	}

	query := fmt.Sprintf("INSERT INTO %s.%s (%s)", chConfig.Database, chConfig.TableName, strings.Join(schemaMapper.GetOrderedColumns(), ", "))

	//nolint: contextcheck // requires uninherited ctx for long lasting batches
	batch, err := NewBatch(context.Background(), chConn, query, batchConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create batch with query %s: %w", query, err)
	}

	return &ClickHouseSink{
		conn:         chConn,
		batch:        batch,
		streamCon:    streamCon,
		schemaMapper: *schemaMapper,
		isClosed:     false,
		mu:           sync.Mutex{},
		done:         make(chan struct{}),
		timer:        time.NewTimer(batchConfig.MaxDelayTime),
		lastMsg:      nil,
		log:          log,
	}, nil
}

func (ch *ClickHouseSink) sendBatchAndAck(ctx context.Context) error {
	err := ch.batch.Send(ctx)
	if err != nil {
		return fmt.Errorf("failed to send the batch: %w", err)
	}
	ch.log.Debug("Batch sent")

	err = ch.lastMsg.Ack()
	if err != nil {
		return fmt.Errorf("failed to ack message: %w", err)
	}

	mdata, err := ch.lastMsg.Metadata()
	if err != nil {
		ch.log.Error("failed to get message metadata", slog.Any("error", err))
	} else {
		ch.log.Debug("Message acked", slog.Any("stream", mdata.Sequence.Stream))
	}

	ch.lastMsg = nil

	return nil
}

func (ch *ClickHouseSink) handleMsg(ctx context.Context, msg jetstream.Msg) error {
	mdata, err := msg.Metadata()
	if err != nil {
		return fmt.Errorf("failed to get message metadata: %w", err)
	}

	values, err := ch.schemaMapper.PrepareClickHouseValues(msg.Data())
	if err != nil {
		return fmt.Errorf("failed to map data for ClickHouse: %w", err)
	}

	err = ch.batch.Append(mdata.Sequence.Stream, values...)
	if err != nil {
		return fmt.Errorf("failed to append values to the batch: %w", err)
	}

	ch.lastMsg = msg

	if ch.batch.Size() >= ch.batch.sizeThreshold {
		err := ch.sendBatchAndAck(ctx)
		if err != nil {
			return fmt.Errorf("failed to send the batch and ack: %w", err)
		}
	}

	return nil
}

func (ch *ClickHouseSink) Start(ctx context.Context, errChan chan<- error) { //nolint: gocognit //requires for long lasting batches logic
	ch.log.Info("ClickHouse sink started")
	defer ch.conn.Close()
	defer ch.log.Info("ClickHouse sink stopped")

	ch.log.Debug("ClickHouse batch insert query", slog.Any("query", ch.batch.query))

	if !ch.timer.Stop() {
		<-ch.timer.C
	}

	for {
		select {
		case <-ch.done:
			ch.log.Debug("Stopping ClickHouse sink ...")
			return
		case <-ch.timer.C:
			if ch.batch.Size() > 0 && ch.lastMsg != nil {
				err := ch.sendBatchAndAck(ctx)
				if err != nil {
					errChan <- fmt.Errorf("error on exporting data: %w", err)
					ch.log.Error("error on exporting data", slog.Any("error", err))
					return
				}
			}
			ch.timer.Reset(ch.batch.maxDelayTime)
		default:
			err := func(ctx context.Context) error {
				msg, err := ch.streamCon.Next()
				switch {
				case errors.Is(err, nats.ErrTimeout):
					return nil
				case err != nil:
					return fmt.Errorf("failed to get next message: %w", err)
				}

				err = ch.handleMsg(ctx, msg)
				if err != nil {
					if errors.Is(err, ErrAlreadyExists) {
						return nil
					}
					return fmt.Errorf("failed to handle message: %w", err)
				}

				if !ch.timer.Stop() {
					select {
					case <-ch.timer.C:
					default:
					}
				}

				ch.timer.Reset(ch.batch.maxDelayTime)

				return nil
			}(ctx)
			if err != nil {
				errChan <- fmt.Errorf("error on exporting data: %w", err)
				ch.log.Error("error on exporting data", slog.Any("error", err))
				return
			}
		}
	}
}

func (ch *ClickHouseSink) Stop() {
	ch.mu.Lock()
	defer ch.mu.Unlock()
	if ch.isClosed {
		ch.log.Debug("ClickHouse sink is already stopped.")
		return
	}

	if ch.timer != nil {
		ch.timer.Stop()
	}

	close(ch.done)
	ch.isClosed = true
	ch.log.Debug("ClickHouse connection closed")
}
