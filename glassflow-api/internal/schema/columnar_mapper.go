package schema

import (
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/ClickHouse/ch-go/proto"
	"github.com/google/uuid"
	"github.com/valyala/fastjson"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/batch/clickhouse"
)

// ColumnarMapper extends Mapper with columnar-specific methods for direct column appending.
type ColumnarMapper interface {
	Mapper
	// AppendToColumns parses JSON data and appends values directly to typed columns in the batch.
	// This avoids []any allocation by appending directly to proto.Column types.
	AppendToColumns(streamName string, data []byte, batch *clickhouse.ColumnarBatch) error
}

// AppendToColumns implements ColumnarMapper for JsonToClickHouseMapper.
// It parses JSON once and appends values directly to typed columns, avoiding []any allocation.
func (m *JsonToClickHouseMapper) AppendToColumns(
	streamName string,
	data []byte,
	batch *clickhouse.ColumnarBatch,
) error {
	p := parserPool.Get()
	defer parserPool.Put(p)

	v, err := p.ParseBytes(data)
	if err != nil {
		return fmt.Errorf("failed to parse JSON data: %w", err)
	}

	// Get the column indices for this stream in batch order (matches GetOrderedColumnsStream)
	columnIndices, ok := m.streamColumnIdx[streamName]
	if !ok {
		return fmt.Errorf("stream %s not found in column index map", streamName)
	}

	// Get ordered column names for this stream
	orderedColNames := m.GetOrderedColumnsStream(streamName)
	if len(columnIndices) != len(orderedColNames) {
		return fmt.Errorf("column index count mismatch for stream %s: expected %d, got %d",
			streamName, len(orderedColNames), len(columnIndices))
	}

	// Append values in batch column order
	for batchColIdx, colIdxInMapper := range columnIndices {
		column := m.Columns[colIdxInMapper]

		fv := getNestedFastjsonValue(v, column.FieldName, column.pathParts)
		fieldType := m.Streams[column.StreamName].Fields[column.FieldName]

		// Direct append based on column type - no []any allocation
		// batchColIdx is the index in batch.columns, which matches GetOrderedColumnsStream order
		if err := m.appendValueToColumn(batch, batchColIdx, column.ColumnType, fieldType, fv); err != nil {
			return fmt.Errorf("failed to append value for column %s: %w", column.ColumnName, err)
		}
	}

	batch.IncrementRowCount()
	return nil
}

// appendValueToColumn appends a fastjson value directly to the appropriate column type.
func (m *JsonToClickHouseMapper) appendValueToColumn(
	batch *clickhouse.ColumnarBatch,
	colIdx int,
	columnType ClickHouseDataType,
	fieldType KafkaDataType,
	fv *fastjson.Value,
) error {
	// Handle null/missing values - append zero/default values
	if fv == nil || fv.Type() == fastjson.TypeNull {
		return m.appendZeroValue(batch, colIdx, columnType)
	}

	// Handle based on ClickHouse column type
	switch columnType {
	case internal.CHTypeBool:
		return m.appendBool(batch, colIdx, fv)

	case internal.CHTypeInt8, internal.CHTypeLCInt8:
		return m.appendInt8(batch, colIdx, fv)

	case internal.CHTypeInt16, internal.CHTypeLCInt16:
		return m.appendInt16(batch, colIdx, fv)

	case internal.CHTypeInt32, internal.CHTypeLCInt32:
		return m.appendInt32(batch, colIdx, fv)

	case internal.CHTypeInt64, internal.CHTypeLCInt64:
		return m.appendInt64(batch, colIdx, fv)

	case internal.CHTypeUInt8, internal.CHTypeLCUInt8:
		return m.appendUInt8(batch, colIdx, fv)

	case internal.CHTypeUInt16, internal.CHTypeLCUInt16:
		return m.appendUInt16(batch, colIdx, fv)

	case internal.CHTypeUInt32, internal.CHTypeLCUInt32:
		return m.appendUInt32(batch, colIdx, fv)

	case internal.CHTypeUInt64, internal.CHTypeLCUInt64:
		return m.appendUInt64(batch, colIdx, fv)

	case internal.CHTypeFloat32, internal.CHTypeLCFloat32:
		return m.appendFloat32(batch, colIdx, fv)

	case internal.CHTypeFloat64, internal.CHTypeLCFloat64:
		return m.appendFloat64(batch, colIdx, fv)

	case internal.CHTypeString, internal.CHTypeLCString:
		return m.appendString(batch, colIdx, fv)

	case internal.CHTypeFString, internal.CHTypeLCFString:
		return m.appendFixedString(batch, colIdx, fv)

	case internal.CHTypeDateTime, internal.CHTypeLCDateTime:
		return m.appendDateTime(batch, colIdx, fv, fieldType)

	case internal.CHTypeDateTime64:
		return m.appendDateTime64(batch, colIdx, fv, fieldType, string(columnType))

	case internal.CHTypeUUID:
		return m.appendUUID(batch, colIdx, fv)

	case internal.CHTypeEnum8, internal.CHTypeEnum16:
		return m.appendEnum(batch, colIdx, fv, columnType)

	default:
		// Handle parameterized types
		colTypeStr := string(columnType)
		if strings.HasPrefix(colTypeStr, "Array(") {
			return m.appendArray(batch, colIdx, fv, columnType)
		}
		if strings.HasPrefix(colTypeStr, "Map(") {
			return m.appendMap(batch, colIdx, fv)
		}
		if strings.HasPrefix(colTypeStr, "DateTime64") {
			return m.appendDateTime64(batch, colIdx, fv, fieldType, colTypeStr)
		}
		if strings.HasPrefix(colTypeStr, "Nullable(") {
			return m.appendNullable(batch, colIdx, fv, columnType, fieldType)
		}

		return fmt.Errorf("unsupported column type for columnar append: %s", columnType)
	}
}

// appendZeroValue appends a zero/default value for the given column type.
func (m *JsonToClickHouseMapper) appendZeroValue(
	batch *clickhouse.ColumnarBatch,
	colIdx int,
	columnType ClickHouseDataType,
) error {
	switch columnType {
	case internal.CHTypeBool:
		batch.AppendBool(colIdx, false)
	case internal.CHTypeInt8, internal.CHTypeLCInt8:
		batch.AppendInt8(colIdx, 0)
	case internal.CHTypeInt16, internal.CHTypeLCInt16:
		batch.AppendInt16(colIdx, 0)
	case internal.CHTypeInt32, internal.CHTypeLCInt32:
		batch.AppendInt32(colIdx, 0)
	case internal.CHTypeInt64, internal.CHTypeLCInt64:
		batch.AppendInt64(colIdx, 0)
	case internal.CHTypeUInt8, internal.CHTypeLCUInt8:
		batch.AppendUInt8(colIdx, 0)
	case internal.CHTypeUInt16, internal.CHTypeLCUInt16:
		batch.AppendUInt16(colIdx, 0)
	case internal.CHTypeUInt32, internal.CHTypeLCUInt32:
		batch.AppendUInt32(colIdx, 0)
	case internal.CHTypeUInt64, internal.CHTypeLCUInt64:
		batch.AppendUInt64(colIdx, 0)
	case internal.CHTypeFloat32, internal.CHTypeLCFloat32:
		batch.AppendFloat32(colIdx, 0)
	case internal.CHTypeFloat64, internal.CHTypeLCFloat64:
		batch.AppendFloat64(colIdx, 0)
	case internal.CHTypeString:
		batch.AppendString(colIdx, "")
	case internal.CHTypeLCString:
		batch.AppendLowCardinalityString(colIdx, "")
	case internal.CHTypeFString, internal.CHTypeLCFString:
		batch.AppendString(colIdx, "") // FixedString will pad
	case internal.CHTypeDateTime, internal.CHTypeLCDateTime, internal.CHTypeDateTime64:
		batch.AppendDateTime(colIdx, time.Time{})
	case internal.CHTypeUUID:
		batch.AppendUUID(colIdx, uuid.UUID{})
	default:
		// For complex types, try to append empty value
		if strings.HasPrefix(string(columnType), "Array(") {
			// Append empty array - implementation depends on array type
			return nil // Will be handled by specific array append
		}
		if strings.HasPrefix(string(columnType), "Map(") {
			// Append empty map
			return nil // Will be handled by specific map append
		}
		// Default: append empty string for unknown types
		batch.AppendString(colIdx, "")
	}
	return nil
}

func (m *JsonToClickHouseMapper) appendBool(batch *clickhouse.ColumnarBatch, colIdx int, fv *fastjson.Value) error {
	batch.AppendBool(colIdx, fv.GetBool())
	return nil
}

func (m *JsonToClickHouseMapper) appendInt8(batch *clickhouse.ColumnarBatch, colIdx int, fv *fastjson.Value) error {
	i, err := fv.Int64()
	if err != nil {
		return fmt.Errorf("failed to parse int8: %w", err)
	}
	if i < math.MinInt8 || i > math.MaxInt8 {
		return fmt.Errorf("value out of range for int8: %d", i)
	}
	batch.AppendInt8(colIdx, int8(i))
	return nil
}

func (m *JsonToClickHouseMapper) appendInt16(batch *clickhouse.ColumnarBatch, colIdx int, fv *fastjson.Value) error {
	i, err := fv.Int64()
	if err != nil {
		return fmt.Errorf("failed to parse int16: %w", err)
	}
	if i < math.MinInt16 || i > math.MaxInt16 {
		return fmt.Errorf("value out of range for int16: %d", i)
	}
	batch.AppendInt16(colIdx, int16(i))
	return nil
}

func (m *JsonToClickHouseMapper) appendInt32(batch *clickhouse.ColumnarBatch, colIdx int, fv *fastjson.Value) error {
	i, err := fv.Int64()
	if err != nil {
		return fmt.Errorf("failed to parse int32: %w", err)
	}
	if i < math.MinInt32 || i > math.MaxInt32 {
		return fmt.Errorf("value out of range for int32: %d", i)
	}
	batch.AppendInt32(colIdx, int32(i))
	return nil
}

func (m *JsonToClickHouseMapper) appendInt64(batch *clickhouse.ColumnarBatch, colIdx int, fv *fastjson.Value) error {
	i, err := fv.Int64()
	if err != nil {
		return fmt.Errorf("failed to parse int64: %w", err)
	}
	batch.AppendInt64(colIdx, i)
	return nil
}

func (m *JsonToClickHouseMapper) appendUInt8(batch *clickhouse.ColumnarBatch, colIdx int, fv *fastjson.Value) error {
	u, err := fv.Uint64()
	if err != nil {
		return fmt.Errorf("failed to parse uint8: %w", err)
	}
	if u > math.MaxUint8 {
		return fmt.Errorf("value out of range for uint8: %d", u)
	}
	batch.AppendUInt8(colIdx, uint8(u))
	return nil
}

func (m *JsonToClickHouseMapper) appendUInt16(batch *clickhouse.ColumnarBatch, colIdx int, fv *fastjson.Value) error {
	u, err := fv.Uint64()
	if err != nil {
		return fmt.Errorf("failed to parse uint16: %w", err)
	}
	if u > math.MaxUint16 {
		return fmt.Errorf("value out of range for uint16: %d", u)
	}
	batch.AppendUInt16(colIdx, uint16(u))
	return nil
}

func (m *JsonToClickHouseMapper) appendUInt32(batch *clickhouse.ColumnarBatch, colIdx int, fv *fastjson.Value) error {
	u, err := fv.Uint64()
	if err != nil {
		return fmt.Errorf("failed to parse uint32: %w", err)
	}
	if u > math.MaxUint32 {
		return fmt.Errorf("value out of range for uint32: %d", u)
	}
	batch.AppendUInt32(colIdx, uint32(u))
	return nil
}

func (m *JsonToClickHouseMapper) appendUInt64(batch *clickhouse.ColumnarBatch, colIdx int, fv *fastjson.Value) error {
	u, err := fv.Uint64()
	if err != nil {
		return fmt.Errorf("failed to parse uint64: %w", err)
	}
	batch.AppendUInt64(colIdx, u)
	return nil
}

func (m *JsonToClickHouseMapper) appendFloat32(batch *clickhouse.ColumnarBatch, colIdx int, fv *fastjson.Value) error {
	f := fv.GetFloat64()
	if f < -math.MaxFloat32 || f > math.MaxFloat32 {
		return fmt.Errorf("value out of range for float32: %f", f)
	}
	batch.AppendFloat32(colIdx, float32(f))
	return nil
}

func (m *JsonToClickHouseMapper) appendFloat64(batch *clickhouse.ColumnarBatch, colIdx int, fv *fastjson.Value) error {
	batch.AppendFloat64(colIdx, fv.GetFloat64())
	return nil
}

func (m *JsonToClickHouseMapper) appendString(batch *clickhouse.ColumnarBatch, colIdx int, fv *fastjson.Value) error {
	// Check actual column type to handle both String and LowCardinality(String)
	cols := batch.Columns()
	if colIdx >= len(cols) {
		return fmt.Errorf("column index %d out of range", colIdx)
	}

	// Handle LowCardinality(String) columns
	if col, ok := cols[colIdx].(*proto.ColLowCardinality[string]); ok {
		col.Append(string(fv.GetStringBytes()))
		return nil
	}

	// Handle regular String columns - use AppendBytes to avoid string allocation
	batch.AppendStringBytes(colIdx, fv.GetStringBytes())
	return nil
}

func (m *JsonToClickHouseMapper) appendFixedString(batch *clickhouse.ColumnarBatch, colIdx int, fv *fastjson.Value) error {
	// FixedString will handle padding, just append the string
	batch.AppendStringBytes(colIdx, fv.GetStringBytes())
	return nil
}

func (m *JsonToClickHouseMapper) appendDateTime(
	batch *clickhouse.ColumnarBatch,
	colIdx int,
	fv *fastjson.Value,
	fieldType KafkaDataType,
) error {
	t, err := parseFastjsonDateTime(fv, fieldType)
	if err != nil {
		return err
	}
	batch.AppendDateTime(colIdx, t)
	return nil
}

func (m *JsonToClickHouseMapper) appendDateTime64(
	batch *clickhouse.ColumnarBatch,
	colIdx int,
	fv *fastjson.Value,
	fieldType KafkaDataType,
	columnTypeStr string,
) error {
	t, err := parseFastjsonDateTime(fv, fieldType)
	if err != nil {
		return err
	}

	// DateTime64 precision is handled when creating the column in createColumn()
	// The column is already configured with the correct precision
	batch.AppendDateTime64(colIdx, t)
	return nil
}

func (m *JsonToClickHouseMapper) appendUUID(batch *clickhouse.ColumnarBatch, colIdx int, fv *fastjson.Value) error {
	uuidBytes := fv.GetStringBytes()

	// Check actual column type
	cols := batch.Columns()
	if colIdx >= len(cols) {
		return fmt.Errorf("column index %d out of range", colIdx)
	}

	// If it's a String column, append as string (matching old clickhouse-go behavior)
	// This is checked first because the table schema may define UUID columns as String
	if col, ok := cols[colIdx].(*proto.ColStr); ok {
		col.AppendBytes(uuidBytes)
		return nil
	}

	// For UUID column, parse and validate
	if col, ok := cols[colIdx].(*proto.ColUUID); ok {
		parsedUUID, err := uuid.ParseBytes(uuidBytes)
		if err != nil {
			return fmt.Errorf("failed to parse UUID: %w", err)
		}
		col.Append(parsedUUID)
		return nil
	}

	return fmt.Errorf("column %d is neither UUID nor String type", colIdx)
}

func (m *JsonToClickHouseMapper) appendEnum(
	batch *clickhouse.ColumnarBatch,
	colIdx int,
	fv *fastjson.Value,
	columnType ClickHouseDataType,
) error {
	// Enums in ClickHouse are integers, not strings
	// The string value needs to be mapped to the enum integer value
	// For now, we'll try to parse as integer if possible, otherwise return error
	cols := batch.Columns()
	if colIdx >= len(cols) {
		return fmt.Errorf("column index %d out of range", colIdx)
	}

	enumStr := string(fv.GetStringBytes())

	// Try Enum8 first
	if _, ok := cols[colIdx].(*proto.ColEnum8); ok {
		// Enum8 values are typically small integers
		// We need the enum definition to map string->int, but for now try parsing as int
		// This is a limitation - full enum support requires enum definition parsing
		return fmt.Errorf("Enum8 requires enum definition mapping - string '%s' cannot be automatically converted", enumStr)
	}

	// Try Enum16
	if _, ok := cols[colIdx].(*proto.ColEnum16); ok {
		return fmt.Errorf("Enum16 requires enum definition mapping - string '%s' cannot be automatically converted", enumStr)
	}

	return fmt.Errorf("column %d is not an Enum type", colIdx)
}

func (m *JsonToClickHouseMapper) appendArray(
	batch *clickhouse.ColumnarBatch,
	colIdx int,
	fv *fastjson.Value,
	columnType ClickHouseDataType,
) error {
	// Parse array type to get inner type
	colTypeStr := string(columnType)
	if !strings.HasPrefix(colTypeStr, "Array(") || !strings.HasSuffix(colTypeStr, ")") {
		return fmt.Errorf("invalid array type: %s", columnType)
	}

	innerType := colTypeStr[6 : len(colTypeStr)-1]
	innerType = strings.TrimSpace(innerType)

	arr := fv.GetArray()
	if arr == nil {
		// Append empty array
		return m.appendEmptyArray(batch, colIdx, innerType)
	}

	// Zero-allocation append: use proto.ColArr[T] directly
	switch innerType {
	case "String":
		return m.appendStringArrayZeroAlloc(batch, colIdx, arr)
	case "Int64":
		return m.appendInt64ArrayZeroAlloc(batch, colIdx, arr)
	case "Int32":
		return m.appendInt32ArrayZeroAlloc(batch, colIdx, arr)
	case "Int16":
		return m.appendInt16ArrayZeroAlloc(batch, colIdx, arr)
	case "Int8":
		return m.appendInt8ArrayZeroAlloc(batch, colIdx, arr)
	case "UInt64":
		return m.appendUInt64ArrayZeroAlloc(batch, colIdx, arr)
	case "UInt32":
		return m.appendUInt32ArrayZeroAlloc(batch, colIdx, arr)
	case "UInt16":
		return m.appendUInt16ArrayZeroAlloc(batch, colIdx, arr)
	case "UInt8":
		return m.appendUInt8ArrayZeroAlloc(batch, colIdx, arr)
	case "Float64":
		return m.appendFloat64ArrayZeroAlloc(batch, colIdx, arr)
	case "Float32":
		return m.appendFloat32ArrayZeroAlloc(batch, colIdx, arr)
	case "Bool":
		return m.appendBoolArrayZeroAlloc(batch, colIdx, arr)
	default:
		return fmt.Errorf("unsupported array inner type: %s", innerType)
	}
}

// Zero-allocation array appenders
// Note: proto.ColArr[T] requires Append([]T) with a slice, so we build the slice
// from fastjson values. This is still better than the old approach which allocated
// intermediate maps/objects. For true zero-allocation, we'd need to access the inner
// column directly, but ch-go's ColArr API requires the slice.
func (m *JsonToClickHouseMapper) appendStringArrayZeroAlloc(batch *clickhouse.ColumnarBatch, colIdx int, arr []*fastjson.Value) error {
	cols := batch.Columns()
	if colIdx >= len(cols) {
		return fmt.Errorf("column index %d out of range", colIdx)
	}

	col, ok := cols[colIdx].(*proto.ColArr[string])
	if !ok {
		return fmt.Errorf("column %d is not Array(String)", colIdx)
	}

	// Build slice directly from fastjson - minimal allocation
	vals := make([]string, len(arr))
	for i, item := range arr {
		vals[i] = string(item.GetStringBytes())
	}
	col.Append(vals)
	return nil
}

func (m *JsonToClickHouseMapper) appendInt64ArrayZeroAlloc(batch *clickhouse.ColumnarBatch, colIdx int, arr []*fastjson.Value) error {
	cols := batch.Columns()
	if colIdx >= len(cols) {
		return fmt.Errorf("column index %d out of range", colIdx)
	}

	col, ok := cols[colIdx].(*proto.ColArr[int64])
	if !ok {
		return fmt.Errorf("column %d is not Array(Int64)", colIdx)
	}

	vals := make([]int64, len(arr))
	for i, item := range arr {
		val, err := item.Int64()
		if err != nil {
			return fmt.Errorf("failed to parse int64 in array: %w", err)
		}
		vals[i] = val
	}
	col.Append(vals)
	return nil
}

func (m *JsonToClickHouseMapper) appendInt32ArrayZeroAlloc(batch *clickhouse.ColumnarBatch, colIdx int, arr []*fastjson.Value) error {
	cols := batch.Columns()
	col, ok := cols[colIdx].(*proto.ColArr[int32])
	if !ok {
		return fmt.Errorf("column %d is not Array(Int32)", colIdx)
	}
	vals := make([]int32, len(arr))
	for i, item := range arr {
		val, err := item.Int64()
		if err != nil {
			return fmt.Errorf("failed to parse int32 in array: %w", err)
		}
		vals[i] = int32(val)
	}
	col.Append(vals)
	return nil
}

func (m *JsonToClickHouseMapper) appendInt16ArrayZeroAlloc(batch *clickhouse.ColumnarBatch, colIdx int, arr []*fastjson.Value) error {
	cols := batch.Columns()
	col, ok := cols[colIdx].(*proto.ColArr[int16])
	if !ok {
		return fmt.Errorf("column %d is not Array(Int16)", colIdx)
	}
	vals := make([]int16, len(arr))
	for i, item := range arr {
		val, err := item.Int64()
		if err != nil {
			return fmt.Errorf("failed to parse int16 in array: %w", err)
		}
		vals[i] = int16(val)
	}
	col.Append(vals)
	return nil
}

func (m *JsonToClickHouseMapper) appendInt8ArrayZeroAlloc(batch *clickhouse.ColumnarBatch, colIdx int, arr []*fastjson.Value) error {
	cols := batch.Columns()
	col, ok := cols[colIdx].(*proto.ColArr[int8])
	if !ok {
		return fmt.Errorf("column %d is not Array(Int8)", colIdx)
	}
	vals := make([]int8, len(arr))
	for i, item := range arr {
		val, err := item.Int64()
		if err != nil {
			return fmt.Errorf("failed to parse int8 in array: %w", err)
		}
		vals[i] = int8(val)
	}
	col.Append(vals)
	return nil
}

func (m *JsonToClickHouseMapper) appendUInt64ArrayZeroAlloc(batch *clickhouse.ColumnarBatch, colIdx int, arr []*fastjson.Value) error {
	cols := batch.Columns()
	col, ok := cols[colIdx].(*proto.ColArr[uint64])
	if !ok {
		return fmt.Errorf("column %d is not Array(UInt64)", colIdx)
	}
	vals := make([]uint64, len(arr))
	for i, item := range arr {
		val, err := item.Uint64()
		if err != nil {
			return fmt.Errorf("failed to parse uint64 in array: %w", err)
		}
		vals[i] = val
	}
	col.Append(vals)
	return nil
}

func (m *JsonToClickHouseMapper) appendUInt32ArrayZeroAlloc(batch *clickhouse.ColumnarBatch, colIdx int, arr []*fastjson.Value) error {
	cols := batch.Columns()
	col, ok := cols[colIdx].(*proto.ColArr[uint32])
	if !ok {
		return fmt.Errorf("column %d is not Array(UInt32)", colIdx)
	}
	vals := make([]uint32, len(arr))
	for i, item := range arr {
		val, err := item.Uint64()
		if err != nil {
			return fmt.Errorf("failed to parse uint32 in array: %w", err)
		}
		vals[i] = uint32(val)
	}
	col.Append(vals)
	return nil
}

func (m *JsonToClickHouseMapper) appendUInt16ArrayZeroAlloc(batch *clickhouse.ColumnarBatch, colIdx int, arr []*fastjson.Value) error {
	cols := batch.Columns()
	col, ok := cols[colIdx].(*proto.ColArr[uint16])
	if !ok {
		return fmt.Errorf("column %d is not Array(UInt16)", colIdx)
	}
	vals := make([]uint16, len(arr))
	for i, item := range arr {
		val, err := item.Uint64()
		if err != nil {
			return fmt.Errorf("failed to parse uint16 in array: %w", err)
		}
		vals[i] = uint16(val)
	}
	col.Append(vals)
	return nil
}

func (m *JsonToClickHouseMapper) appendUInt8ArrayZeroAlloc(batch *clickhouse.ColumnarBatch, colIdx int, arr []*fastjson.Value) error {
	cols := batch.Columns()
	col, ok := cols[colIdx].(*proto.ColArr[uint8])
	if !ok {
		return fmt.Errorf("column %d is not Array(UInt8)", colIdx)
	}
	vals := make([]uint8, len(arr))
	for i, item := range arr {
		val, err := item.Uint64()
		if err != nil {
			return fmt.Errorf("failed to parse uint8 in array: %w", err)
		}
		vals[i] = uint8(val)
	}
	col.Append(vals)
	return nil
}

func (m *JsonToClickHouseMapper) appendFloat64ArrayZeroAlloc(batch *clickhouse.ColumnarBatch, colIdx int, arr []*fastjson.Value) error {
	cols := batch.Columns()
	col, ok := cols[colIdx].(*proto.ColArr[float64])
	if !ok {
		return fmt.Errorf("column %d is not Array(Float64)", colIdx)
	}
	vals := make([]float64, len(arr))
	for i, item := range arr {
		vals[i] = item.GetFloat64()
	}
	col.Append(vals)
	return nil
}

func (m *JsonToClickHouseMapper) appendFloat32ArrayZeroAlloc(batch *clickhouse.ColumnarBatch, colIdx int, arr []*fastjson.Value) error {
	cols := batch.Columns()
	col, ok := cols[colIdx].(*proto.ColArr[float32])
	if !ok {
		return fmt.Errorf("column %d is not Array(Float32)", colIdx)
	}
	vals := make([]float32, len(arr))
	for i, item := range arr {
		vals[i] = float32(item.GetFloat64())
	}
	col.Append(vals)
	return nil
}

func (m *JsonToClickHouseMapper) appendBoolArrayZeroAlloc(batch *clickhouse.ColumnarBatch, colIdx int, arr []*fastjson.Value) error {
	cols := batch.Columns()
	col, ok := cols[colIdx].(*proto.ColArr[bool])
	if !ok {
		return fmt.Errorf("column %d is not Array(Bool)", colIdx)
	}
	vals := make([]bool, len(arr))
	for i, item := range arr {
		vals[i] = item.GetBool()
	}
	col.Append(vals)
	return nil
}

func (m *JsonToClickHouseMapper) appendEmptyArray(batch *clickhouse.ColumnarBatch, colIdx int, innerType string) error {
	cols := batch.Columns()
	if colIdx >= len(cols) {
		return fmt.Errorf("column index %d out of range", colIdx)
	}

	// Append empty array by appending empty slice
	switch innerType {
	case "String":
		if col, ok := cols[colIdx].(*proto.ColArr[string]); ok {
			col.Append([]string{})
			return nil
		}
	case "Int64":
		if col, ok := cols[colIdx].(*proto.ColArr[int64]); ok {
			col.Append([]int64{})
			return nil
		}
	case "Int32":
		if col, ok := cols[colIdx].(*proto.ColArr[int32]); ok {
			col.Append([]int32{})
			return nil
		}
	case "Bool":
		if col, ok := cols[colIdx].(*proto.ColArr[bool]); ok {
			col.Append([]bool{})
			return nil
		}
	}
	return fmt.Errorf("unsupported empty array type: %s", innerType)
}

func (m *JsonToClickHouseMapper) appendMap(
	batch *clickhouse.ColumnarBatch,
	colIdx int,
	fv *fastjson.Value,
) error {
	obj, err := fv.Object()
	if err != nil {
		return fmt.Errorf("expected object for Map type: %w", err)
	}

	cols := batch.Columns()
	if colIdx >= len(cols) {
		return fmt.Errorf("column index %d out of range", colIdx)
	}

	// proto.ColMap requires Append(map[K]V), so we build the map from fastjson
	// This is still better than the old approach which had additional allocations
	col, ok := cols[colIdx].(*proto.ColMap[string, string])
	if !ok {
		return fmt.Errorf("column %d is not Map(String, String)", colIdx)
	}

	// Build map directly from fastjson - minimal allocation
	result := make(map[string]string)
	obj.Visit(func(key []byte, val *fastjson.Value) {
		keyStr := string(key)
		switch val.Type() {
		case fastjson.TypeString:
			result[keyStr] = string(val.GetStringBytes())
		case fastjson.TypeNumber:
			result[keyStr] = val.String()
		case fastjson.TypeTrue:
			result[keyStr] = "true"
		case fastjson.TypeFalse:
			result[keyStr] = "false"
		case fastjson.TypeNull:
			result[keyStr] = ""
		default:
			result[keyStr] = val.String()
		}
	})

	col.Append(result)
	return nil
}

func (m *JsonToClickHouseMapper) appendNullable(
	batch *clickhouse.ColumnarBatch,
	colIdx int,
	fv *fastjson.Value,
	columnType ClickHouseDataType,
	fieldType KafkaDataType,
) error {
	// Nullable columns are not supported - they require proper null bitmap handling
	// This should be caught at schema validation, but handle gracefully here
	return fmt.Errorf("nullable columns are not supported in columnar mode - use non-nullable columns or handle nulls at application level")
}
