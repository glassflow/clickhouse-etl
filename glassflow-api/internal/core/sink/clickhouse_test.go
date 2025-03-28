package sink

import (
	"context"
	"errors"
	"testing"

	"github.com/ClickHouse/clickhouse-go/v2/lib/column"
	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

// Mock for driver.Batch
type MockBatch struct {
	mock.Mock
}

func (m *MockBatch) Abort() error {
	return nil
}

func (m *MockBatch) Append(v ...any) error {
	args := m.Called(v)
	return args.Error(0)
}

func (m *MockBatch) AppendStruct(v any) error {
	args := m.Called(v)
	return args.Error(0)
}

func (m *MockBatch) Column(int) driver.BatchColumn {
	return nil
}

func (m *MockBatch) Flush() error {
	args := m.Called()
	return args.Error(0)
}

func (m *MockBatch) Send() error {
	return nil
}

func (m *MockBatch) IsSent() bool {
	return false
}

func (m *MockBatch) Rows() int {
	return 0
}

func (m *MockBatch) Columns() []column.Interface {
	return nil
}

// Mock for driver.Conn
type MockConn struct {
	mock.Mock
}

func (m *MockConn) PrepareBatch(ctx context.Context, query string, opts ...driver.PrepareBatchOption) (driver.Batch, error) {
	args := m.Called(ctx, query)
	return args.Get(0).(driver.Batch), args.Error(1)
}

func (m *MockConn) Close() error {
	args := m.Called()
	return args.Error(0)
}

func (m *MockConn) Ping(ctx context.Context) error {
	args := m.Called(ctx)
	return args.Error(0)
}

func (m *MockConn) AsyncInsert(ctx context.Context, query string, wait bool, data ...any) error {
	args := m.Called(ctx, query, data)
	return args.Error(0)
}

func (m *MockConn) Contributors() []string {
	args := m.Called()
	return args.Get(0).([]string)
}

func (m *MockConn) Exec(ctx context.Context, query string, args ...any) error {
	// This method is not used in the Batch struct
	return nil
}

func (m *MockConn) Query(ctx context.Context, query string, args ...any) (driver.Rows, error) {
	// Implementation for the mock
	callArgs := m.Called(ctx, query, args)
	if ret := callArgs.Get(0); ret != nil {
		return ret.(driver.Rows), callArgs.Error(1)
	}
	return nil, callArgs.Error(1)
}

func (m *MockConn) QueryRow(ctx context.Context, query string, args ...any) driver.Row {
	// Implementation for the mock
	callArgs := m.Called(ctx, query, args)
	if ret := callArgs.Get(0); ret != nil {
		return ret.(driver.Row)
	}
	return nil
}

func (m *MockConn) Select(ctx context.Context, dest any, query string, args ...any) error {
	// Implementation for the mock
	callArgs := m.Called(ctx, query, args)
	return callArgs.Error(0)
}

func (m *MockConn) ServerVersion() (*driver.ServerVersion, error) {
	return nil, nil
}

func (m *MockConn) Stats() driver.Stats {
	return driver.Stats{}
}

func TestNewBatch(t *testing.T) {
	t.Run("Success", func(t *testing.T) {
		mockConn := new(MockConn)
		mockBatch := new(MockBatch)
		ctx := context.Background()
		query := "INSERT INTO test VALUES"
		cfg := BatchConfig{MaxBatchSize: 100}

		mockConn.On("PrepareBatch", ctx, query).Return(mockBatch, nil)

		batch, err := NewBatch(ctx, mockConn, query, cfg)

		require.NoError(t, err)
		assert.Equal(t, cfg.MaxBatchSize, batch.sizeThreshold)
		assert.Equal(t, mockBatch, batch.currentBatch)
		mockConn.AssertExpectations(t)
	})

	t.Run("PrepareBatchError", func(t *testing.T) {
		mockConn := new(MockConn)
		ctx := context.Background()
		query := "INSERT INTO test VALUES"
		cfg := BatchConfig{MaxBatchSize: 100}

		expectedErr := errors.New("prepare batch error")
		mockConn.On("PrepareBatch", ctx, query).Return(&MockBatch{}, expectedErr)

		batch, err := NewBatch(ctx, mockConn, query, cfg)

		assert.Nil(t, batch)
		assert.ErrorIs(t, err, expectedErr)
		mockConn.AssertExpectations(t)
	})
}

func TestBatchSize(t *testing.T) {
	batch := &Batch{
		cache: map[uint64]struct{}{
			1: {},
			2: {},
			3: {},
		},
	}

	assert.Equal(t, 3, batch.Size())
}

func TestBatchAppend(t *testing.T) {
	t.Run("Success", func(t *testing.T) {
		mockBatch := new(MockBatch)
		batch := &Batch{
			currentBatch: mockBatch,
			cache:        make(map[uint64]struct{}),
		}

		data := []any{"test", 123, true}
		mockBatch.On("Append", data).Return(nil)

		err := batch.Append(1, data...)

		require.NoError(t, err)
		assert.Contains(t, batch.cache, uint64(1))
		mockBatch.AssertExpectations(t)
	})

	t.Run("DuplicateID", func(t *testing.T) {
		mockBatch := new(MockBatch)
		batch := &Batch{
			currentBatch: mockBatch,
			cache: map[uint64]struct{}{
				1: {},
			},
		}

		data := []any{"test", 123, true}

		err := batch.Append(1, data...)

		require.NoError(t, err)
		mockBatch.AssertNotCalled(t, "Append")
	})

	t.Run("AppendError", func(t *testing.T) {
		mockBatch := new(MockBatch)
		batch := &Batch{
			currentBatch: mockBatch,
			cache:        make(map[uint64]struct{}),
		}

		data := []any{"test", 123, true}
		expectedErr := errors.New("append error")
		mockBatch.On("Append", data).Return(expectedErr)

		err := batch.Append(1, data...)

		assert.ErrorContains(t, err, "append failed")
		assert.ErrorIs(t, err, expectedErr)
		mockBatch.AssertExpectations(t)
	})
}

func TestBatchFlush(t *testing.T) {
	t.Run("Success", func(t *testing.T) {
		mockConn := new(MockConn)
		mockBatch := new(MockBatch)
		batch := &Batch{
			conn:         mockConn,
			currentBatch: mockBatch,
			cache: map[uint64]struct{}{
				1: {},
				2: {},
			},
		}

		mockConn.On("PrepareBatch", mock.Anything, mock.Anything).Return(mockBatch, nil)
		mockBatch.On("Flush").Return(nil)

		err := batch.Flush()

		require.NoError(t, err)
		assert.Empty(t, batch.cache)
		mockBatch.AssertExpectations(t)
		mockConn.AssertExpectations(t)
	})

	t.Run("FlushError", func(t *testing.T) {
		mockConn := new(MockConn)
		mockBatch := new(MockBatch)
		batch := &Batch{
			conn:         mockConn,
			currentBatch: mockBatch,
			cache: map[uint64]struct{}{
				1: {},
				2: {},
			},
		}

		expectedErr := errors.New("flush error")
		mockBatch.On("Flush").Return(expectedErr)

		err := batch.Flush()

		assert.ErrorContains(t, err, "failed to flush the batch")
		assert.ErrorIs(t, err, expectedErr)
		assert.Len(t, batch.cache, 2) // Cache should not be cleared on error
		mockBatch.AssertExpectations(t)
	})
}
