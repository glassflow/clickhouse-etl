package clickhouse

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/ClickHouse/ch-go/proto"
	"github.com/google/uuid"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/client"
)

// ColumnarBatch represents a batch of rows stored in columnar format for efficient ch-go insertion.
type ColumnarBatch struct {
	columns     []proto.Column // typed columns
	columnNames []string       // column names for Input
	input       proto.Input    // reusable Input slice
	rowCount    int            // current row count
	dedupCache  map[uint64]struct{}
	client      *client.ChGoClient
	tableName   string
}

// NewColumnarBatch creates a new columnar batch with columns matching the provided type mappings.
// columnTypes should be a slice of ClickHouse type strings (e.g., "Int64", "String", "DateTime64(6)")
func NewColumnarBatch(
	chClient *client.ChGoClient,
	columnNames []string,
	columnTypes []string,
) (*ColumnarBatch, error) {
	if len(columnNames) != len(columnTypes) {
		return nil, fmt.Errorf("column names and types must have the same length")
	}

	columns := make([]proto.Column, len(columnTypes))
	input := make(proto.Input, len(columnTypes))

	for i, colType := range columnTypes {
		col, err := createColumn(colType)
		if err != nil {
			return nil, fmt.Errorf("failed to create column %s with type %s: %w", columnNames[i], colType, err)
		}
		columns[i] = col
		input[i] = proto.InputColumn{
			Name: columnNames[i],
			Data: col,
		}
	}

	return &ColumnarBatch{
		columns:     columns,
		columnNames: columnNames,
		input:       input,
		rowCount:    0,
		dedupCache:  make(map[uint64]struct{}),
		client:      chClient,
		tableName:   chClient.GetTableName(),
	}, nil
}

// createColumn creates a proto.Column based on the ClickHouse type string.
func createColumn(chType string) (proto.Column, error) {
	// Normalize the type string
	chType = strings.TrimSpace(chType)

	// Handle Nullable types
	if strings.HasPrefix(chType, "Nullable(") && strings.HasSuffix(chType, ")") {
		innerType := chType[9 : len(chType)-1]
		return createNullableColumn(innerType)
	}

	// Handle LowCardinality types - extract inner type
	if strings.HasPrefix(chType, "LowCardinality(") && strings.HasSuffix(chType, ")") {
		innerType := chType[15 : len(chType)-1]
		return createLowCardinalityColumn(innerType)
	}

	// Handle Array types
	if strings.HasPrefix(chType, "Array(") && strings.HasSuffix(chType, ")") {
		innerType := chType[6 : len(chType)-1]
		return createArrayColumn(innerType)
	}

	// Handle Map types
	if strings.HasPrefix(chType, "Map(") && strings.HasSuffix(chType, ")") {
		return createMapColumn(chType)
	}

	// Handle DateTime64 with parameters
	if strings.HasPrefix(chType, "DateTime64") {
		return createDateTime64Column(chType)
	}

	// Handle FixedString
	if strings.HasPrefix(chType, "FixedString(") {
		return createFixedStringColumn(chType)
	}

	// Handle Enum types
	if strings.HasPrefix(chType, "Enum8(") || strings.HasPrefix(chType, "Enum16(") {
		return createEnumColumn(chType)
	}

	// Handle basic types
	switch chType {
	case "Int8":
		return new(proto.ColInt8), nil
	case "Int16":
		return new(proto.ColInt16), nil
	case "Int32":
		return new(proto.ColInt32), nil
	case "Int64":
		return new(proto.ColInt64), nil
	case "UInt8":
		return new(proto.ColUInt8), nil
	case "UInt16":
		return new(proto.ColUInt16), nil
	case "UInt32":
		return new(proto.ColUInt32), nil
	case "UInt64":
		return new(proto.ColUInt64), nil
	case "Float32":
		return new(proto.ColFloat32), nil
	case "Float64":
		return new(proto.ColFloat64), nil
	case "Bool":
		return new(proto.ColBool), nil
	case "String":
		return new(proto.ColStr), nil
	case "DateTime":
		return new(proto.ColDateTime), nil
	case "Date":
		return new(proto.ColDate), nil
	case "Date32":
		return new(proto.ColDate32), nil
	case "UUID":
		return new(proto.ColUUID), nil
	default:
		return nil, fmt.Errorf("unsupported column type: %s", chType)
	}
}

func createNullableColumn(innerType string) (proto.Column, error) {
	switch innerType {
	case "Int8":
		return new(proto.ColInt8).Nullable(), nil
	case "Int16":
		return new(proto.ColInt16).Nullable(), nil
	case "Int32":
		return new(proto.ColInt32).Nullable(), nil
	case "Int64":
		return new(proto.ColInt64).Nullable(), nil
	case "UInt8":
		return new(proto.ColUInt8).Nullable(), nil
	case "UInt16":
		return new(proto.ColUInt16).Nullable(), nil
	case "UInt32":
		return new(proto.ColUInt32).Nullable(), nil
	case "UInt64":
		return new(proto.ColUInt64).Nullable(), nil
	case "Float32":
		return new(proto.ColFloat32).Nullable(), nil
	case "Float64":
		return new(proto.ColFloat64).Nullable(), nil
	case "Bool":
		return new(proto.ColBool).Nullable(), nil
	case "String":
		return new(proto.ColStr).Nullable(), nil
	case "DateTime":
		return new(proto.ColDateTime).Nullable(), nil
	case "UUID":
		return new(proto.ColUUID).Nullable(), nil
	default:
		if strings.HasPrefix(innerType, "DateTime64") {
			col, err := createDateTime64Column(innerType)
			if err != nil {
				return nil, err
			}
			if dt64, ok := col.(*proto.ColDateTime64); ok {
				return dt64.Nullable(), nil
			}
		}
		return nil, fmt.Errorf("unsupported nullable inner type: %s", innerType)
	}
}

func createLowCardinalityColumn(innerType string) (proto.Column, error) {
	switch innerType {
	case "String":
		return new(proto.ColStr).LowCardinality(), nil
	case "Int8":
		return new(proto.ColInt8).LowCardinality(), nil
	case "Int16":
		return new(proto.ColInt16).LowCardinality(), nil
	case "Int32":
		return new(proto.ColInt32).LowCardinality(), nil
	case "Int64":
		return new(proto.ColInt64).LowCardinality(), nil
	case "UInt8":
		return new(proto.ColUInt8).LowCardinality(), nil
	case "UInt16":
		return new(proto.ColUInt16).LowCardinality(), nil
	case "UInt32":
		return new(proto.ColUInt32).LowCardinality(), nil
	case "UInt64":
		return new(proto.ColUInt64).LowCardinality(), nil
	case "Float32":
		return new(proto.ColFloat32).LowCardinality(), nil
	case "Float64":
		return new(proto.ColFloat64).LowCardinality(), nil
	case "DateTime":
		return new(proto.ColDateTime).LowCardinality(), nil
	default:
		if strings.HasPrefix(innerType, "FixedString(") {
			// LowCardinality is not directly supported for FixedString in ch-go
			// Return the FixedString column as-is (ClickHouse will handle LowCardinality optimization)
			col, err := createFixedStringColumn(innerType)
			if err != nil {
				return nil, err
			}
			return col, nil
		}
		return nil, fmt.Errorf("unsupported LowCardinality inner type: %s", innerType)
	}
}

func createArrayColumn(innerType string) (proto.Column, error) {
	innerCol, err := createColumn(innerType)
	if err != nil {
		return nil, fmt.Errorf("failed to create array inner column: %w", err)
	}

	switch col := innerCol.(type) {
	case *proto.ColInt8:
		return proto.NewArray(col), nil
	case *proto.ColInt16:
		return proto.NewArray(col), nil
	case *proto.ColInt32:
		return proto.NewArray(col), nil
	case *proto.ColInt64:
		return proto.NewArray(col), nil
	case *proto.ColUInt8:
		return proto.NewArray(col), nil
	case *proto.ColUInt16:
		return proto.NewArray(col), nil
	case *proto.ColUInt32:
		return proto.NewArray(col), nil
	case *proto.ColUInt64:
		return proto.NewArray(col), nil
	case *proto.ColFloat32:
		return proto.NewArray(col), nil
	case *proto.ColFloat64:
		return proto.NewArray(col), nil
	case *proto.ColBool:
		return proto.NewArray(col), nil
	case *proto.ColStr:
		return proto.NewArray(col), nil
	case *proto.ColDateTime:
		return proto.NewArray(col), nil
	case *proto.ColDateTime64:
		return proto.NewArray(col), nil
	case *proto.ColUUID:
		return proto.NewArray(col), nil
	default:
		return nil, fmt.Errorf("unsupported array inner type: %s", innerType)
	}
}

func createMapColumn(chType string) (proto.Column, error) {
	// Parse Map(KeyType, ValueType)
	inner := chType[4 : len(chType)-1] // Remove "Map(" and ")"

	// Simple parsing - find the comma that separates key and value types
	depth := 0
	commaIdx := -1
	for i, c := range inner {
		switch c {
		case '(':
			depth++
		case ')':
			depth--
		case ',':
			if depth == 0 {
				commaIdx = i
			}
		}
		if commaIdx >= 0 {
			break
		}
	}

	if commaIdx < 0 {
		return nil, fmt.Errorf("invalid Map type format: %s", chType)
	}

	keyType := strings.TrimSpace(inner[:commaIdx])
	valueType := strings.TrimSpace(inner[commaIdx+1:])

	// For now, support common Map types
	if keyType == "String" && valueType == "String" {
		return proto.NewMap[string, string](new(proto.ColStr), new(proto.ColStr)), nil
	}
	if keyType == "String" && valueType == "Int64" {
		return proto.NewMap[string, int64](new(proto.ColStr), new(proto.ColInt64)), nil
	}
	if keyType == "String" && valueType == "Float64" {
		return proto.NewMap[string, float64](new(proto.ColStr), new(proto.ColFloat64)), nil
	}

	return nil, fmt.Errorf("unsupported Map type: %s", chType)
}

func createDateTime64Column(chType string) (proto.Column, error) {
	// Parse precision from DateTime64(precision) or DateTime64(precision, 'timezone')
	precision := proto.PrecisionNano // default

	if strings.HasPrefix(chType, "DateTime64(") {
		inner := chType[11 : len(chType)-1] // Remove "DateTime64(" and ")"
		parts := strings.Split(inner, ",")
		if len(parts) >= 1 {
			precStr := strings.TrimSpace(parts[0])
			switch precStr {
			case "0":
				precision = proto.PrecisionSecond
			case "3":
				precision = proto.PrecisionMilli
			case "6":
				precision = proto.PrecisionMicro
			case "9":
				precision = proto.PrecisionNano
			default:
				// Default to microseconds for unknown precision
				precision = proto.PrecisionMicro
			}
		}
	}

	return new(proto.ColDateTime64).WithPrecision(precision), nil
}

func createFixedStringColumn(chType string) (proto.Column, error) {
	// Parse size from FixedString(N)
	inner := chType[12 : len(chType)-1] // Remove "FixedString(" and ")"
	var size int
	if _, err := fmt.Sscanf(inner, "%d", &size); err != nil {
		return nil, fmt.Errorf("invalid FixedString size: %s", inner)
	}

	col := &proto.ColFixedStr{}
	col.Size = size
	return col, nil
}

func createEnumColumn(chType string) (proto.Column, error) {
	// For Enum types, we'll use string columns and let ClickHouse handle the conversion
	// This is a simplification - full enum support would require parsing the enum definition
	if strings.HasPrefix(chType, "Enum8(") {
		return new(proto.ColEnum8), nil
	}
	return new(proto.ColEnum16), nil
}

// Size returns the current number of rows in the batch.
func (b *ColumnarBatch) Size() int {
	return b.rowCount
}

// Reset clears all columns and prepares for a new batch.
func (b *ColumnarBatch) Reset() {
	for _, col := range b.columns {
		col.Reset()
	}
	b.rowCount = 0
	clear(b.dedupCache)
}

// HasID checks if a message ID has already been added to the batch.
func (b *ColumnarBatch) HasID(id uint64) bool {
	_, ok := b.dedupCache[id]
	return ok
}

// AddID adds a message ID to the deduplication cache.
func (b *ColumnarBatch) AddID(id uint64) {
	b.dedupCache[id] = struct{}{}
}

// Input returns the proto.Input for ch-go query execution.
func (b *ColumnarBatch) Input() proto.Input {
	return b.input
}

// Columns returns the underlying columns slice.
func (b *ColumnarBatch) Columns() []proto.Column {
	return b.columns
}

// IncrementRowCount increments the row count.
func (b *ColumnarBatch) IncrementRowCount() {
	b.rowCount++
}

// Send sends the batch to ClickHouse using the ch-go client.
func (b *ColumnarBatch) Send(ctx context.Context) error {
	if b.rowCount == 0 {
		return nil
	}

	if err := b.client.Insert(ctx, b.input); err != nil {
		return fmt.Errorf("failed to send columnar batch: %w", err)
	}

	return nil
}

// AppendInt8 appends a value to an Int8 column.
func (b *ColumnarBatch) AppendInt8(colIdx int, val int8) {
	if col, ok := b.columns[colIdx].(*proto.ColInt8); ok {
		col.Append(val)
	}
}

// AppendInt16 appends a value to an Int16 column.
func (b *ColumnarBatch) AppendInt16(colIdx int, val int16) {
	if col, ok := b.columns[colIdx].(*proto.ColInt16); ok {
		col.Append(val)
	}
}

// AppendInt32 appends a value to an Int32 column.
func (b *ColumnarBatch) AppendInt32(colIdx int, val int32) {
	if col, ok := b.columns[colIdx].(*proto.ColInt32); ok {
		col.Append(val)
	}
}

// AppendInt64 appends a value to an Int64 column.
func (b *ColumnarBatch) AppendInt64(colIdx int, val int64) {
	if col, ok := b.columns[colIdx].(*proto.ColInt64); ok {
		col.Append(val)
	}
}

// AppendUInt8 appends a value to a UInt8 column.
func (b *ColumnarBatch) AppendUInt8(colIdx int, val uint8) {
	if col, ok := b.columns[colIdx].(*proto.ColUInt8); ok {
		col.Append(val)
	}
}

// AppendUInt16 appends a value to a UInt16 column.
func (b *ColumnarBatch) AppendUInt16(colIdx int, val uint16) {
	if col, ok := b.columns[colIdx].(*proto.ColUInt16); ok {
		col.Append(val)
	}
}

// AppendUInt32 appends a value to a UInt32 column.
func (b *ColumnarBatch) AppendUInt32(colIdx int, val uint32) {
	if col, ok := b.columns[colIdx].(*proto.ColUInt32); ok {
		col.Append(val)
	}
}

// AppendUInt64 appends a value to a UInt64 column.
func (b *ColumnarBatch) AppendUInt64(colIdx int, val uint64) {
	if col, ok := b.columns[colIdx].(*proto.ColUInt64); ok {
		col.Append(val)
	}
}

// AppendFloat32 appends a value to a Float32 column.
func (b *ColumnarBatch) AppendFloat32(colIdx int, val float32) {
	if col, ok := b.columns[colIdx].(*proto.ColFloat32); ok {
		col.Append(val)
	}
}

// AppendFloat64 appends a value to a Float64 column.
func (b *ColumnarBatch) AppendFloat64(colIdx int, val float64) {
	if col, ok := b.columns[colIdx].(*proto.ColFloat64); ok {
		col.Append(val)
	}
}

// AppendBool appends a value to a Bool column.
func (b *ColumnarBatch) AppendBool(colIdx int, val bool) {
	if col, ok := b.columns[colIdx].(*proto.ColBool); ok {
		col.Append(val)
	}
}

// AppendString appends a value to a String column.
func (b *ColumnarBatch) AppendString(colIdx int, val string) {
	if col, ok := b.columns[colIdx].(*proto.ColStr); ok {
		col.Append(val)
	}
}

// AppendStringBytes appends bytes directly to a String column (avoids string allocation).
func (b *ColumnarBatch) AppendStringBytes(colIdx int, val []byte) {
	if col, ok := b.columns[colIdx].(*proto.ColStr); ok {
		col.AppendBytes(val)
	}
}

// AppendDateTime appends a value to a DateTime column.
func (b *ColumnarBatch) AppendDateTime(colIdx int, val time.Time) {
	if col, ok := b.columns[colIdx].(*proto.ColDateTime); ok {
		col.Append(val)
	}
}

// AppendDateTime64 appends a value to a DateTime64 column.
func (b *ColumnarBatch) AppendDateTime64(colIdx int, val time.Time) {
	if col, ok := b.columns[colIdx].(*proto.ColDateTime64); ok {
		col.Append(val)
	}
}

// AppendUUID appends a value to a UUID column.
func (b *ColumnarBatch) AppendUUID(colIdx int, val uuid.UUID) {
	if col, ok := b.columns[colIdx].(*proto.ColUUID); ok {
		col.Append(val)
	}
}

// AppendLowCardinalityString appends a value to a LowCardinality(String) column.
func (b *ColumnarBatch) AppendLowCardinalityString(colIdx int, val string) {
	if col, ok := b.columns[colIdx].(*proto.ColLowCardinality[string]); ok {
		col.Append(val)
	}
}

// AppendStringArray appends a slice of strings to an Array(String) column.
func (b *ColumnarBatch) AppendStringArray(colIdx int, vals []string) {
	if col, ok := b.columns[colIdx].(*proto.ColArr[string]); ok {
		col.Append(vals)
	}
}

// AppendInt64Array appends a slice of int64 to an Array(Int64) column.
func (b *ColumnarBatch) AppendInt64Array(colIdx int, vals []int64) {
	if col, ok := b.columns[colIdx].(*proto.ColArr[int64]); ok {
		col.Append(vals)
	}
}

// AppendMapStringString appends a map to a Map(String, String) column.
func (b *ColumnarBatch) AppendMapStringString(colIdx int, val map[string]string) {
	if col, ok := b.columns[colIdx].(*proto.ColMap[string, string]); ok {
		col.Append(val)
	}
}

// Reload implements the Batch interface. For columnar batches, this is a no-op
// since batches are reused via sync.Pool and Reset() is called instead.
func (b *ColumnarBatch) Reload(ctx context.Context) error {
	// No-op for columnar batches - they are reused via pool
	return nil
}

// Append implements the Batch interface for backward compatibility.
// This method converts []any to columnar format, but it's not the optimized path.
// The sink should use ColumnarMapper.AppendToColumns instead.
func (b *ColumnarBatch) Append(id uint64, data ...any) error {
	if b.HasID(id) {
		return ErrAlreadyExists
	}

	b.AddID(id)

	// Convert []any to columnar format - this is not optimal but provides compatibility
	if len(data) != len(b.columns) {
		return fmt.Errorf("data length %d does not match column count %d", len(data), len(b.columns))
	}

	for i, val := range data {
		if err := b.appendAnyValue(i, val); err != nil {
			return fmt.Errorf("failed to append value at column %d: %w", i, err)
		}
	}

	b.IncrementRowCount()
	return nil
}

// appendAnyValue appends a value of any type to the appropriate column.
// This is a fallback for the Append method and is not the optimized path.
func (b *ColumnarBatch) appendAnyValue(colIdx int, val any) error {
	if val == nil {
		// Append zero value based on column type
		return nil // Zero values are handled by default appends
	}

	switch v := val.(type) {
	case int8:
		b.AppendInt8(colIdx, v)
	case int16:
		b.AppendInt16(colIdx, v)
	case int32:
		b.AppendInt32(colIdx, v)
	case int64:
		b.AppendInt64(colIdx, v)
	case int:
		b.AppendInt64(colIdx, int64(v))
	case uint8:
		b.AppendUInt8(colIdx, v)
	case uint16:
		b.AppendUInt16(colIdx, v)
	case uint32:
		b.AppendUInt32(colIdx, v)
	case uint64:
		b.AppendUInt64(colIdx, v)
	case uint:
		b.AppendUInt64(colIdx, uint64(v))
	case float32:
		b.AppendFloat32(colIdx, v)
	case float64:
		b.AppendFloat64(colIdx, v)
	case bool:
		b.AppendBool(colIdx, v)
	case string:
		b.AppendString(colIdx, v)
	case time.Time:
		// Try DateTime64 first, fall back to DateTime
		b.AppendDateTime64(colIdx, v)
	case uuid.UUID:
		b.AppendUUID(colIdx, v)
	case []string:
		b.AppendStringArray(colIdx, v)
	case []int64:
		b.AppendInt64Array(colIdx, v)
	case map[string]string:
		b.AppendMapStringString(colIdx, v)
	default:
		// For unknown types, try to convert to string
		b.AppendString(colIdx, fmt.Sprintf("%v", v))
	}

	return nil
}
