package client

import (
	"context"
	"crypto/tls"
	"encoding/base64"
	"fmt"
	"time"

	"github.com/ClickHouse/clickhouse-go/v2"
	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

type DatabaseClient interface {
	Reconnect(ctx context.Context) error
	PrepareBatch(ctx context.Context, query string) (driver.Batch, error)
	GetDatabase() string
	GetTableName() string
	Close() error
}

type ClickHouseClient struct {
	conn      driver.Conn
	host      string
	port      string
	username  string
	password  string
	database  string
	tableName string
	secure    bool
}

func NewClickHouseClient(ctx context.Context, cfg models.ClickHouseConnectionParamsConfig) (*ClickHouseClient, error) {
	client := &ClickHouseClient{ //nolint:exhaustruct // optional config
		host:      cfg.Host,
		port:      cfg.Port,
		username:  cfg.Username,
		password:  cfg.Password,
		database:  cfg.Database,
		tableName: cfg.Table,
		secure:    cfg.Secure,
	}
	err := client.connect(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to ClickHouse: %w", err)
	}

	return client, nil
}

func (c *ClickHouseClient) Close() error {
	if c.conn != nil {
		err := c.conn.Close()
		if err != nil {
			return fmt.Errorf("failed to close ClickHouse connection: %w", err)
		}
	}
	c.conn = nil
	return nil
}

func (c *ClickHouseClient) connect(ctx context.Context) error {
	err := c.Close()
	if err != nil {
		return fmt.Errorf("failed to close existing connection: %w", err)
	}

	pswd, err := base64.StdEncoding.DecodeString(c.password)
	if err != nil {
		return fmt.Errorf("failed to decode password: %w", err)
	}

	var tlsConfig *tls.Config
	if c.secure {
		tlsConfig = &tls.Config{ //nolint:exhaustruct //optionals
			MinVersion: tls.VersionTLS12,
		}
	}

	chConn, err := clickhouse.Open(&clickhouse.Options{ //nolint:exhaustruct //optionals
		Addr:     []string{c.host + ":" + c.port},
		Protocol: clickhouse.Native,
		TLS:      tlsConfig,
		Auth: clickhouse.Auth{ //nolint:exhaustruct //optionals
			Username: c.username,
			Password: string(pswd),
		},
	})
	if err != nil {
		return fmt.Errorf("failed to open clickhouse connection: %w", err)
	}

	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	err = chConn.Ping(ctx)
	if err != nil {
		return fmt.Errorf("ping failed: %w", err)
	}

	c.conn = chConn
	return nil
}

func (c *ClickHouseClient) Reconnect(ctx context.Context) error {
	err := c.connect(ctx)
	if err != nil {
		return fmt.Errorf("failed to reconnect to ClickHouse: %w", err)
	}

	return nil
}

func (c *ClickHouseClient) PrepareBatch(ctx context.Context, query string) (driver.Batch, error) {
	if c.conn == nil {
		return nil, fmt.Errorf("clickhouse client is not connected")
	}

	batch, err := c.conn.PrepareBatch(ctx, query, driver.WithReleaseConnection())
	if err != nil {
		return nil, fmt.Errorf("failed to prepare batch: %w", err)
	}

	return batch, nil
}

func (c *ClickHouseClient) GetDatabase() string {
	return c.database
}

func (c *ClickHouseClient) GetTableName() string {
	return c.tableName
}
