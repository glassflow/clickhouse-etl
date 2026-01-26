package schema

import (
	"context"
	"testing"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/batch/clickhouse"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/client"
)

// BenchmarkAppendToColumns benchmarks the new columnar approach
func BenchmarkAppendToColumns(b *testing.B) {
	mapper := setupBenchmarkMapper(b)

	// Create a mock ChGoClient for testing
	// Note: This won't actually connect, but we need it for ColumnarBatch creation
	chClient := &client.ChGoClient{} // This will need proper initialization in real tests

	// Get column names and types
	columnNames := mapper.GetOrderedColumnsStream("logs")
	columnTypes := make([]string, len(columnNames))

	// Map column names to types (simplified - in real usage this comes from mapper)
	columnNameToType := make(map[string]string)
	for _, col := range mapper.Columns {
		if col.StreamName == "logs" {
			columnNameToType[col.ColumnName] = string(col.ColumnType)
		}
	}

	for i, colName := range columnNames {
		if colType, ok := columnNameToType[colName]; ok {
			columnTypes[i] = colType
		} else {
			columnTypes[i] = "String" // fallback
		}
	}

	// Create columnar batch
	batch, err := clickhouse.NewColumnarBatch(chClient, columnNames, columnTypes)
	if err != nil {
		b.Fatalf("failed to create columnar batch: %v", err)
	}

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		batch.Reset()
		err := mapper.AppendToColumns("logs", benchmarkJSON, batch)
		if err != nil {
			b.Fatalf("AppendToColumns failed: %v", err)
		}
	}
}

// BenchmarkAppendToColumnsVsPrepareValues compares old vs new approach
func BenchmarkAppendToColumnsVsPrepareValues(b *testing.B) {
	mapper := setupBenchmarkMapper(b)

	// Setup for columnar batch (simplified - would need real client in integration tests)
	columnNames := mapper.GetOrderedColumnsStream("logs")
	columnTypes := make([]string, len(columnNames))
	columnNameToType := make(map[string]string)
	for _, col := range mapper.Columns {
		if col.StreamName == "logs" {
			columnNameToType[col.ColumnName] = string(col.ColumnType)
		}
	}
	for i, colName := range columnNames {
		if colType, ok := columnNameToType[colName]; ok {
			columnTypes[i] = colType
		} else {
			columnTypes[i] = "String"
		}
	}

	chClient := &client.ChGoClient{}
	batch, err := clickhouse.NewColumnarBatch(chClient, columnNames, columnTypes)
	if err != nil {
		b.Fatalf("failed to create columnar batch: %v", err)
	}

	b.Run("PrepareValues", func(b *testing.B) {
		b.ReportAllocs()
		for i := 0; i < b.N; i++ {
			_, err := mapper.PrepareValuesStream("logs", benchmarkJSON)
			if err != nil {
				b.Fatalf("PrepareValuesStream failed: %v", err)
			}
		}
	})

	b.Run("AppendToColumns", func(b *testing.B) {
		b.ReportAllocs()
		for i := 0; i < b.N; i++ {
			batch.Reset()
			err := mapper.AppendToColumns("logs", benchmarkJSON, batch)
			if err != nil {
				b.Fatalf("AppendToColumns failed: %v", err)
			}
		}
	})
}

// BenchmarkColumnarBatchOperations benchmarks batch operations
func BenchmarkColumnarBatchOperations(b *testing.B) {
	mapper := setupBenchmarkMapper(b)

	columnNames := mapper.GetOrderedColumnsStream("logs")
	columnTypes := make([]string, len(columnNames))
	columnNameToType := make(map[string]string)
	for _, col := range mapper.Columns {
		if col.StreamName == "logs" {
			columnNameToType[col.ColumnName] = string(col.ColumnType)
		}
	}
	for i, colName := range columnNames {
		if colType, ok := columnNameToType[colName]; ok {
			columnTypes[i] = colType
		} else {
			columnTypes[i] = "String"
		}
	}

	chClient := &client.ChGoClient{}
	batch, err := clickhouse.NewColumnarBatch(chClient, columnNames, columnTypes)
	if err != nil {
		b.Fatalf("failed to create columnar batch: %v", err)
	}

	b.Run("Reset", func(b *testing.B) {
		b.ReportAllocs()
		for i := 0; i < b.N; i++ {
			batch.Reset()
			// Add some data first
			_ = mapper.AppendToColumns("logs", benchmarkJSON, batch)
		}
	})

	b.Run("Size", func(b *testing.B) {
		batch.Reset()
		_ = mapper.AppendToColumns("logs", benchmarkJSON, batch)
		b.ResetTimer()
		b.ReportAllocs()
		for i := 0; i < b.N; i++ {
			_ = batch.Size()
		}
	})

	b.Run("HasID", func(b *testing.B) {
		batch.Reset()
		batch.AddID(12345)
		b.ResetTimer()
		b.ReportAllocs()
		for i := 0; i < b.N; i++ {
			_ = batch.HasID(12345)
		}
	})
}

// BenchmarkColumnarBatchSend benchmarks the Send operation (without actual network call)
func BenchmarkColumnarBatchSend(b *testing.B) {
	mapper := setupBenchmarkMapper(b)

	columnNames := mapper.GetOrderedColumnsStream("logs")
	columnTypes := make([]string, len(columnNames))
	columnNameToType := make(map[string]string)
	for _, col := range mapper.Columns {
		if col.StreamName == "logs" {
			columnNameToType[col.ColumnName] = string(col.ColumnType)
		}
	}
	for i, colName := range columnNames {
		if colType, ok := columnNameToType[colName]; ok {
			columnTypes[i] = colType
		} else {
			columnTypes[i] = "String"
		}
	}

	chClient := &client.ChGoClient{}
	batch, err := clickhouse.NewColumnarBatch(chClient, columnNames, columnTypes)
	if err != nil {
		b.Fatalf("failed to create columnar batch: %v", err)
	}

	// Fill batch with data
	for i := 0; i < 100; i++ {
		_ = mapper.AppendToColumns("logs", benchmarkJSON, batch)
	}

	ctx := context.Background()
	b.ResetTimer()
	b.ReportAllocs()

	// Note: This will fail with actual Send, but we're just benchmarking the method call overhead
	// In real integration tests, you'd have a proper ChGoClient connected to ClickHouse
	for i := 0; i < b.N; i++ {
		_ = batch.Send(ctx)
	}
}
