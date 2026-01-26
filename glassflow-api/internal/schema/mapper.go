package schema

import (
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/valyala/fastjson"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

// parserPool is used to reuse fastjson parsers across calls
var parserPool fastjson.ParserPool

type Mapper interface {
	GetLeftStreamTTL() (time.Duration, error)
	GetRightStreamTTL() (time.Duration, error)
	GetJoinKey(streamSchemaName string, data []byte) (any, error)
	GetKey(streamSchemaName, keyName string, data []byte) (any, error)
	GetOrderedColumns() []string
	GetOrderedColumnsStream(streamSchemaName string) []string
	PrepareValues(data []byte) ([]any, error)
	PrepareValuesStream(streamSchemaName string, data []byte) ([]any, error)
	GetFieldsMap(streamSchemaName string, data []byte) (map[string]any, error)
	JoinData(leftStreamName string, leftData []byte, rightStreamName string, rightData []byte) ([]byte, error)
	ValidateSchema(streamSchemaName string, data []byte) error
}

type Stream struct {
	Fields          map[string]KafkaDataType
	JoinKey         string
	JoinOrientation string
	JoinWindow      time.Duration
}

type SinkMapping struct {
	ColumnName string
	StreamName string
	FieldName  string
	ColumnType ClickHouseDataType
	pathParts  []string // pre-split path for nested field access
}

func NewMapper(cfg models.MapperConfig) (Mapper, error) {
	if cfg.Type != internal.SchemaMapperJSONToCHType {
		return nil, fmt.Errorf("unsupported mapper type: %s", cfg.Type)
	}

	mapper, err := NewJSONToClickHouseMapper(cfg.Streams, cfg.SinkMapping)
	if err != nil {
		return nil, fmt.Errorf("failed to create JsonToClickHouseMapper: %w", err)
	}

	return mapper, nil
}

func NewSinkMapping(columnName, streamName, fieldName, columnType string) *SinkMapping {
	return &SinkMapping{
		ColumnName: columnName,
		StreamName: streamName,
		FieldName:  fieldName,
		ColumnType: ClickHouseDataType(columnType),
		pathParts:  strings.Split(fieldName, "."),
	}
}

type JsonToClickHouseMapper struct {
	Streams map[string]Stream
	Columns []*SinkMapping

	fieldColumnMap  map[string]*SinkMapping
	orderedColumns  []string
	columnOrderMap  map[string]int
	streamColumnCnt map[string]int   // cached column count per stream
	streamColumnIdx map[string][]int // stream name -> []columnIndex in batch.columns order

	leftStream  string
	rightStream string
}

func (m *JsonToClickHouseMapper) GetOrderedColumnsStream(streamSchemaName string) []string {
	columns := make([]string, 0, m.streamColumnCnt[streamSchemaName])
	for _, column := range m.Columns {
		if column.StreamName == streamSchemaName {
			columns = append(columns, column.ColumnName)
		}
	}
	return columns
}

func (m *JsonToClickHouseMapper) PrepareValuesStream(streamSchemaName string, data []byte) ([]any, error) {
	p := parserPool.Get()
	defer parserPool.Put(p)

	v, err := p.ParseBytes(data)
	if err != nil {
		return nil, fmt.Errorf("failed to parse JSON data: %w", err)
	}

	values := make([]any, 0, m.streamColumnCnt[streamSchemaName])

	for _, column := range m.Columns {
		if column.StreamName != streamSchemaName {
			continue
		}

		fv := getNestedFastjsonValue(v, column.FieldName, column.pathParts)
		if fv == nil {
			values = append(values, nil)
			continue
		}

		fieldType := m.Streams[column.StreamName].Fields[column.FieldName]
		convertedValue, err := ConvertFastjsonValue(column.ColumnType, fieldType, fv)
		if err != nil {
			return nil, fmt.Errorf("failed to convert field %s: %w", column.FieldName, err)
		}

		values = append(values, convertedValue)
	}

	return values, nil
}

func convertStreams(streams map[string]models.StreamSchemaConfig) map[string]Stream {
	mappedStreams := make(map[string]Stream)

	for streamName, streamConfig := range streams {
		fields := make(map[string]KafkaDataType)

		for _, field := range streamConfig.Fields {
			fields[field.FieldName] = KafkaDataType(field.FieldType)
		}

		mappedStreams[streamName] = Stream{
			Fields:          fields,
			JoinKey:         streamConfig.JoinKeyField,
			JoinOrientation: streamConfig.JoinOrientation,
			JoinWindow:      streamConfig.JoinWindow.Duration(),
		}
	}

	return mappedStreams
}

func NewJSONToClickHouseMapper(streamsConfig map[string]models.StreamSchemaConfig, sinkMappingConfig []models.SinkMappingConfig) (*JsonToClickHouseMapper, error) {
	columnMappings := make([]*SinkMapping, 0, len(sinkMappingConfig))
	for _, mapping := range sinkMappingConfig {
		columnMappings = append(columnMappings, NewSinkMapping(mapping.ColumnName, mapping.StreamName, mapping.FieldName, mapping.ColumnType))
	}

	m := &JsonToClickHouseMapper{ //nolint:exhaustruct //missed fields will be added
		Streams:         make(map[string]Stream),
		Columns:         columnMappings,
		fieldColumnMap:  make(map[string]*SinkMapping),
		columnOrderMap:  make(map[string]int),
		streamColumnCnt: make(map[string]int),
		streamColumnIdx: make(map[string][]int),
	}

	m.Streams = convertStreams(streamsConfig)

	for name, stream := range m.Streams {
		switch stream.JoinOrientation {
		case "left":
			m.leftStream = name
		case "right":
			m.rightStream = name
		}
	}

	if err := m.validate(); err != nil {
		return nil, err
	}

	for _, column := range m.Columns {
		m.fieldColumnMap[column.FieldName] = column
		m.streamColumnCnt[column.StreamName]++
	}

	m.buildColumnOrder()
	m.buildStreamColumnIndex()

	return m, nil
}

func (m *JsonToClickHouseMapper) validate() error {
	if len(m.Streams) == 0 {
		return fmt.Errorf("no streams defined in mapping")
	}

	for streamName, stream := range m.Streams {
		if len(stream.Fields) == 0 {
			return fmt.Errorf("no fields defined in stream '%s'", streamName)
		}

		if stream.JoinKey != "" {
			if _, ok := stream.Fields[stream.JoinKey]; !ok {
				return fmt.Errorf("join key '%s' not found in stream '%s'", stream.JoinKey, streamName)
			}
		}
	}

	if len(m.Columns) == 0 {
		return fmt.Errorf("no columns defined in mapping")
	}

	for _, column := range m.Columns {
		streamSchema, ok := m.Streams[column.StreamName]
		if !ok {
			return fmt.Errorf("stream '%s' not found in configuration", column.StreamName)
		}

		if _, ok := streamSchema.Fields[column.FieldName]; !ok {
			return fmt.Errorf("field '%s' not found in stream '%s'", column.FieldName, column.StreamName)
		}

		// Reject Nullable columns - they require proper null bitmap handling in columnar mode
		colTypeStr := string(column.ColumnType)
		if strings.HasPrefix(colTypeStr, "Nullable(") {
			return fmt.Errorf("nullable columns are not supported in columnar mode for column '%s' - use non-nullable columns or handle nulls at application level", column.ColumnName)
		}
	}

	return nil
}

func (m *JsonToClickHouseMapper) buildColumnOrder() {
	m.orderedColumns = make([]string, len(m.Columns))

	for i, column := range m.Columns {
		m.orderedColumns[i] = column.ColumnName
		m.columnOrderMap[column.ColumnName] = i
	}
}

// buildStreamColumnIndex builds the mapping from stream name to column indices in batch order.
// This ensures AppendToColumns uses the correct column indices that match GetOrderedColumnsStream().
func (m *JsonToClickHouseMapper) buildStreamColumnIndex() {
	// Build column name to index map for each stream (in GetOrderedColumnsStream order)
	for streamName := range m.Streams {
		orderedColNames := m.GetOrderedColumnsStream(streamName)
		indices := make([]int, 0, len(orderedColNames))

		// Map column names to their indices in m.Columns
		colNameToIdx := make(map[string]int)
		for i, col := range m.Columns {
			if col.StreamName == streamName {
				colNameToIdx[col.ColumnName] = i
			}
		}

		// Build indices in the order of GetOrderedColumnsStream
		for _, colName := range orderedColNames {
			if idx, ok := colNameToIdx[colName]; ok {
				indices = append(indices, idx)
			}
		}

		m.streamColumnIdx[streamName] = indices
	}
}

func (m *JsonToClickHouseMapper) GetLeftStreamTTL() (time.Duration, error) {
	if m.leftStream == "" {
		return 0, fmt.Errorf("left stream is not defined in the mapper")
	}
	return m.Streams[m.leftStream].JoinWindow, nil
}

func (m *JsonToClickHouseMapper) GetRightStreamTTL() (time.Duration, error) {
	if m.rightStream == "" {
		return 0, fmt.Errorf("right stream is not defined in the mapper")
	}
	return m.Streams[m.rightStream].JoinWindow, nil
}

func (m *JsonToClickHouseMapper) GetLeftStream() string {
	return m.leftStream
}

func (m *JsonToClickHouseMapper) GetRightStream() string {
	return m.rightStream
}

func (m *JsonToClickHouseMapper) getKey(streamSchemaName, keyName string, data []byte) (any, error) {
	p := parserPool.Get()
	defer parserPool.Put(p)

	v, err := p.ParseBytes(data)
	if err != nil {
		return nil, fmt.Errorf("failed to parse JSON data: %w", err)
	}

	pathParts := strings.Split(keyName, ".")
	fv := getNestedFastjsonValue(v, keyName, pathParts)
	if fv == nil {
		return nil, fmt.Errorf("key %s not found in data", keyName)
	}

	// Extract value directly from fastjson based on type
	return extractFastjsonKeyValue(fv)
}

// extractFastjsonKeyValue extracts a key value from fastjson with minimal allocation
func extractFastjsonKeyValue(v *fastjson.Value) (any, error) {
	switch v.Type() {
	case fastjson.TypeString:
		return string(v.GetStringBytes()), nil
	case fastjson.TypeNumber:
		if i, err := v.Int64(); err == nil {
			return i, nil
		}
		return v.GetFloat64(), nil
	case fastjson.TypeTrue:
		return true, nil
	case fastjson.TypeFalse:
		return false, nil
	case fastjson.TypeNull:
		return nil, nil
	default:
		return nil, fmt.Errorf("unsupported key type: %s", v.Type())
	}
}

func (m *JsonToClickHouseMapper) GetJoinKey(streamSchemaName string, data []byte) (any, error) {
	keyField := m.Streams[streamSchemaName].JoinKey
	if keyField == "" {
		return nil, fmt.Errorf("no join key defined in schema")
	}

	return m.getKey(streamSchemaName, keyField, data)
}

func (m *JsonToClickHouseMapper) GetKey(streamSchemaName, keyName string, data []byte) (any, error) {
	if keyName == "" {
		return nil, fmt.Errorf("key name cannot be empty")
	}

	if _, exists := m.Streams[streamSchemaName]; !exists {
		return nil, fmt.Errorf("stream '%s' not found in configuration", streamSchemaName)
	}

	if _, exists := m.Streams[streamSchemaName].Fields[keyName]; !exists {
		return nil, fmt.Errorf("key '%s' not found in stream '%s'", keyName, streamSchemaName)
	}

	return m.getKey(streamSchemaName, keyName, data)
}

func (m *JsonToClickHouseMapper) GetOrderedColumns() []string {
	return m.orderedColumns
}

func (m *JsonToClickHouseMapper) PrepareValues(data []byte) ([]any, error) {
	p := parserPool.Get()
	defer parserPool.Put(p)

	v, err := p.ParseBytes(data)
	if err != nil {
		return nil, fmt.Errorf("failed to parse JSON data: %w", err)
	}

	values := make([]any, len(m.orderedColumns))

	for i, column := range m.Columns {
		fv := getNestedFastjsonValue(v, column.FieldName, column.pathParts)

		if fv == nil {
			continue
		}

		fieldType := m.Streams[column.StreamName].Fields[column.FieldName]
		convertedValue, err := ConvertFastjsonValue(column.ColumnType, fieldType, fv)
		if err != nil {
			return nil, fmt.Errorf("failed to convert field %s: %w", column.FieldName, err)
		}

		values[i] = convertedValue
	}

	return values, nil
}

func (m *JsonToClickHouseMapper) GetFieldsMap(streamSchemaName string, data []byte) (map[string]any, error) {
	p := parserPool.Get()
	defer parserPool.Put(p)

	v, err := p.ParseBytes(data)
	if err != nil {
		return nil, fmt.Errorf("failed to parse JSON data: %w", err)
	}

	resultedMap := make(map[string]any, len(m.Streams[streamSchemaName].Fields))

	for fieldName := range m.Streams[streamSchemaName].Fields {
		pathParts := strings.Split(fieldName, ".")
		if fv := getNestedFastjsonValue(v, fieldName, pathParts); fv != nil {
			resultedMap[fieldName] = fastjsonToGo(fv)
		}
	}

	return resultedMap, nil
}

func (m *JsonToClickHouseMapper) ValidateSchema(streamSchemaName string, data []byte) error {
	if _, exists := m.Streams[streamSchemaName]; !exists {
		return fmt.Errorf("stream '%s' not found in configuration", streamSchemaName)
	}

	p := parserPool.Get()
	defer parserPool.Put(p)

	v, err := p.ParseBytes(data)
	if err != nil {
		return fmt.Errorf("failed to parse JSON data: %w", err)
	}

	// Get all field names and sort them for deterministic validation order
	fieldNames := make([]string, 0, len(m.Streams[streamSchemaName].Fields))
	for fieldName := range m.Streams[streamSchemaName].Fields {
		fieldNames = append(fieldNames, fieldName)
	}
	sort.Strings(fieldNames)

	// Check fields in sorted order
	for _, key := range fieldNames {
		pathParts := strings.Split(key, ".")
		if fv := getNestedFastjsonValue(v, key, pathParts); fv == nil {
			return fmt.Errorf("field '%s' not found in data for stream '%s'", key, streamSchemaName)
		}
	}

	return nil
}

func (m *JsonToClickHouseMapper) JoinData(leftStreamName string, leftData []byte, rightStreamName string, rightData []byte) ([]byte, error) {
	if leftData == nil || rightData == nil {
		return nil, fmt.Errorf("left or right data is nil")
	}

	var result map[string]any
	var leftMap map[string]any
	var rightMap map[string]any

	leftMap, err := m.GetFieldsMap(leftStreamName, leftData)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal left data: %w", err)
	}

	rightMap, err = m.GetFieldsMap(rightStreamName, rightData)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal right data: %w", err)
	}

	result = make(map[string]any)
	for key, value := range leftMap {
		result[leftStreamName+"."+key] = value
	}

	for key, value := range rightMap {
		result[rightStreamName+"."+key] = value
	}

	resultData, err := json.Marshal(result)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal result data: %w", err)
	}

	return resultData, nil
}

// getNestedFastjsonValue extracts a value from a fastjson.Value using pre-split path parts.
// First tries the path as a flat key (for join operators with . separator), then traverses nested structure.
func getNestedFastjsonValue(v *fastjson.Value, path string, pathParts []string) *fastjson.Value {
	if v == nil || path == "" {
		return nil
	}

	// First, try to find the path as a flat key (for join operators with . separator)
	if fv := v.Get(path); fv != nil {
		return fv
	}

	// Traverse nested structure using pre-split path parts
	current := v
	for _, part := range pathParts {
		current = current.Get(part)
		if current == nil {
			return nil
		}
	}

	return current
}

// fastjsonToGo converts a fastjson.Value to a Go native type.
func fastjsonToGo(v *fastjson.Value) any {
	if v == nil {
		return nil
	}

	switch v.Type() {
	case fastjson.TypeNull:
		return nil
	case fastjson.TypeString:
		return string(v.GetStringBytes())
	case fastjson.TypeNumber:
		// Try int first, fall back to float
		if i, err := v.Int64(); err == nil {
			return i
		}
		return v.GetFloat64()
	case fastjson.TypeTrue:
		return true
	case fastjson.TypeFalse:
		return false
	case fastjson.TypeArray:
		arr := v.GetArray()
		result := make([]any, len(arr))
		for i, item := range arr {
			result[i] = fastjsonToGo(item)
		}
		return result
	case fastjson.TypeObject:
		obj, _ := v.Object()
		result := make(map[string]any)
		obj.Visit(func(key []byte, val *fastjson.Value) {
			result[string(key)] = fastjsonToGo(val)
		})
		return result
	default:
		return nil
	}
}
