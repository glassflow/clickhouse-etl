package sink

import (
	"context"
	"crypto/tls"
	"encoding/base64"
	"errors"
	"fmt"
	"log/slog"
	"strings"

	"github.com/glassflow/clickhouse-etl-internal/internal/core/schema"
	"github.com/glassflow/clickhouse-etl-internal/internal/core/stream"

	"github.com/ClickHouse/clickhouse-go/v2"
	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
	"github.com/nats-io/nats.go"
)

type SinkConnectorConfig struct {
	Host      string `json:"host" default:"127.0.0.1"`
	Port      string `json:"port" default:"9000"`
	Username  string `json:"username" default:"default"`
	Secure    bool   `json:"tls_enabled" default:"false"`
	Password  string `json:"password"`
	Database  string `json:"database" default:"default"`
	TableName string `json:"table"`
}

type BatchConfig struct {
	MaxBatchSize int `json:"max_batch_size" default:"10000"`
}

type Batch struct {
	conn          driver.Conn
	query         string
	currentBatch  driver.Batch
	sizeThreshold int
	cache         map[uint64]struct{}
}

func NewBatch(ctx context.Context, conn driver.Conn, query string, cfg BatchConfig) (*Batch, error) {
	b := &Batch{
		conn:          conn,
		query:         query,
		sizeThreshold: cfg.MaxBatchSize,
		cache:         make(map[uint64]struct{}),
	}

	err := b.Reload()
	if err != nil {
		return nil, fmt.Errorf("failed to reload batch: %w", err)
	}

	return b, nil
}

func (b *Batch) Reload() error {
	batch, err := b.conn.PrepareBatch(context.Background(), b.query)
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
		return nil
	} else {
		b.cache[id] = struct{}{}
	}
	err := b.currentBatch.Append(data...)
	if err != nil {
		return fmt.Errorf("append failed: %w", err)
	}

	return nil
}

func (b *Batch) Flush() error {
	err := b.currentBatch.Flush()
	if err != nil {
		return fmt.Errorf("failed to flush the batch: %w", err)
	}

	err = b.Reload()
	if err != nil {
		return fmt.Errorf("failed to reload the batch: %w", err)
	}

	clear(b.cache)

	return nil
}

func (b *Batch) Send() error {
	err := b.currentBatch.Send()
	if err != nil {
		return fmt.Errorf("failed to send the batch: %w", err)
	}

	err = b.Reload()
	if err != nil {
		return fmt.Errorf("failed to reload the batch: %w", err)
	}
	clear(b.cache)

	return nil
}

func ClickHouseSinkImporter(ctx context.Context, chConfig SinkConnectorConfig, batchConfig BatchConfig, streamCon *stream.Consumer, schemaMapper *schema.SchemaMapper, log *slog.Logger) error {
	log.Info("ClickHouse exporter is in progress...")
	pswd, err := base64.StdEncoding.DecodeString(chConfig.Password)
	if err != nil {
		return fmt.Errorf("failed to decode password: %w", err)
	}

	var tlsConfig *tls.Config
	if chConfig.Secure {
		tlsConfig = &tls.Config{}
	}

	chConn, err := clickhouse.Open(&clickhouse.Options{
		Addr:     []string{chConfig.Host + ":" + chConfig.Port},
		Protocol: clickhouse.Native,
		TLS:      tlsConfig,
		Auth: clickhouse.Auth{
			Username: chConfig.Username,
			Password: string(pswd),
		},
		MaxOpenConns: 1,
		MaxIdleConns: 1,
	})
	if err != nil {
		return fmt.Errorf("failed to open clickhouse connection: %w", err)
	}

	defer chConn.Close()

	if err = chConn.Ping(ctx); err != nil {
		if ex, ok := err.(*clickhouse.Exception); ok {
			return fmt.Errorf("ping failed: exception [%d] %s \n%s\n",
				ex.Code, ex.Message, ex.StackTrace)
		} else {
			return fmt.Errorf("ping failed: %w", err)
		}
	}

	query := fmt.Sprintf("INSERT INTO %s.%s (%s)", chConfig.Database, chConfig.TableName, strings.Join(schemaMapper.GetOrderedColumns(), ", "))
	batch, err := NewBatch(ctx, chConn, query, batchConfig)
	if err != nil {
		return fmt.Errorf("failed to create batch: %w", err)
	}

	for {
		select {
		case <-ctx.Done():
			log.Debug("Received stop event")
			return nil
		default:
			err = func() error {
				msg, err := streamCon.Next()
				switch {
				case errors.Is(err, nats.ErrTimeout):
					return nil
				case err != nil:
					return fmt.Errorf("failed to get next message: %w", err)
				}

				mdata, err := msg.Metadata()
				if err != nil {
					return fmt.Errorf("failed to get message metadata: %w", err)

				}

				values, err := schemaMapper.PrepareClickHouseValues(msg.Data())
				if err != nil {
					return fmt.Errorf("failed to map data for ClickHouse: %w", err)
				}
				err = batch.Append(mdata.Sequence.Stream, values...)
				if err != nil {
					return fmt.Errorf("failed to append values to the batch: %w", err)
				}

				if batch.Size() >= batch.sizeThreshold {
					err := batch.Send()
					if err != nil {
						return fmt.Errorf("failed to flush batch: %w", err)
					}
					log.Debug("Batch sent")

					err = msg.Ack()
					if err != nil {
						return fmt.Errorf("failed to perform callback: %w", err)
					}
					log.Debug("Message acked", slog.Any("stream", mdata.Sequence.Stream))
				}

				return nil
			}()
			if err != nil {
				return fmt.Errorf("error on exporting data: %w", err)
			}
		}
	}

}
