package client

import (
	"context"
	"crypto/tls"
	"encoding/base64"
	"fmt"
	"net"
	"strings"
	"time"

	"github.com/ClickHouse/ch-go"
	"github.com/ClickHouse/ch-go/chpool"
	"github.com/ClickHouse/ch-go/proto"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

// ChGoClient is a high-performance ClickHouse client using ch-go with connection pooling.
// It provides columnar data insertion capabilities for better throughput.
type ChGoClient struct {
	pool                 *chpool.Pool
	database             string
	tableName            string
	host                 string
	port                 string
	username             string
	password             string
	secure               bool
	skipCertificateCheck bool
}

// NewChGoClient creates a new ch-go based ClickHouse client with connection pooling.
func NewChGoClient(
	ctx context.Context,
	cfg models.ClickHouseConnectionParamsConfig,
) (*ChGoClient, error) {
	client := &ChGoClient{
		host:                 cfg.Host,
		port:                 cfg.Port,
		database:             cfg.Database,
		tableName:            cfg.Table,
		username:             cfg.Username,
		password:             cfg.Password,
		secure:               cfg.Secure,
		skipCertificateCheck: cfg.SkipCertificateCheck,
	}

	if err := client.connect(ctx); err != nil {
		return nil, fmt.Errorf("failed to connect to ClickHouse: %w", err)
	}

	return client, nil
}

func (c *ChGoClient) connect(ctx context.Context) error {
	pswd, err := base64.StdEncoding.DecodeString(c.password)
	if err != nil {
		return fmt.Errorf("failed to decode password: %w", err)
	}

	addr := net.JoinHostPort(c.host, c.port)

	opts := chpool.Options{
		ClientOptions: ch.Options{
			Address:  addr,
			Database: c.database,
			User:     c.username,
			Password: string(pswd),
		},
	}

	if c.secure {
		tlsConfig := &tls.Config{ //nolint:exhaustruct // optional fields
			MinVersion: tls.VersionTLS12,
		}
		if c.skipCertificateCheck {
			tlsConfig.InsecureSkipVerify = true
		}
		opts.ClientOptions.TLS = tlsConfig
	}

	pool, err := chpool.Dial(ctx, opts)
	if err != nil {
		return fmt.Errorf("failed to create connection pool: %w", err)
	}

	// Verify connection with a ping
	pingCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	if err := pool.Ping(pingCtx); err != nil {
		pool.Close()
		return fmt.Errorf("ping failed: %w", err)
	}

	c.pool = pool
	return nil
}

// Close closes the connection pool.
func (c *ChGoClient) Close() error {
	if c.pool != nil {
		c.pool.Close()
		c.pool = nil
	}
	return nil
}

// Reconnect re-establishes the connection pool.
func (c *ChGoClient) Reconnect(ctx context.Context) error {
	if err := c.Close(); err != nil {
		return fmt.Errorf("failed to close existing connection: %w", err)
	}

	if err := c.connect(ctx); err != nil {
		return fmt.Errorf("failed to reconnect: %w", err)
	}

	return nil
}

// GetDatabase returns the database name.
func (c *ChGoClient) GetDatabase() string {
	return c.database
}

// GetTableName returns the table name.
func (c *ChGoClient) GetTableName() string {
	return c.tableName
}

// Insert executes a columnar insert using proto.Input.
// Since the database is already configured in the client options, we only pass the table name.
func (c *ChGoClient) Insert(ctx context.Context, input proto.Input) error {
	if c.pool == nil {
		return fmt.Errorf("ch-go client is not connected")
	}

	// Only pass the table name since the database is already set in client options
	// If tableName includes a database prefix (e.g., "db.table"), strip it and use only the table part
	tableName := c.tableName
	if strings.Contains(tableName, ".") {
		parts := strings.SplitN(tableName, ".", 2)
		if len(parts) == 2 {
			tableName = parts[1]
		}
	}

	return c.pool.Do(ctx, ch.Query{
		Body:  input.Into(tableName),
		Input: input,
	})
}

// InsertWithQuery executes a columnar insert with a custom table identifier.
// The query parameter should be just the table identifier (database.table), not a full INSERT statement.
func (c *ChGoClient) InsertWithQuery(ctx context.Context, tableIdentifier string, input proto.Input) error {
	if c.pool == nil {
		return fmt.Errorf("ch-go client is not connected")
	}

	return c.pool.Do(ctx, ch.Query{
		Body:  input.Into(tableIdentifier),
		Input: input,
	})
}

// Ping verifies the connection is alive.
func (c *ChGoClient) Ping(ctx context.Context) error {
	if c.pool == nil {
		return fmt.Errorf("ch-go client is not connected")
	}
	return c.pool.Ping(ctx)
}

// Pool returns the underlying connection pool for advanced usage.
func (c *ChGoClient) Pool() *chpool.Pool {
	return c.pool
}

// TableColumn represents a column in a ClickHouse table.
type TableColumn struct {
	Name string
	Type string
}

// GetTableSchema queries ClickHouse for the table schema and returns column names and types.
func (c *ChGoClient) GetTableSchema(ctx context.Context) ([]TableColumn, error) {
	if c.pool == nil {
		return nil, fmt.Errorf("ch-go client is not connected")
	}

	// Parse database and table from tableName
	database := c.database
	tableName := c.tableName
	if strings.Contains(tableName, ".") {
		parts := strings.SplitN(tableName, ".", 2)
		if len(parts) == 2 {
			database = parts[0]
			tableName = parts[1]
		}
	}

	// Query system.columns for table schema
	var nameCol proto.ColStr
	var typeCol proto.ColStr

	query := fmt.Sprintf(
		"SELECT name, type FROM system.columns WHERE database = '%s' AND table = '%s' ORDER BY position",
		database, tableName,
	)

	err := c.pool.Do(ctx, ch.Query{
		Body: query,
		Result: proto.Results{
			{Name: "name", Data: &nameCol},
			{Name: "type", Data: &typeCol},
		},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to query table schema: %w", err)
	}

	columns := make([]TableColumn, nameCol.Rows())
	for i := 0; i < nameCol.Rows(); i++ {
		columns[i] = TableColumn{
			Name: nameCol.Row(i),
			Type: typeCol.Row(i),
		}
	}

	return columns, nil
}
