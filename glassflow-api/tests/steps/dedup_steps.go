package steps

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/dgraph-io/badger/v4"
	"github.com/nats-io/nats-server/v2/server"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/client"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/tests/testutils"
)

type DedupTestSuite struct {
	BaseTestSuite

	natsServer *server.Server
	badgerDB   *badger.DB
}

func NewDedupTestSuite() *DedupTestSuite {
	return &DedupTestSuite{
		BaseTestSuite: BaseTestSuite{
			wg: sync.WaitGroup{},
		},
	}
}

// runNATSServerWithTimeout starts a NATS server in a goroutine and waits for it to be ready.
// Uses a configurable timeout (longer than the default 10s in nats-server/test) for slow or busy environments.
func runNATSServerWithTimeout(opts *server.Options, timeout time.Duration) *server.Server {
	if opts == nil {
		opts = &server.Options{
			Host:   "127.0.0.1",
			Port:   -1,
			NoLog:  true,
			NoSigs: true,
		}
	}
	s, err := server.NewServer(opts)
	if err != nil || s == nil {
		panic(fmt.Sprintf("NewServer: %v", err))
	}
	go s.Start()
	if !s.ReadyForConnections(timeout) {
		panic("NATS server did not become ready within " + timeout.String())
	}
	return s
}

func (s *DedupTestSuite) SetupResources() error {
	opts := &server.Options{
		Host:      "127.0.0.1",
		Port:      -1,
		NoLog:     true,
		NoSigs:    true,
		JetStream: true,
	}
	s.natsServer = runNATSServerWithTimeout(opts, 30*time.Second)

	natsClient, err := client.NewNATSClient(context.Background(), s.natsServer.ClientURL())
	if err != nil {
		return fmt.Errorf("create nats client: %w", err)
	}
	s.natsClient = natsClient

	if err := s.setupBadgerDB(); err != nil {
		return fmt.Errorf("setup badger db: %w", err)
	}

	return nil
}

func (s *DedupTestSuite) setupBadgerDB() error {
	if s.badgerDB != nil {
		return nil
	}

	// Open in-memory Badger database
	opts := badger.DefaultOptions("").
		WithInMemory(true).
		WithLogger(nil).
		WithLoggingLevel(badger.ERROR)

	db, err := badger.Open(opts)
	if err != nil {
		return fmt.Errorf("open badger db: %w", err)
	}

	s.badgerDB = db

	return nil
}

func (s *DedupTestSuite) cleanBadgerDB() error {
	if s.badgerDB != nil {
		if err := s.badgerDB.Close(); err != nil {
			return fmt.Errorf("close badger db: %w", err)
		}
		s.badgerDB = nil
	}

	return nil
}

func (s *DedupTestSuite) CleanupResources() error {
	var errs []error

	// Clean up Badger DB
	if err := s.cleanBadgerDB(); err != nil {
		errs = append(errs, err)
	}

	// Close NATS client
	if s.natsClient != nil {
		if err := s.natsClient.Close(); err != nil {
			errs = append(errs, fmt.Errorf("close nats client: %w", err))
		}
		s.natsClient = nil
	}

	// Shutdown NATS server
	if s.natsServer != nil {
		s.natsServer.Shutdown()
		s.natsServer = nil
	}

	err := testutils.CombineErrors(errs)
	if err != nil {
		return fmt.Errorf("cleanup errors: %w", err)
	}

	return nil
}

// GetNATSClient exposes NATS client for tests
func (s *DedupTestSuite) GetNATSClient() *client.NATSClient {
	return s.natsClient
}

// GetBadgerDB exposes Badger DB for tests
func (s *DedupTestSuite) GetBadgerDB() *badger.DB {
	return s.badgerDB
}
